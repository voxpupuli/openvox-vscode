import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as vscode from 'vscode';
import { Executable } from 'vscode-languageclient/node';

export interface OpenVoxSettings {
  enabled: boolean;
  serverPath: string;
  rubyCommand: string;
  installDirectory: string;
  timeout: number;
  logLevel: string;
  debugFilePath: string;
  confdir: string;
  environment: string;
  modulePath: string;
  vardir: string;
}

export function readSettings(): OpenVoxSettings {
  const configuration = vscode.workspace.getConfiguration('openvox');

  return {
    enabled: configuration.get('languageServer.enabled', true),
    serverPath: configuration.get('languageServer.path', ''),
    rubyCommand: configuration.get('languageServer.rubyCommand', ''),
    installDirectory: configuration.get('languageServer.installDirectory', ''),
    timeout: configuration.get('languageServer.timeout', 10),
    logLevel: configuration.get('languageServer.logLevel', 'normal'),
    debugFilePath: configuration.get('languageServer.debugFilePath', ''),
    confdir: configuration.get('puppet.confdir', ''),
    environment: configuration.get('puppet.environment', ''),
    modulePath: configuration.get('puppet.modulePath', ''),
    vardir: configuration.get('puppet.vardir', ''),
  };
}

export function resolveServerPath(context: vscode.ExtensionContext, settings: OpenVoxSettings): string {
  if (settings.serverPath.trim() !== '') {
    return path.resolve(settings.serverPath);
  }

  return context.asAbsolutePath(path.join('vendor', 'languageserver', 'openvox-languageserver'));
}

export function hasConfiguredInstallDirectory(settings: OpenVoxSettings): boolean {
  return settings.installDirectory.trim() !== '';
}

export function createServerExecutable(
  context: vscode.ExtensionContext,
  settings: OpenVoxSettings,
): Executable {
  const serverPath = resolveServerPath(context, settings);
  const installRoot = resolveInstallRoot(settings.installDirectory);
  const layout = resolveRuntimeLayout(installRoot);
  const env = createEnvironment(layout, settings.rubyCommand.trim() === '');
  const bundledGemHome = path.join(path.dirname(serverPath), 'gems');
  if (fs.existsSync(bundledGemHome)) {
    env.GEM_HOME = bundledGemHome;
    env.GEM_PATH = bundledGemHome;
  }
  const command = resolveRubyCommand(settings.rubyCommand, layout);

  const args = [serverPath, '--stdio', `--timeout=${settings.timeout}`];
  const puppetSettings = [
    ['confdir', settings.confdir],
    ['environment', settings.environment],
    ['modulepath', settings.modulePath],
    ['vardir', settings.vardir],
  ]
    .filter(([, value]) => value.trim() !== '')
    .map(([name, value]) => `--${name},${value}`);

  if (puppetSettings.length > 0) {
    args.push(`--puppet-settings=${puppetSettings.join(',')}`);
  }
  if (settings.debugFilePath.trim() !== '') {
    args.push(`--debug=${settings.debugFilePath}`);
  }

  return {
    command,
    args,
    options: {
      env,
    },
  };
}

export interface RuntimeValidationResult {
  valid: boolean;
  version?: string;
  error?: string;
}

export function validateOpenVoxRuntime(
  context: vscode.ExtensionContext,
  settings: OpenVoxSettings,
  executable: Executable,
): RuntimeValidationResult {
  const serverLibraryPath = path.join(path.dirname(resolveServerPath(context, settings)), 'lib');
  const validationScript = [
    'OpenVoxRuntime.activate!',
    "abort 'The loaded runtime is not OpenVox' unless OpenVoxRuntime.gem_name == 'openvox'",
    'OpenFactRuntime.activate!',
    "abort 'The loaded facts runtime is not OpenFact' unless OpenFactRuntime.gem_name == 'openfact'",
    'print OpenVoxRuntime.gem_version',
  ].join('; ');

  const result = spawnSync(
    executable.command,
    ['-I', serverLibraryPath, '-ropenvox_runtime', '-ropenfact_runtime', '-e', validationScript],
    {
      env: executable.options?.env,
      encoding: 'utf8',
      timeout: 10000,
      windowsHide: true,
    },
  );

  if (result.error) {
    return { valid: false, error: result.error.message };
  }
  if (result.status !== 0) {
    return {
      valid: false,
      error: result.stderr.trim() || result.stdout.trim() || `Ruby exited with status ${result.status}`,
    };
  }

  const version = result.stdout.trim();
  return version === ''
    ? { valid: false, error: 'OpenVox returned no version information.' }
    : { valid: true, version };
}

export function defaultInstallRoot(): string {
  if (process.platform === 'win32') {
    const programFiles = process.env.ProgramW6432 ?? process.env.ProgramFiles ?? 'C:\\Program Files';
    return path.join(programFiles, 'Puppet Labs', 'Puppet');
  }

  return '/opt/puppetlabs';
}

function resolveInstallRoot(configuredPath: string): string {
  return configuredPath.trim() === '' ? defaultInstallRoot() : path.resolve(configuredPath);
}

interface RuntimeLayout {
  installRoot: string;
  puppetDir: string;
  openFactDir: string;
  rubyDir: string;
  rubyExecutable: string;
}

function resolveRuntimeLayout(installRoot: string): RuntimeLayout {
  if (process.platform === 'win32') {
    const rubyDir = path.join(installRoot, 'sys', 'ruby');
    return {
      installRoot,
      puppetDir: path.join(installRoot, 'puppet'),
      // OpenFact intentionally retains the packaged `facter` directory and executable.
      openFactDir: path.join(installRoot, 'facter'),
      rubyDir,
      rubyExecutable: path.join(rubyDir, 'bin', 'ruby.exe'),
    };
  }

  const puppetDir = path.join(installRoot, 'puppet');
  return {
    installRoot,
    puppetDir,
    // OpenFact intentionally retains the packaged `facter` directory and executable.
    openFactDir: path.join(installRoot, 'facter'),
    rubyDir: path.join(installRoot, 'lib', 'ruby'),
    rubyExecutable: path.join(puppetDir, 'bin', 'ruby'),
  };
}

function resolveRubyCommand(configuredCommand: string, layout: RuntimeLayout): string {
  if (configuredCommand.trim() !== '') {
    return configuredCommand;
  }
  if (fs.existsSync(layout.rubyExecutable)) {
    return layout.rubyExecutable;
  }

  return 'ruby';
}

function createEnvironment(layout: RuntimeLayout, sanitizeGemEnvironment: boolean): NodeJS.ProcessEnv {
  const env = { ...process.env };
  const separator = path.delimiter;
  const pathEntries = [
    path.join(layout.puppetDir, 'bin'),
    path.join(layout.openFactDir, 'bin'),
    path.join(layout.installRoot, 'bin'),
    path.join(layout.rubyDir, 'bin'),
    path.join(layout.installRoot, 'sys', 'tools', 'bin'),
    env.PATH ?? '',
  ].filter(Boolean);
  const rubyLibEntries = [
    path.join(layout.puppetDir, 'lib'),
    path.join(layout.openFactDir, 'lib'),
    env.RUBYLIB ?? '',
  ].filter(Boolean);

  env.PATH = pathEntries.join(separator);
  env.RUBYLIB = rubyLibEntries.join(separator);
  env.RUBY_DIR = layout.rubyDir;
  env.RUBYOPT = '-rrubygems';
  env.SSL_CERT_FILE = path.join(layout.puppetDir, 'ssl', 'cert.pem');
  env.SSL_CERT_DIR = path.join(layout.puppetDir, 'ssl', 'certs');

  if (sanitizeGemEnvironment) {
    delete env.BUNDLE_GEMFILE;
    delete env.GEM_HOME;
    delete env.GEM_PATH;
    delete env.MY_RUBY_HOME;
    delete env.RUBY_ROOT;
  }

  return env;
}
