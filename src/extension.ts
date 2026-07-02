import * as fs from 'node:fs';
import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  RevealOutputChannelOn,
  State,
} from 'vscode-languageclient/node';
import {
  createServerExecutable,
  hasConfiguredInstallDirectory,
  readSettings,
  resolveServerPath,
  validateOpenVoxRuntime,
} from './configuration';
import { Logger } from './logging';
import { RuntimeVersionDetails, runtimeVersionRequest } from './messages';

let client: LanguageClient | undefined;
let logger: Logger | undefined;
let statusBar: vscode.StatusBarItem | undefined;
let statusRequestGeneration = 0;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const settings = readSettings();
  logger = new Logger(settings.logLevel);
  context.subscriptions.push(logger);

  context.subscriptions.push(
    vscode.commands.registerCommand('openvox.showLanguageServerLogs', () => logger?.show()),
    vscode.commands.registerCommand('openvox.restartLanguageServer', restartLanguageServer),
  );

  if (!settings.enabled) {
    logger.normal('Language server is disabled.');
    return;
  }

  const serverPath = resolveServerPath(context, settings);
  if (!fs.existsSync(serverPath)) {
    const message = `OpenVox language server was not found at '${serverPath}'. Run 'npm run vendor' when developing the extension.`;
    logger.error(message);
    void vscode.window.showErrorMessage(message, 'Show Logs').then((selection) => {
      if (selection === 'Show Logs') {
        logger?.show();
      }
    });
    return;
  }

  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 10);
  statusBar.name = 'OpenVox Language Server';
  statusBar.command = 'openvox.showLanguageServerLogs';
  statusBar.text = '$(sync~spin) OpenVox';
  statusBar.tooltip = 'OpenVox language server is starting';
  statusBar.show();
  context.subscriptions.push(statusBar);

  const serverOptions = createServerExecutable(context, settings);
  const runtimeValidation = validateOpenVoxRuntime(context, settings, serverOptions);
  const configuredInstallDirectory = hasConfiguredInstallDirectory(settings);
  if (!runtimeValidation.valid && !configuredInstallDirectory) {
    const message = 'OpenVox Agent is required for language-server features, but no usable OpenVox runtime was found.';
    logger.error(`${message} ${runtimeValidation.error ?? ''}`.trim());
    statusBar.text = '$(error) OpenVox missing';
    statusBar.tooltip = `${message}\n${runtimeValidation.error ?? ''}`.trim();
    void vscode.window.showErrorMessage(message, 'Open Settings', 'Show Logs').then((selection) => {
      if (selection === 'Open Settings') {
        void vscode.commands.executeCommand('workbench.action.openSettings', 'openvox.languageServer.installDirectory');
      } else if (selection === 'Show Logs') {
        logger?.show();
      }
    });
    return;
  }

  if (runtimeValidation.valid) {
    logger.normal(`Found OpenVox Agent runtime ${runtimeValidation.version}.`);
  } else {
    logger.warning(
      `Using configured OpenVox Agent install directory '${settings.installDirectory}' without successful runtime validation. ${runtimeValidation.error ?? ''}`.trim(),
    );
  }
  logger.debug(`Starting language server: ${serverOptions.command} ${serverOptions.args?.join(' ') ?? ''}`);

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: 'file', language: 'puppet' },
      { scheme: 'untitled', language: 'puppet' },
      { scheme: 'file', language: 'puppetfile' },
    ],
    outputChannel: logger.outputChannel,
    revealOutputChannelOn: RevealOutputChannelOn.Error,
  };

  client = new LanguageClient(
    'openvoxLanguageServer',
    'OpenVox Language Server',
    serverOptions,
    clientOptions,
  );
  context.subscriptions.push(client);
  client.onDidChangeState(({ newState }) => updateStatus(newState));

  await client.start();
  void refreshRuntimeStatus();
}

export async function deactivate(): Promise<void> {
  if (client) {
    statusRequestGeneration++;
    await client.stop();
    client = undefined;
  }
}

async function restartLanguageServer(): Promise<void> {
  if (!client) {
    void vscode.window.showInformationMessage('The OpenVox language server is not running.');
    return;
  }

  updateStatus(State.Starting);
  statusRequestGeneration++;
  await client.restart();
  void refreshRuntimeStatus();
}

function updateStatus(state: State): void {
  if (!statusBar) {
    return;
  }

  switch (state) {
    case State.Running:
      statusBar.text = '$(sync~spin) OpenVox';
      statusBar.tooltip = 'OpenVox language server is loading runtime data';
      break;
    case State.Starting:
      statusBar.text = '$(sync~spin) OpenVox';
      statusBar.tooltip = 'OpenVox language server is starting';
      break;
    case State.Stopped:
      statusBar.text = '$(error) OpenVox';
      statusBar.tooltip = 'OpenVox language server is stopped';
      break;
  }
}

async function refreshRuntimeStatus(): Promise<void> {
  if (!client || !statusBar) {
    return;
  }

  const generation = ++statusRequestGeneration;
  let lastDetails: RuntimeVersionDetails | undefined;

  for (let attempt = 0; attempt < 30; attempt++) {
    if (!client || generation !== statusRequestGeneration || client.state !== State.Running) {
      return;
    }

    try {
      lastDetails = await client.sendRequest(runtimeVersionRequest);
      updateRuntimeVersionStatus(lastDetails);

      if (runtimeDataLoaded(lastDetails)) {
        logger?.normal(
          `Runtime loaded: ${lastDetails.runtimeName} gem ${lastDetails.runtimeGemVersion}, Puppet API ${lastDetails.puppetVersion}, ${lastDetails.factRuntimeName} gem ${lastDetails.factRuntimeGemVersion}, Facter API ${lastDetails.facterVersion}, Language Server ${lastDetails.languageServerVersion}`,
        );
        return;
      }
    } catch (error) {
      logger?.debug(`Unable to query runtime version: ${String(error)}`);
    }

    await delay(1000);
  }

  if (lastDetails && generation === statusRequestGeneration) {
    updateRuntimeVersionStatus(lastDetails, true);
  }
}

function updateRuntimeVersionStatus(details: RuntimeVersionDetails, timedOut = false): void {
  if (!statusBar) {
    return;
  }

  const loaded = runtimeDataLoaded(details);
  const runtimeVersion = details.runtimeGemVersion || details.puppetVersion;
  statusBar.text = `${loaded ? '$(check)' : '$(sync~spin)'} OpenVox ${runtimeVersion}`;
  statusBar.tooltip = [
    `Runtime gem: ${details.runtimeName || 'unknown'}`,
    `Runtime gem version: ${details.runtimeGemVersion || 'Unknown'}`,
    `Puppet API version: ${details.puppetVersion}`,
    `Facts runtime: ${details.factRuntimeName || 'unknown'}`,
    `OpenFact gem version: ${details.factRuntimeGemVersion || 'Unknown'}`,
    `Facter compatibility API version: ${details.facterVersion}`,
    `Language Server version: ${details.languageServerVersion}`,
    `Classes: ${details.classesLoaded ? 'loaded' : 'loading'}`,
    `Facts: ${details.factsLoaded ? 'loaded' : 'loading'}`,
    `Functions: ${details.functionsLoaded ? 'loaded' : 'loading'}`,
    `Types: ${details.typesLoaded ? 'loaded' : 'loading'}`,
    ...(timedOut ? ['Runtime loading status timed out'] : []),
  ].join('\n');
}

function runtimeDataLoaded(details: RuntimeVersionDetails): boolean {
  return details.classesLoaded && details.factsLoaded && details.functionsLoaded && details.typesLoaded;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
