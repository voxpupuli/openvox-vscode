import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const {
  computeMinimalReplacement,
  formatDocumentWithServer,
  isPuppetManifestPath,
} = require('../../out/formatting/core.js');

function applyReplacement(original, replacement) {
  return (
    original.slice(0, replacement.startOffset) +
    replacement.newText +
    original.slice(replacement.endOffset)
  );
}

test('identical text produces no replacement', () => {
  assert.equal(computeMinimalReplacement('class foo {}\n', 'class foo {}\n'), undefined);
});

test('appended text produces a replacement at the end', () => {
  const original = 'class foo {}\n';
  const formatted = 'class foo {}\n\n';
  const replacement = computeMinimalReplacement(original, formatted);

  assert.equal(replacement.startOffset, original.length);
  assert.equal(replacement.endOffset, original.length);
  assert.equal(applyReplacement(original, replacement), formatted);
});

test('prepended text produces a replacement at the start', () => {
  const original = 'class foo {}\n';
  const formatted = '# frozen_string_literal: true\nclass foo {}\n';
  const replacement = computeMinimalReplacement(original, formatted);

  assert.equal(replacement.startOffset, 0);
  assert.equal(replacement.endOffset, 0);
  assert.equal(applyReplacement(original, replacement), formatted);
});

test('changed text in the middle produces a minimal replacement', () => {
  const original = 'hello world';
  const formatted = 'hello brave world';
  const replacement = computeMinimalReplacement(original, formatted);

  assert.equal(replacement.startOffset, 6);
  assert.equal(replacement.endOffset, 6);
  assert.equal(replacement.newText, 'brave ');
  assert.equal(applyReplacement(original, replacement), formatted);
});

test('CRLF line endings are preserved', () => {
  const original = 'a\r\nb\r\n';
  const formatted = 'a\r\nb\r\nc\r\n';
  const replacement = computeMinimalReplacement(original, formatted);

  assert.equal(applyReplacement(original, replacement), formatted);
});

test('multiple separated changes become one contiguous replacement', () => {
  const original = 'a\nb\nc\n';
  const formatted = 'A\nb\nC\n';
  const replacement = computeMinimalReplacement(original, formatted);

  assert.equal(applyReplacement(original, replacement), formatted);
});

test('puppet manifest paths are recognized', () => {
  assert.equal(isPuppetManifestPath('puppet', 'file', '/workspace/manifests/init.pp'), true);
  assert.equal(isPuppetManifestPath('puppet', 'file', '/workspace/manifests/init.PP'), true);
  assert.equal(isPuppetManifestPath('puppet', 'vscode-remote', '/workspace/manifests/init.pp'), true);
});

test('non-manifest documents are ignored', () => {
  assert.equal(isPuppetManifestPath('puppet', 'file', '/workspace/templates/init.epp'), false);
  assert.equal(isPuppetManifestPath('puppetfile', 'file', '/workspace/Puppetfile'), false);
  assert.equal(isPuppetManifestPath('puppet', 'untitled', 'Untitled-1'), false);
  assert.equal(isPuppetManifestPath('puppet', 'file', ''), false);
});

test('server formatting sends the document URI and always returns content', async () => {
  const requests = [];
  const replacement = await formatDocumentWithServer(
    {
      uri: 'file:///workspace/manifests/init.pp',
      text: 'class foo {}\n',
      version: 3,
    },
    {
      sendRequest: async (params) => {
        requests.push(params);
        return {
          documentUri: params.documentUri,
          fixesApplied: 1,
          newContent: 'class foo {\n}\n',
        };
      },
      isCancelled: () => false,
      getVersion: () => 3,
    },
  );

  assert.deepEqual(requests, [
    {
      documentUri: 'file:///workspace/manifests/init.pp',
      alwaysReturnContent: true,
    },
  ]);
  assert.equal(
    applyReplacement('class foo {}\n', replacement),
    'class foo {\n}\n',
  );
});

test('server formatting returns no replacement when content is unchanged', async () => {
  const replacement = await formatDocumentWithServer(
    {
      uri: 'file:///workspace/manifests/init.pp',
      text: 'class foo {}\n',
      version: 1,
    },
    {
      sendRequest: async () => ({
        documentUri: 'file:///workspace/manifests/init.pp',
        fixesApplied: 0,
        newContent: 'class foo {}\n',
      }),
      isCancelled: () => false,
      getVersion: () => 1,
    },
  );

  assert.equal(replacement, undefined);
});

test('server formatting returns no replacement when the server omits content', async () => {
  const replacement = await formatDocumentWithServer(
    {
      uri: 'file:///workspace/manifests/init.pp',
      text: 'class foo {}\n',
      version: 1,
    },
    {
      sendRequest: async () => ({
        documentUri: 'file:///workspace/manifests/init.pp',
        fixesApplied: 0,
      }),
      isCancelled: () => false,
      getVersion: () => 1,
    },
  );

  assert.equal(replacement, undefined);
});

test('server formatting returns no replacement when the server returns null content', async () => {
  const replacement = await formatDocumentWithServer(
    {
      uri: 'file:///workspace/manifests/init.pp',
      text: 'class foo {}\n',
      version: 1,
    },
    {
      sendRequest: async () => ({
        documentUri: 'file:///workspace/manifests/init.pp',
        fixesApplied: 0,
        newContent: null,
      }),
      isCancelled: () => false,
      getVersion: () => 1,
    },
  );

  assert.equal(replacement, undefined);
});

test('server formatting is skipped when already cancelled', async () => {
  let requested = false;
  const replacement = await formatDocumentWithServer(
    {
      uri: 'file:///workspace/manifests/init.pp',
      text: 'class foo {}\n',
      version: 1,
    },
    {
      sendRequest: async () => {
        requested = true;
        return {
          documentUri: 'file:///workspace/manifests/init.pp',
          fixesApplied: 1,
          newContent: 'class foo {\n}\n',
        };
      },
      isCancelled: () => true,
      getVersion: () => 1,
    },
  );

  assert.equal(requested, false);
  assert.equal(replacement, undefined);
});

test('server formatting is discarded when cancelled during the request', async () => {
  let cancelled = false;
  const replacement = await formatDocumentWithServer(
    {
      uri: 'file:///workspace/manifests/init.pp',
      text: 'class foo {}\n',
      version: 1,
    },
    {
      sendRequest: async () => {
        cancelled = true;
        return {
          documentUri: 'file:///workspace/manifests/init.pp',
          fixesApplied: 1,
          newContent: 'class foo {\n}\n',
        };
      },
      isCancelled: () => cancelled,
      getVersion: () => 1,
    },
  );

  assert.equal(replacement, undefined);
});

test('server formatting is discarded when the document changes during the request', async () => {
  let version = 1;
  const replacement = await formatDocumentWithServer(
    {
      uri: 'file:///workspace/manifests/init.pp',
      text: 'class foo {}\n',
      version,
    },
    {
      sendRequest: async () => {
        version = 2;
        return {
          documentUri: 'file:///workspace/manifests/init.pp',
          fixesApplied: 1,
          newContent: 'class foo {\n}\n',
        };
      },
      isCancelled: () => false,
      getVersion: () => version,
    },
  );

  assert.equal(replacement, undefined);
});

test('server formatting propagates request errors', async () => {
  await assert.rejects(
    formatDocumentWithServer(
      {
        uri: 'file:///workspace/manifests/init.pp',
        text: 'class foo {}\n',
        version: 1,
      },
      {
        sendRequest: async () => {
          throw new Error('server failed');
        },
        isCancelled: () => false,
        getVersion: () => 1,
      },
    ),
    /server failed/,
  );
});
