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
const { getEmployeeAge, getEmployeeToday, millisecondsToNextEmployeeDay } = loadTs('src/app/employees/lib/age.ts', { './resignation': resignation });

test('age increments on the birthday, not at the start of the year', () => {
  for (const [today, expected] of [['2026-01-01',35],['2026-09-07',35],['2026-09-08',36],['2026-09-09',36],['2027-01-01',36]]) {
    assert.equal(getEmployeeAge('1990-09-08',today),expected,today);
  }
  assert.equal(getEmployeeAge('2000-01-01','2026-01-01'),26);
  assert.equal(getEmployeeAge('2000-12-31','2026-12-30'),25);
  assert.equal(getEmployeeAge('2000-12-31','2026-12-31'),26);
});

test('Gregorian, Buddhist, day-first and ISO dates calculate the same age', () => {
  for (const birth of ['1990-09-08','08/09/1990','08.09.2533','2533-09-08','1990-09-08T00:00:00.000Z']) {
    assert.equal(getEmployeeAge(birth,'2026-09-08'),36,birth);
  }
});

test('missing, invalid or future birth dates do not invent an age', () => {
  for (const birth of [null,undefined,'','-','null','undefined','31/02/2000','2025-02-29','2000-13-01','2026-09-09','not a date']) {
    assert.equal(getEmployeeAge(birth,'2026-09-08'),null,String(birth));
  }
  assert.equal(getEmployeeAge('2026-09-08','2026-09-08'),0);
  assert.equal(getEmployeeAge('1990-09-08',''),null);
});

test('February 29 birthdays advance on March 1 in non-leap years', () => {
  assert.equal(getEmployeeAge('2000-02-29','2026-02-28'),25);
  assert.equal(getEmployeeAge('2000-02-29','2026-03-01'),26);
  assert.equal(getEmployeeAge('2000-02-29','2028-02-28'),27);
  assert.equal(getEmployeeAge('2000-02-29','2028-02-29'),28);
});

test('age changes at Thailand midnight even on devices in another time zone', () => {
  const before = new Date('2026-09-07T16:59:59.999Z');
  const birthday = new Date('2026-09-07T17:00:00.000Z');
  assert.equal(getEmployeeToday(before),'2026-09-07');
  assert.equal(getEmployeeToday(birthday),'2026-09-08');
  assert.equal(getEmployeeAge('1990-09-08',getEmployeeToday(before)),35);
  assert.equal(getEmployeeAge('1990-09-08',getEmployeeToday(birthday)),36);
  assert.equal(millisecondsToNextEmployeeDay(before),1);
  assert.equal(millisecondsToNextEmployeeDay(birthday),86_400_000);
  assert.equal(getEmployeeToday(new Date('2026-12-31T17:00:00Z')),'2027-01-01');
});

test('probation list includes birth dates, not other personal fields, across all pages and cache reads', async () => {
  const calls=[];
  const rows=[
    {staff_id:'40000',status:'Active',emp_type:'Probation',birth_date:'1990-09-08',phone:'PRIVATE',id_card:'PRIVATE'},
    {staff_id:'40001',status:'Active',emp_type:'Probation',birth_date:'08/09/2533'},
  ];
  const route=loadTs('src/app/api/probation/route.ts',{
    '@/lib/probationCache':loadTs('src/lib/probationCache.ts'),
    '@/lib/auth-session':{authorizeRequest:async(_request,permission)=>{assert.equal(permission,'view');return {ok:true};}},
    '@/lib/dynamodb':{docClient:{send:async(command)=>{
      calls.push(command.input);
      const fields=Object.values(command.input.ExpressionAttributeNames);
      assert.ok(fields.includes('birth_date'));
      assert.ok(!fields.includes('phone') && !fields.includes('id_card'));
      return {Items:[rows[calls.length-1]],...(calls.length===1?{LastEvaluatedKey:{staff_id:'40000'}}:{})};
    }}},
  });
  const result=await route.GET(new NextRequest('http://localhost/api/probation'));
  assert.equal(result.status,200);
  const {items}=await result.json();
  assert.deepEqual(items.map(row=>row.birth_date),rows.map(row=>row.birth_date));
  assert.equal(items[0].phone,undefined);
  assert.equal(items[0].id_card,undefined);
  const cached=await route.GET(new NextRequest('http://localhost/api/probation'));
  assert.equal(cached.headers.get('X-Probation-Cache'),'HIT');
  assert.equal(calls.length,2);
});

test('probation birth dates still require permission before accessing data or cache', async () => {
  const deny=()=>{throw new Error('Unauthorized access');};
  const route=loadTs('src/app/api/probation/route.ts',{
    '@/lib/probationCache':{getProbationCache:deny,setProbationCache:deny},
    '@/lib/dynamodb':{docClient:{send:deny}},
    '@/lib/auth-session':{authorizeRequest:async()=>({ok:false,response:Response.json({error:'Denied'},{status:403})})},
  });
  assert.equal((await route.GET(new NextRequest('http://localhost/api/probation'))).status,403);
});
