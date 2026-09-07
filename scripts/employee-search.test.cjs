const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { NextRequest } = require('next/server');

function loadTs(file, mocks = {}) {
  const { outputText } = ts.transpileModule(readFileSync(path.resolve(file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', outputText)((id) => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id.startsWith('@/') || id.startsWith('./')) throw new Error(`Missing isolated mock: ${id}`);
    return require(id);
  }, loaded, loaded.exports);
  return loaded.exports;
}
const resignation = loadTs('src/app/employees/lib/resignation.ts');
const { createEmployeeSearch, filterEmployeeRecords, getEmployeeFilterOptions, matchesStation, matchesOrganization } = loadTs('src/app/employees/lib/search.ts', { './resignation': resignation });
const rows = [
  { id: '02622', name: 'นายทดสอบ ใจดี', nameEn: 'Mr. Test Employee', title: 'เจ้าหน้าที่ภาคพื้น / Ground Service Agent', department: 'ฝ่ายปฏิบัติการ / Ground Operation Department', division: 'Passenger Services', section: 'Station Service', unit: 'Ramp Service', station: 'กรุงเทพ / BKK(PA)', phone: '081-234-5678', idCard: '1-2345-67890-12-3', contractStart: '07/09/2569', resignDate: '08/09/2569' },
  { id: '100001', name: 'นางสาวพนักงาน ทดสอบ', nameEn: 'Second Employee', title: 'HR Officer', department: 'Ground Operation Department Support', station: 'BKK(GC)', phone: '0890000000', contractStart: '2026-09-08', separationDate: '2026-09-09' },
  { id: '00333', name: 'Unrelated', nameEn: '', station: 'BKK', contractStart: '31/02/2569' },
];
const ids = (filters) => filterEmployeeRecords(rows, filters).map((row) => row.id);

test('cached search preserves every search mode across repeated queries and refreshed data', () => {
  const search = createEmployeeSearch(rows);
  const filters = [{}, {searchQuery:'test employee'}, {searchQuery:'02622'}, {searchQuery:'0812345678'},
    {searchQuery:'BKKPA'}, {searchQuery:'ทดสอบ ใจดี'}, {stationFilter:'BKKGC'},
    {departmentFilter:'Ground Operation Department (GF)'}, {dateField:'departure',startDateFilter:'2026-09-09'},
    {searchQuery:'missing'}, {searchQuery:'TEST',stationFilter:'BKKPA'}];
  for(let repeat=0;repeat<3;repeat++)for(const filter of filters)assert.deepEqual(search(filter),filterEmployeeRecords(rows,filter));
  assert.equal(search({}).length,rows.length);
  const refreshed=rows.map((row,i)=>i?row:{...row,name:'Updated Person',nameEn:'Updated Person'});
  assert.deepEqual(createEmployeeSearch(refreshed)({searchQuery:'Updated Person'}).map(row=>row.id),['02622']);
  assert.deepEqual(search({searchQuery:'Updated Person'}),[]);
  let normalizations=0;
  const measured=createEmployeeSearch([{id:'1',name:{toString(){normalizations++;return 'Measured Person';}}}]);
  for(const searchQuery of ['measured','person','missing','1'])measured({searchQuery});
  assert.equal(normalizations,1,'Repeated searches reuse normalized names');
});

test('station filters accept formatting and language variants without mixing stations', () => {
  for (const stationFilter of ['BKKPA', ' bkk(pa) ', 'BKK PA', 'กรุงเทพ / BKKPA']) assert.deepEqual(ids({ stationFilter }), ['02622']);
  assert.deepEqual(ids({ stationFilter: 'BKK' }), ['00333']);
  assert.deepEqual(ids({ stationFilter: 'BKKGC' }), ['100001']);
  assert.equal(matchesStation(undefined, 'BKKPA'), false);
  assert.deepEqual(ids({ stationFilter: '' }), ['02622', '100001', '00333']);
});

test('organization filters match full bilingual names and optional codes', () => {
  assert.deepEqual(ids({ departmentFilter: ' ground operation department (GF) ' }), ['02622']);
  assert.equal(matchesOrganization('Engineering Support', 'Engineering'), false);
  assert.equal(matchesOrganization('Engineering (A)', 'Engineering (B)'), false);
  assert.deepEqual(ids({ departmentFilter: 'Ground Operation Department (GF)', divisionFilter: 'Passenger Services', sectionFilter: 'Station Service', unitFilter: 'Ramp Service', stationFilter: 'BKKPA' }), ['02622']);
});

test('dropdowns contain actual employee groups, not empty master-data groups', () => {
  const records = [
    { id: '1', department: 'Operations', station: 'BKK(PA)' },
    { id: '2', department: 'Operations', station: 'bkk pa' },
    { id: '3', department: 'Employee-only Department', station: 'CJM' },
    { id: '4', department: '-', station: 'null' },
  ];
  const options = getEmployeeFilterOptions(records, {}, {
    department: ['Operations (GF)', 'Empty Department (ZZ)'],
    station: ['BKKPA', 'UTP'],
  });
  assert.deepEqual(options.departments, ['Employee-only Department', 'Operations (GF)']);
  assert.deepEqual(options.stations, ['BKKPA', 'CJM']);
  assert.deepEqual(filterEmployeeRecords(records, { stationFilter: 'BKKPA' }).map((row) => row.id), ['1', '2']);
  for (const [field, values] of Object.entries(options)) {
    const filter = { departments: 'departmentFilter', divisions: 'divisionFilter', sections: 'sectionFilter', units: 'unitFilter', stations: 'stationFilter' }[field];
    for (const value of values) assert.ok(filterEmployeeRecords(records, { [filter]: value }).length, `${field}: ${value}`);
  }
});

test('employee-derived dropdowns work without organization data and cascade by hierarchy', () => {
  const records = [
    { department: 'Operations', division: 'Ground', section: 'Passenger', unit: 'Gate', station: 'BKKPA' },
    { department: 'Operations', division: 'Ground', section: 'Ramp', unit: 'Load', station: 'BKKPA' },
    { department: 'Support', division: 'People', section: 'HR', unit: 'Payroll', station: 'HDQ' },
  ];
  assert.deepEqual(getEmployeeFilterOptions(records).departments, ['Operations', 'Support']);
  const options = getEmployeeFilterOptions(records, { departmentFilter: 'Operations', divisionFilter: 'Ground', sectionFilter: 'Passenger' });
  assert.deepEqual(options.divisions, ['Ground']);
  assert.deepEqual(options.sections, ['Passenger', 'Ramp']);
  assert.deepEqual(options.units, ['Gate']);
  assert.deepEqual(getEmployeeFilterOptions([], {}, { station: ['HDQ'] }), { departments: [], divisions: [], sections: [], units: [], stations: [] });
});

test('text search covers names, positions, stations and organization components', () => {
  for (const searchQuery of ['  ใจดี   ทดสอบ ', ' employee   TEST ', 'test\u200b employee', 'Ground agent', 'Ramp Service', 'BKKPA', '02622 Ground']) {
    assert.deepEqual(ids({ searchQuery }), ['02622'], searchQuery);
  }
  assert.deepEqual(ids({ searchQuery: 'HR Officer' }), ['100001']);
  assert.deepEqual(ids({ searchQuery: 'TEST', stationFilter: 'BKKGC' }), []);
  assert.deepEqual(ids({ searchQuery: 'missing employee' }), []);
});

test('numeric search supports long employee IDs and formatted telephone/ID numbers', () => {
  for (const searchQuery of ['@02622', '02622', '0812345678', '081-234 5678', '1234567890123']) assert.deepEqual(ids({ searchQuery }), ['02622']);
  assert.deepEqual(ids({ searchQuery: '100001' }), ['100001']);
  assert.deepEqual(filterEmployeeRecords([{ id: '1', phone: 812345678 }], { searchQuery: '812345678' }).map((row) => row.id), ['1']);
});

test('date filters include both boundaries, Buddhist dates and alternate resignation dates', () => {
  assert.deepEqual(ids({ startDateFilter: '2026-09-07', endDateFilter: '2026-09-08' }), ['02622', '100001']);
  assert.deepEqual(ids({ startDateFilter: '2026-09-07', endDateFilter: '2026-09-07' }), ['02622']);
  assert.deepEqual(ids({ dateField: 'departure', startDateFilter: '2026-09-09', endDateFilter: '2026-09-09' }), ['100001']);
  assert.deepEqual(ids({ startDateFilter: '2026-09-10', endDateFilter: '2026-09-01' }), []);
  assert.deepEqual(ids({ startDateFilter: 'invalid' }), []);
  assert.deepEqual(ids({ endDateFilter: '2026-09-07' }), ['02622']);
});

test('employee list API preserves first and last names across all DynamoDB pages', async () => {
  const calls = [];
  const cache = loadTs('src/lib/employeesCache.ts');
  const records = [
    { staff_id: '1', first_name_th: 'ทดสอบ', last_name_th: 'ใจดี', first_name_en: 'Test', last_name_en: 'Employee', bank_account: 'NOT_IN_LIST' },
    { staff_id: '2', first_name_th: 'พนักงาน', last_name_th: 'คนที่สอง' },
  ];
  const route = loadTs('src/app/api/employees/route.ts', {
    '@/lib/employeesCache': cache,
    '@/lib/auth-session': { authorizeRequest: async () => ({ ok: true }) },
    '@/lib/dynamodb': { docClient: { send: async (command) => {
      calls.push(command.input);
      const projected = Object.values(command.input.ExpressionAttributeNames);
      const row = records[calls.length - 1];
      return { Items: [Object.fromEntries(projected.filter((key) => key in row).map((key) => [key, row[key]]))], ...(calls.length === 1 ? { LastEvaluatedKey: { staff_id: '1' } } : {}) };
    } } },
  });
  const response = await route.GET(new NextRequest('http://localhost/api/employees'));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(calls.length, 2);
  assert.equal(result[0].first_name_th, 'ทดสอบ');
  assert.equal(result[0].last_name_en, 'Employee');
  assert.equal(result[0].bank_account, undefined);
  assert.equal(result[1].last_name_th, 'คนที่สอง');
});

test('employee search still requires View permission before any database request', async () => {
  const route = loadTs('src/app/api/employees/route.ts', {
    '@/lib/employeesCache': loadTs('src/lib/employeesCache.ts'),
    '@/lib/auth-session': { authorizeRequest: async (_request, permission) => {
      assert.equal(permission, 'view');
      return { ok: false, response: Response.json({ error: 'Denied' }, { status: 403 }) };
    } },
    '@/lib/dynamodb': { docClient: { send: () => { throw new Error('Unauthorized database read'); } } },
  });
  assert.equal((await route.GET(new NextRequest('http://localhost/api/employees'))).status, 403);
});
