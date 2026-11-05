import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const packageJson = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
const properties = packageJson.contributes.configuration.properties;

const expectedSettings = {
  'openvox.editorService.formatOnType.enable': { type: 'boolean', default: true },
  'openvox.editorService.formatOnType.maxFileSize': { type: 'integer', default: 16384, minimum: 0 },
  'openvox.editorService.foldingRange.enable': { type: 'boolean', default: true },
  'openvox.editorService.foldingRange.showLastLine': { type: 'boolean', default: true },
  'openvox.validate.resolvePuppetfiles': { type: 'boolean', default: true },
};

function nestedSettings() {
  const result = {};

  for (const [key, definition] of Object.entries(properties)) {
    const path = key.split('.');
    if (path.shift() !== 'openvox') {
      continue;
    }

    let target = result;
    for (const segment of path.slice(0, -1)) {
      target[segment] ??= {};
      target = target[segment];
    }
    target[path.at(-1)] = definition.default;
  }

  return result;
}

test('editor settings expose the expected types and defaults', () => {
  for (const [key, expected] of Object.entries(expectedSettings)) {
    const property = properties[key];

    assert.ok(property, `missing setting ${key}`);
    assert.equal(property.type, expected.type, `${key} has the wrong type`);
    assert.equal(property.default, expected.default, `${key} has the wrong default`);
    assert.equal(property.minimum, expected.minimum, `${key} has the wrong minimum`);
  }
});

test('editor settings use window scope', () => {
  for (const key of Object.keys(expectedSettings)) {
    assert.equal(properties[key].scope, undefined, `${key} should not be resource-scoped`);
  }
});

test('editor settings map to the nested configuration shape requested by the language server', () => {
  const settings = nestedSettings();

  assert.deepEqual(settings.editorService.formatOnType, { enable: true, maxFileSize: 16384 });
  assert.deepEqual(settings.editorService.foldingRange, { enable: true, showLastLine: true });
  assert.deepEqual(settings.validate, { resolvePuppetfiles: true });
});
