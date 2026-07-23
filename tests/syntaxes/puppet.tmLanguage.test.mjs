import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import oniguruma from 'vscode-oniguruma';
import textmate from 'vscode-textmate';

const { loadWASM, OnigScanner, OnigString } = oniguruma;
const { parseRawGrammar, Registry } = textmate;

const require = createRequire(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const grammarPath = path.join(repositoryRoot, 'syntaxes/puppet.tmLanguage');

await loadWASM(fs.readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm')).buffer);

const registry = new Registry({
  onigLib: Promise.resolve({
    createOnigScanner: (patterns) => new OnigScanner(patterns),
    createOnigString: (value) => new OnigString(value),
  }),
  loadGrammar: async (scopeName) => {
    if (scopeName !== 'source.puppet') {
      return null;
    }

    return parseRawGrammar(fs.readFileSync(grammarPath, 'utf8'), grammarPath);
  },
});

const grammar = await registry.loadGrammar('source.puppet');

function tokenizeLines(lines) {
  let ruleStack = null;

  return lines.map((line) => {
    const result = grammar.tokenizeLine(line, ruleStack);
    ruleStack = result.ruleStack;

    return result.tokens.map((token) => ({
      text: line.slice(token.startIndex, token.endIndex),
      scopes: token.scopes,
    }));
  });
}

test('a dot method before a block does not open a resource title scope', () => {
  const tokenizedLines = tokenizeLines([
    'if $foo.empty {',
    '  $bar = true',
    '}',
    '$baz = false',
  ]);

  for (const tokens of tokenizedLines) {
    for (const token of tokens) {
      assert.equal(
        token.scopes.includes('entity.name.section.puppet'),
        false,
        `${JSON.stringify(token.text)} was incorrectly tokenized as a resource title`,
      );
    }
  }
});

test('resource declarations still open a resource title scope', () => {
  const [declarationTokens] = tokenizeLines(["file { 'example':"]);

  assert.ok(
    declarationTokens.some((token) => token.scopes.includes('meta.definition.resource.puppet')),
    'the resource type was not recognized',
  );
  assert.ok(
    declarationTokens.some((token) => token.scopes.includes('entity.name.section.puppet')),
    'the resource title was not recognized',
  );
});
