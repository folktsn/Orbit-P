const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

function loadTs(file, mocks = {}) {
  const { outputText } = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', outputText)((name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    throw new Error(`Unexpected dependency: ${name}`);
  }, loaded, loaded.exports);
  return loaded.exports;
}

const departure = loadTs('src/app/employees/lib/resignation.ts');
const headcount = loadTs('src/lib/employee-headcount.ts', { '@/app/employees/lib/resignation': departure });
const { getActiveEmployees } = loadTs('src/app/employees/lib/employment.ts', { '@/lib/employee-headcount': headcount });
const { createEmployeeSearch, getEmployeeFilterOptions } = loadTs('src/app/employees/lib/search.ts', { './resignation': departure });
const { getEmployeeToday } = loadTs('src/app/employees/lib/age.ts', { './resignation': departure });
const today = '2026-09-18';
const ids = (rows, date = today) => getActiveEmployees(rows, date).map((row) => row.id);
const pending = {
  id: '00585', status: 'Pending', contractStart: '2020-01-01', resignDate: '2026-09-20',
  name: 'นายทดสอบ ใจดี', nameEn: 'Mr. Test Employee',
  department: 'Ground Operation Department', station: 'UTH',
};

test('pending employees remain searchable in Active by ID and name, with their organization filters', () => {
  const rows = getActiveEmployees([
    pending,
    { id: '00200', status: 'Active', station: 'HDQ' },
    { ...pending, id: '00300', status: 'Resign' },
  ], today);
  const search = createEmployeeSearch(rows);
  for (const searchQuery of ['00585', 'ทดสอบ ใจดี', 'test employee']) {
    assert.deepEqual(search({ searchQuery }).map((row) => row.id), ['00585']);
  }
  assert.deepEqual(search({ searchQuery: '00585', departmentFilter: 'Ground Operation Department', stationFilter: 'UTH' }).map((row) => row.id), ['00585']);
  assert.ok(getEmployeeFilterOptions(rows).stations.includes('UTH'));
  assert.equal(rows[0].status, 'Pending', 'Showing an employee in Active must not rewrite their stored status');
  assert.equal(departure.isDepartureRecord(rows[0]), true, 'Pending departure also remains visible in Resign');
});

test('Active includes scheduled departures until the effective date, using the Thailand day', () => {
  const record = { ...pending, resignDate: '20/09/2569' };
  assert.deepEqual(ids([record], getEmployeeToday(new Date('2026-09-19T16:59:59Z'))), ['00585']);
  assert.deepEqual(ids([record], getEmployeeToday(new Date('2026-09-19T17:00:00Z'))), []);
  assert.deepEqual(ids([record], '2026-09-21'), []);
  assert.deepEqual(ids([{ ...pending, status: ' Resigning ' }]), ['00585']);
});

test('alternate departure dates and missing status fallbacks match company headcount', () => {
  for (const field of ['lastWorkingDate', 'lastWorkDate', 'separationDate']) {
    assert.deepEqual(ids([{ ...pending, resignDate: '-', [field]: '20/09/2569' }]), ['00585']);
    assert.deepEqual(ids([{ ...pending, resignDate: '-', [field]: '18/09/2569' }]), []);
  }
  assert.deepEqual(ids([{ ...pending, status: undefined, resignStatus: 'Pending' }]), ['00585']);
  assert.deepEqual(ids([{ id: 'legacy' }]), ['legacy']);
});

test('future starters, completed departures and invalid pending dates stay outside Active', () => {
  for (const status of ['Resign', 'Resigned', 'Failed Probation', 'Inactive', 'Retired', 'Terminated']) {
    assert.deepEqual(ids([{ ...pending, status }]), [], status);
  }
  for (const resignDate of [undefined, '-', 'invalid', '31/02/2569', today, '2026-09-17']) {
    assert.deepEqual(ids([{ ...pending, resignDate }]), [], String(resignDate));
  }
  for (const status of ['Pending', 'Active']) {
    assert.deepEqual(ids([{ ...pending, status, contractStart: '2026-09-19' }]), []);
    assert.deepEqual(ids([{ ...pending, status, contractStart: today }]), ['00585']);
  }
  assert.deepEqual(ids([{ ...pending, status: 'Active', resignDate: today }]), []);
});
