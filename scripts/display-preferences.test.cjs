const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const { outputText } = ts.transpileModule(readFileSync('src/lib/display-preferences.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const loaded = { exports: {} };
new Function('module', 'exports', outputText)(loaded, loaded.exports);
const { normalizeDisplayPreferences, parseDisplayPreferences } = loaded.exports;
const defaults = { fontScale: 100, reduceMotion: false };

test('missing, invalid and malformed saved preferences use defaults', () => {
  for (const value of [null, '', 'invalid', 'null', '[]', '42', '{}', '{"fontScale":"130","reduceMotion":"true"}']) {
    assert.deepEqual(parseDisplayPreferences(value), defaults);
  }
});

test('font scale is finite, bounded and rounded to supported steps', () => {
  for (const [input, expected] of [[0, 90], [89, 90], [94, 90], [95, 100], [115, 120], [130, 130], [200, 130], [NaN, 100], [Infinity, 100]]) {
    assert.equal(normalizeDisplayPreferences({ fontScale: input }).fontScale, expected);
  }
});

test('valid preferences round trip without admitting unrelated settings', () => {
  const preferences = { fontScale: 120, reduceMotion: true };
  assert.deepEqual(parseDisplayPreferences(JSON.stringify(preferences)), preferences);
  assert.deepEqual(normalizeDisplayPreferences({ ...preferences, admin: true, pageAccess: { dataQuality: true } }), preferences);
});
