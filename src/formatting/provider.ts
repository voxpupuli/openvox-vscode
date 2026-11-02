import * as vscode from 'vscode';
import {
  LanguageClient,
  ProvideDocumentFormattingEditsSignature,
} from 'vscode-languageclient/node';
import { Logger } from '../logging';
import { fixDiagnosticErrorsRequest } from '../messages';
import {
  formatDocumentWithServer,
  isPuppetManifestPath,
  TextReplacement,
} from './core';

export async function providePuppetLintFormatting(
  client: LanguageClient,
  document: vscode.TextDocument,
  options: vscode.FormattingOptions,
  token: vscode.CancellationToken,
  next: ProvideDocumentFormattingEditsSignature,
  logger: Logger,
): Promise<vscode.TextEdit[]> {
  const configuration = vscode.workspace.getConfiguration('openvox', document.uri);
  const enabled = configuration.get<boolean>('format.puppetLint.enabled', true);

  if (
    !enabled ||
    !isPuppetManifestPath(document.languageId, document.uri.scheme, document.uri.fsPath)
  ) {
    return (await next(document, options, token)) ?? [];
  }

  const version = document.version;

  try {
    const replacement = await formatDocumentWithServer(
      {
        uri: document.uri.toString(),
        text: document.getText(),
        version,
      },
      {
        sendRequest: (params) => client.sendRequest(fixDiagnosticErrorsRequest, params, token),
        isCancelled: () => token.isCancellationRequested,
        getVersion: () => document.version,
      },
    );

    return replacement ? [toTextEdit(document, replacement)] : [];
  } catch (error) {
    logger.warning(
      `puppet-lint formatting failed for ${document.uri.toString()}: ${String(error)}`,
    );
    return (await next(document, options, token)) ?? [];
  }
}

function toTextEdit(
  document: vscode.TextDocument,
  replacement: TextReplacement,
): vscode.TextEdit {
  return vscode.TextEdit.replace(
    new vscode.Range(
      document.positionAt(replacement.startOffset),
      document.positionAt(replacement.endOffset),
    ),
    replacement.newText,
  );
}
