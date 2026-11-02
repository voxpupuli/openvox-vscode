import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../../out/formatting/provider.js', import.meta.url), 'utf8');
const require = createRequire(import.meta.url);
const core = require('../../out/formatting/core.js');

function loadProvider({ enabled, sendRequest }) {
  const vscode = {
    workspace: {
      getConfiguration: () => ({
        get: (name, defaultValue) =>
          name === 'format.puppetLint.enabled' ? enabled : defaultValue,
      }),
    },
    Range: class Range {
      constructor(start, end) {
        this.start = start;
        this.end = end;
      }
    },
    TextEdit: {
      replace: (range, newText) => ({ range, newText }),
    },
  };
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    require(name) {
      switch (name) {
        case 'vscode':
          return vscode;
        case 'vscode-languageclient/node':
          return {};
        case '../logging':
          return {};
        case '../messages':
          return { fixDiagnosticErrorsRequest: 'fixRequest' };
        case './core':
          return core;
        default:
          throw new Error(`Unexpected dependency: ${name}`);
      }
    },
  });

  const client = { sendRequest };
  const logger = { warning: () => undefined };
  return { provider: exports.providePuppetLintFormatting, client, logger };
}

function makeDocument({
  path = '/workspace/manifests/init.pp',
  languageId = 'puppet',
  text = 'class foo {}\n',
  version = 1,
} = {}) {
  const scheme = path.startsWith('untitled:') ? 'untitled' : 'file';
  return {
    languageId,
    uri: {
      scheme,
      fsPath: path,
      toString: () => `${scheme}://${path}`,
    },
    version,
    getText: () => text,
    positionAt: (offset) => offset,
  };
}

const token = { isCancellationRequested: false };
const options = { tabSize: 2, insertSpaces: true };

test('provider requests server formatting and returns a minimal edit', async () => {
  const requests = [];
  const { provider, client, logger } = loadProvider({
    enabled: true,
    sendRequest: async (...args) => {
      requests.push(args);
      return {
        documentUri: 'file:///workspace/manifests/init.pp',
        fixesApplied: 1,
        newContent: 'class foo {\n}\n',
      };
    },
  });

  const edits = await provider(
    client,
    makeDocument(),
    options,
    token,
    async () => [],
    logger,
  );

  assert.equal(requests[0][0], 'fixRequest');
  assert.deepEqual(requests[0][1], {
    documentUri: 'file:///workspace/manifests/init.pp',
    alwaysReturnContent: true,
  });
  assert.equal(edits.length, 1);
  assert.equal(edits[0].range.start, 11);
  assert.equal(edits[0].range.end, 11);
  assert.equal(edits[0].newText, '\n');
});

test('provider falls back when puppet-lint formatting is disabled', async () => {
  const fallback = [{ newText: 'fallback' }];
  let fallbackCalled = false;
  const { provider, client, logger } = loadProvider({
    enabled: false,
    sendRequest: async () => {
      throw new Error('server should not be called');
    },
  });

  const edits = await provider(
    client,
    makeDocument(),
    options,
    token,
    async () => {
      fallbackCalled = true;
      return fallback;
    },
    logger,
  );

  assert.equal(fallbackCalled, true);
  assert.deepEqual(edits, fallback);
});

test('provider leaves non-manifest documents to the existing formatter', async () => {
  const fallback = [{ newText: 'fallback' }];
  const { provider, client, logger } = loadProvider({
    enabled: true,
    sendRequest: async () => {
      throw new Error('server should not be called');
    },
  });

  const edits = await provider(
    client,
    makeDocument({ path: '/workspace/templates/init.epp' }),
    options,
    token,
    async () => fallback,
    logger,
  );

  assert.deepEqual(edits, fallback);
});

test('provider falls back when the server request fails', async () => {
  const fallback = [{ newText: 'fallback' }];
  let warning = '';
  const { provider, client } = loadProvider({
    enabled: true,
    sendRequest: async () => {
      throw new Error('server failed');
    },
  });

  const edits = await provider(
    client,
    makeDocument(),
    options,
    token,
    async () => fallback,
    { warning: (message) => (warning = message) },
  );

  assert.deepEqual(edits, fallback);
  assert.match(warning, /server failed/);
});

test('provider returns no edits when the formatted content is unchanged', async () => {
  const { provider, client, logger } = loadProvider({
    enabled: true,
    sendRequest: async () => ({
      documentUri: 'file:///workspace/manifests/init.pp',
      fixesApplied: 0,
      newContent: 'class foo {}\n',
    }),
  });

  const edits = await provider(
    client,
    makeDocument(),
    options,
    token,
    async () => [],
    logger,
  );

  assert.equal(edits.length, 0);
});
