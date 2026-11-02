import * as path from 'node:path';
import { FixDiagnosticErrorsParams, FixDiagnosticErrorsResult } from './types';

export interface TextReplacement {
  startOffset: number;
  endOffset: number;
  newText: string;
}

export interface FormatDocumentState {
  uri: string;
  text: string;
  version: number;
}

export interface FormatDocumentDependencies {
  sendRequest(params: FixDiagnosticErrorsParams): Promise<FixDiagnosticErrorsResult>;
  isCancelled(): boolean;
  getVersion(): number;
}

export function isPuppetManifestPath(languageId: string, scheme: string, fsPath: string): boolean {
  return (
    languageId === 'puppet' &&
    scheme !== 'untitled' &&
    path.extname(fsPath).toLowerCase() === '.pp'
  );
}

export function computeMinimalReplacement(
  original: string,
  formatted: string,
): TextReplacement | undefined {
  if (original === formatted) {
    return undefined;
  }

  const maxPrefix = Math.min(original.length, formatted.length);
  let startOffset = 0;
  while (startOffset < maxPrefix && original[startOffset] === formatted[startOffset]) {
    startOffset++;
  }

  let endOffset = original.length;
  let formattedEnd = formatted.length;
  while (
    endOffset > startOffset &&
    formattedEnd > startOffset &&
    original[endOffset - 1] === formatted[formattedEnd - 1]
  ) {
    endOffset--;
    formattedEnd--;
  }

  return {
    startOffset,
    endOffset,
    newText: formatted.slice(startOffset, formattedEnd),
  };
}

export async function formatDocumentWithServer(
  document: FormatDocumentState,
  dependencies: FormatDocumentDependencies,
): Promise<TextReplacement | undefined> {
  if (dependencies.isCancelled()) {
    return undefined;
  }

  const result = await dependencies.sendRequest({
    documentUri: document.uri,
    alwaysReturnContent: true,
  });

  if (dependencies.isCancelled() || dependencies.getVersion() !== document.version) {
    return undefined;
  }
  if (result.newContent === undefined || result.newContent === null) {
    return undefined;
  }

  return computeMinimalReplacement(document.text, result.newContent);
}
