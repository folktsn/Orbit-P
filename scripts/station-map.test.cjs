const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const { outputText } = ts.transpileModule(readFileSync('src/app/components/station-map-data.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const compiled = { exports: {} };
new Function('module', 'exports', outputText)(compiled, compiled.exports);
const { STATION_LOCATIONS, STATION_COUNT, MAP_VIEWBOX, projectStation } = compiled.exports;

test('the map represents the exact 16-code roster and shares Suvarnabhumi without dropping BKKPA', () => {
  const codes = STATION_LOCATIONS.flatMap(location => location.codes);
  assert.deepEqual([...codes].sort(), ['HDQ', 'BKKPA', 'BKK', 'DMK', 'CEI', 'CNX', 'UTH', 'UBP', 'KKC', 'UTP', 'HKT', 'URT', 'CJM', 'HDY', 'KBV', 'NST'].sort());
  assert.equal(new Set(codes).size, 16);
  assert.equal(STATION_COUNT, 16);
  assert.equal(STATION_LOCATIONS.length, 15);
  assert.deepEqual(STATION_LOCATIONS.find(location => location.codes.includes('BKKPA')).codes, ['BKKPA', 'BKK']);
  assert.deepEqual(STATION_LOCATIONS.filter(location => location.headquarters).map(location => location.id), ['HDQ']);
});

test('the projection aligns with an existing Natural Earth boundary vertex in the SVG', () => {
  // First mainland vertex: [longitude, latitude] = [100.122461, 20.31665].
  const point = projectStation(20.31665, 100.122461);
  const svg = readFileSync('public/dashboard/thailand.svg', 'utf8');
  assert.ok(svg.includes('M356.34,35.62'));
  assert.ok(Math.abs(point.x - 356.34) < .01);
  assert.ok(Math.abs(point.y - 35.62) < .01);
});

test('all markers and label anchors fit the map and retain north/south and east/west orientation', () => {
  for (const location of STATION_LOCATIONS) {
    const { x, y } = projectStation(location.latitude, location.longitude);
    for (const [px, py] of [[x, y], location.label]) {
      assert.ok(px > MAP_VIEWBOX.x && px < MAP_VIEWBOX.x + MAP_VIEWBOX.width, location.id);
      assert.ok(py > MAP_VIEWBOX.y && py < MAP_VIEWBOX.y + MAP_VIEWBOX.height, location.id);
    }
  }
  const point = code => { const location = STATION_LOCATIONS.find(item => item.id === code); return projectStation(location.latitude, location.longitude); };
  assert.ok(point('CEI').y < point('CNX').y && point('CNX').y < point('BKK').y && point('BKK').y < point('HDY').y);
  assert.ok(point('HKT').x < point('KBV').x && point('KKC').x < point('UBP').x);
});
