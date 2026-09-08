const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadTs(file, mocks = {}) {
  const { outputText } = ts.transpileModule(readFileSync(path.resolve(file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', outputText)((id) => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    throw new Error(`Missing isolated mock: ${id}`);
  }, loaded, loaded.exports);
  return loaded.exports;
}
const resignation = loadTs('src/app/employees/lib/resignation.ts');
const { getCurrentPayrollPeriod, getNewJoinEmployees } = loadTs('src/app/employees/lib/payroll.ts', { './resignation': resignation });
const { getEmployeeToday } = loadTs('src/app/employees/lib/age.ts', { './resignation': resignation });
const { createEmployeeSearch, getEmployeeFilterOptions } = loadTs('src/app/employees/lib/search.ts', { './resignation': resignation });
const iso = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const bounds = today => {
  const period = getCurrentPayrollPeriod(today);
  return period && [iso(period.start),iso(period.end)];
};

test('the current cycle includes August 21 through September 20 and rolls on September 21', () => {
  for (const today of ['2026-08-21','2026-08-31','2026-09-01','2026-09-08','2026-09-20']) {
    assert.deepEqual(bounds(today),['2026-08-21','2026-09-20'],today);
  }
  assert.deepEqual(bounds('2026-08-20'),['2026-07-21','2026-08-20']);
  assert.deepEqual(bounds('2026-09-21'),['2026-09-21','2026-10-20']);
});

test('cycles handle year changes, February, leap years and Buddhist dates', () => {
  for (const [today, expected] of [
    ['2026-12-21',['2026-12-21','2027-01-20']],
    ['2027-01-01',['2026-12-21','2027-01-20']],
    ['2027-01-21',['2027-01-21','2027-02-20']],
    ['2027-02-28',['2027-02-21','2027-03-20']],
    ['2028-02-29',['2028-02-21','2028-03-20']],
    ['08/09/2569',['2026-08-21','2026-09-20']],
  ]) assert.deepEqual(bounds(today),expected,today);
  for(const today of ['', '31/02/2026','invalid']) assert.equal(bounds(today),null);
});

test('both cutoff dates are inclusive, previous and next cycles and invalid starts are excluded', () => {
  const rows = ['2026-08-20','2026-08-21','2026-09-08','2026-09-20','2026-09-21',
    '21/08/2569','2569-09-20','2026-09-20T23:59:59+07:00','-','','31/08/2569','31/09/2569']
    .map((contractStart,index)=>({id:String(index),contractStart}));
  const result = getNewJoinEmployees(rows,getCurrentPayrollPeriod('2026-09-08'));
  assert.deepEqual(result.map(e=>e.id),['1','5','10','2','3','6','7']);
  assert.deepEqual(getNewJoinEmployees(rows,null),[]);
});

test('membership is based on start date, including scheduled starts and employees who departed in the cycle', () => {
  const rows = [
    {id:'00003',contractStart:'2026-09-20',status:'Active'},
    {id:'00002',contractStart:'2026-08-21',status:'Resigned'},
    {id:'00001',contractStart:'2026-08-21',status:'Active'},
  ];
  const snapshot = structuredClone(rows);
  const result = getNewJoinEmployees(rows,getCurrentPayrollPeriod('2026-09-08'));
  assert.deepEqual(result.map(e=>e.id),['00001','00002','00003']);
  assert.deepEqual(rows,snapshot,'Sorting never mutates shared directory records');
  assert.equal(result[0],rows[2]);
});

test('station, organization, numeric and date searches intersect the New Join cohort', () => {
  const rows = [
    {id:'02622',contractStart:'2026-08-21',name:'Test Employee',station:'BKK(PA)',department:'Ground Operations',phone:'0812345678'},
    {id:'02623',contractStart:'2026-09-20',name:'Second Employee',station:'HDQ',department:'Human Resources'},
    {id:'02624',contractStart:'2026-08-20',name:'Test Previous',station:'BKK(PA)',department:'Ground Operations'},
  ];
  const cohort=getNewJoinEmployees(rows,getCurrentPayrollPeriod('2026-09-08'));
  const search=createEmployeeSearch(cohort);
  for(const filters of [{stationFilter:'BKKPA'},{departmentFilter:'Ground Operations'},{searchQuery:'02622'},
    {searchQuery:'0812345678'},{searchQuery:'test',stationFilter:'BKKPA'}]) {
    assert.deepEqual(search(filters).map(e=>e.id),['02622']);
  }
  assert.deepEqual(search({startDateFilter:'2026-09-20',endDateFilter:'2026-09-20'}).map(e=>e.id),['02623']);
  assert.deepEqual(search({startDateFilter:'2026-08-20',endDateFilter:'2026-08-20'}),[]);
  assert.deepEqual(search({searchQuery:'previous'}),[]);
  assert.equal(getEmployeeFilterOptions(cohort).stations.length,2);
});

test('Thailand midnight on the 21st changes the payroll cycle even outside Thailand', () => {
  const before=getEmployeeToday(new Date('2026-09-20T16:59:59.999Z'));
  const after=getEmployeeToday(new Date('2026-09-20T17:00:00.000Z'));
  assert.deepEqual(bounds(before),['2026-08-21','2026-09-20']);
  assert.deepEqual(bounds(after),['2026-09-21','2026-10-20']);
});
