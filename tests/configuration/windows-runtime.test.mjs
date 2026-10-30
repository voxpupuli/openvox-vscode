import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../../out/configuration.js', import.meta.url), 'utf8');
const serverPath = 'C:\\extension\\vendor\\languageserver\\openvox-languageserver';
const context = { asAbsolutePath: (relativePath) => path.win32.join('C:\\extension', relativePath) };
const settings = {
  serverPath: '',
  rubyCommand: '',
  installDirectory: '',
  timeout: 10,
  confdir: '',
  environment: '',
  modulePath: '',
  vardir: '',
  debugFilePath: '',
};

// Exercise the public configuration API with Windows paths on every CI platform.
function loadWindowsConfiguration(installRoot, env = {}) {
  const rubyExecutable = path.win32.join(installRoot, 'puppet', 'bin', 'ruby.exe');
  const bundledGemHome = path.win32.join(path.win32.dirname(serverPath), 'gems');
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    process: {
      platform: 'win32',
      env: { ProgramFiles: 'C:\\Program Files', PATH: 'C:\\OtherRuby\\bin', ...env },
    },
    require(name) {
      switch (name) {
        case 'node:fs':
          return { existsSync: (filename) => filename === rubyExecutable || filename === bundledGemHome };
        case 'node:path':
          return path.win32;
        case 'node:child_process':
        case 'vscode':
          return {};
        default:
          throw new Error(`Unexpected dependency: ${name}`);
      }
    },
  });
  return exports;
}

test('Windows defaults select the agent Ruby despite another Ruby on PATH', () => {
  const installRoot = 'C:\\Program Files\\Puppet Labs\\Puppet';
  const configuration = loadWindowsConfiguration(installRoot);
  const executable = configuration.createServerExecutable(context, settings);

  assert.equal(configuration.defaultInstallRoot(), installRoot);
  assert.equal(executable.command, `${installRoot}\\puppet\\bin\\ruby.exe`);
  assert.equal(executable.args[0], serverPath);
  assert.equal(executable.options.env.RUBY_DIR, `${installRoot}\\puppet`);
  const pathEntries = executable.options.env.PATH.split(';');
  assert.equal(pathEntries[0], `${installRoot}\\puppet\\bin`);
  assert.ok(pathEntries.includes('C:\\OtherRuby\\bin'));
  assert.ok(pathEntries.every((entry) => !entry.includes('\\sys\\')));
});

test('Windows defaults prefer ProgramW6432 for a 64-bit agent', () => {
  const installRoot = 'C:\\Program Files\\Puppet Labs\\Puppet';
  const configuration = loadWindowsConfiguration(installRoot, {
    ProgramW6432: 'C:\\Program Files',
    ProgramFiles: 'C:\\Program Files (x86)',
  });

  assert.equal(configuration.createServerExecutable(context, settings).command,
    `${installRoot}\\puppet\\bin\\ruby.exe`);
});

test('Windows uses the agent Ruby in a configured installation directory', () => {
  const installRoot = 'D:\\Custom Agent';
  const configuration = loadWindowsConfiguration(installRoot);
  const executable = configuration.createServerExecutable(context, { ...settings, installDirectory: installRoot });

  assert.equal(executable.command, `${installRoot}\\puppet\\bin\\ruby.exe`);
  assert.equal(executable.options.env.RUBY_DIR, `${installRoot}\\puppet`);
  assert.equal(executable.options.env.PATH.split(';')[0], `${installRoot}\\puppet\\bin`);
});

test('an explicit Ruby command takes precedence over the Windows agent Ruby', () => {
  const configuration = loadWindowsConfiguration('C:\\Program Files\\Puppet Labs\\Puppet');
  const rubyCommand = 'D:\\Custom Ruby\\bin\\ruby.exe';

  assert.equal(configuration.createServerExecutable(context, { ...settings, rubyCommand }).command, rubyCommand);
});
