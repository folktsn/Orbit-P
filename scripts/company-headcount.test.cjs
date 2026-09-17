const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

function loadTs(file, mocks = {}, globals = {}) {
  const { outputText } = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const compiled = { exports: {} };
  const localRequire = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('@/') || name === 'server-only') throw new Error(`Missing isolated mock: ${name}`);
    return require(name);
  };
  new Function('require', 'module', 'exports', 'globalThis', ...Object.keys(globals), outputText)(
    localRequire, compiled, compiled.exports, {}, ...Object.values(globals),
  );
  return compiled.exports;
}

const departure = loadTs('src/app/employees/lib/resignation.ts');
const age = loadTs('src/app/employees/lib/age.ts', { './resignation': departure });
const counting = loadTs('src/lib/employee-headcount.ts', { '@/app/employees/lib/resignation': departure });
const permissions = loadTs('src/lib/permissions.ts');
const today = '2026-09-17';
const active = (staff_id, extra = {}) => ({ staff_id, status: 'Active', ...extra });
const cacheModule = () => loadTs('src/lib/employeesCache.ts');

function service(cache, send) {
  return loadTs('src/lib/company-headcount.ts', {
    'server-only': {}, '@/lib/dynamodb': { docClient: { send } },
    '@/lib/employeesCache': cache, '@/lib/employee-headcount': counting,
    '@/app/employees/lib/age': { getEmployeeToday: () => today },
  });
}

test('company count includes every working station and group, including headquarters and probation', () => {
  for (const extra of [{ station: 'HDQ' }, { department: 'EXCLUSIVE' }, { emp_type: 'Internship' }, { emp_type: 'Probation' }, { station: 'HKT' }]) {
    assert.equal(counting.isCurrentCompanyEmployee(active('1', extra), today), true);
  }
  assert.equal(counting.isCurrentCompanyEmployee({ staff_id: 'legacy-1' }, today), true);
  assert.equal(counting.isCurrentCompanyEmployee({ status: 'Active' }, today), false);
});

test('future hires and completed departures are excluded; scheduled departures count only until their effective date', () => {
  for (const status of ['Resign', 'Resigned', 'Failed Probation', 'Retired', 'Terminated', 'Inactive', 'ลาออก']) {
    assert.equal(counting.isCurrentCompanyEmployee(active('1', { status, resign_date: '2027-01-01' }), today), false);
  }
  assert.equal(counting.isCurrentCompanyEmployee(active('1', { start_date: '2026-09-18' }), today), false);
  assert.equal(counting.isCurrentCompanyEmployee(active('1', { start_date: today }), today), true);
  assert.equal(counting.isCurrentCompanyEmployee(active('1', { status: 'Pending' }), today), false);
  assert.equal(counting.isCurrentCompanyEmployee(active('1', { status: 'Pending', resign_date: '18/09/2569' }), today), true);
  assert.equal(counting.isCurrentCompanyEmployee(active('1', { last_working_date: '17/09/2569' }), today), false);
  assert.equal(counting.isCurrentCompanyEmployee(active('1', { status: 'Resigning', resign_date: '2026-09-18' }), today), true);
  assert.equal(age.getEmployeeToday(new Date('2026-09-17T17:00:00Z')), '2026-09-18');
});

test('scan reads every page, de-duplicates employee IDs and shares a fresh aggregate without employee details', async () => {
  const cache = cacheModule();
  let calls = 0;
  const counter = service(cache, async (command) => {
    calls++;
    assert.equal(command.input.ConsistentRead, true);
    assert.equal(command.input.FilterExpression, undefined);
    assert.deepEqual(Object.values(command.input.ExpressionAttributeNames), counting.HEADCOUNT_FIELDS);
    return command.input.ExclusiveStartKey
      ? { Items: [active('1'), active('2'), active('3', { status: 'Resigned' })] }
      : { Items: [active('1')], LastEvaluatedKey: { staff_id: '1' } };
  });
  const [first, simultaneous] = await Promise.all([counter.readCompanyHeadcount(), counter.readCompanyHeadcount()]);
  assert.equal(first.count, 2);
  assert.deepEqual(Object.keys(first).sort(), ['count', 'updatedAt']);
  assert.deepEqual(first, simultaneous);
  assert.deepEqual(await counter.readCompanyHeadcount(), first);
  assert.equal(calls, 2);
  cache.invalidateEmployeesCache();
  await counter.readCompanyHeadcount();
  assert.equal(calls, 4);
});

test('an update during a scan triggers a fresh count and failed scans are never cached as zero', async () => {
  const cache = cacheModule();
  let calls = 0;
  const counter = service(cache, async () => {
    calls++;
    if (calls === 1) { cache.invalidateEmployeesCache(); return { Items: [active('1')] }; }
    if (calls === 3) throw new Error('Storage unavailable');
    return { Items: [active('1'), active('2')] };
  });
  assert.equal((await counter.readCompanyHeadcount()).count, 2);
  assert.equal(calls, 2);
  cache.invalidateEmployeesCache();
  await assert.rejects(counter.readCompanyHeadcount());
  assert.equal((await counter.readCompanyHeadcount()).count, 2);
  assert.equal(calls, 4);
});

function fakeTimers() {
  const timers = new Map();
  let id = 0;
  const schedule = (fn, delay) => { timers.set(++id, { fn, delay }); return id; };
  return { timers, globals: { setTimeout: schedule, setInterval: schedule, clearTimeout: (key) => timers.delete(key), clearInterval: (key) => timers.delete(key) } };
}

test('an employee update pushes a new count without a page reload; disconnect cleans up timers and listeners', async () => {
  const cache = cacheModule();
  const clock = fakeTimers();
  let count = 10;
  const streamModule = loadTs('src/lib/headcount-stream.ts', {
    '@/lib/company-headcount': { readCompanyHeadcount: async () => ({ count, updatedAt: '2026-09-17T08:00:00Z' }) },
    '@/lib/employeesCache': cache,
  }, clock.globals);
  const abort = new AbortController();
  const reader = streamModule.createHeadcountStream(abort.signal).getReader();
  const text = async () => new TextDecoder().decode((await reader.read()).value);
  assert.match(await text(), /connected/);
  assert.match(await text(), /"count":10/);
  count = 11;
  cache.invalidateEmployeesCache();
  clock.timers.values().find((timer) => timer.delay === 150).fn();
  assert.match(await text(), /"count":11/);
  const poll = clock.timers.values().find((timer) => timer.delay === 15_000);
  count = 12;
  poll.fn();
  assert.match(await text(), /"count":12/);
  abort.abort();
  assert.equal(clock.timers.size, 0);
  assert.equal((await reader.read()).done, true);
  cache.invalidateEmployeesCache();
  assert.equal(clock.timers.size, 0);

  const canceled = streamModule.createHeadcountStream(new AbortController().signal).getReader();
  await canceled.cancel();
  assert.equal(clock.timers.size, 0);
});

test('stream errors have no fabricated count and periodic reconnection rechecks access', async () => {
  const cache = cacheModule();
  const clock = fakeTimers();
  const streamModule = loadTs('src/lib/headcount-stream.ts', {
    '@/lib/company-headcount': { readCompanyHeadcount: async () => { throw new Error('Storage down'); } },
    '@/lib/employeesCache': cache,
  }, clock.globals);
  const reader = streamModule.createHeadcountStream(new AbortController().signal).getReader();
  await reader.read();
  const error = new TextDecoder().decode((await reader.read()).value);
  assert.match(error, /event: unavailable/);
  assert.doesNotMatch(error, /count/);
  clock.timers.values().find((timer) => timer.delay === 55_000).fn();
  assert.match(new TextDecoder().decode((await reader.read()).value), /event: reconnect/);
  assert.equal((await reader.read()).done, true);
  assert.equal(clock.timers.size, 0);
});

test('headcount requires dashboard view authorization in both JSON and stream modes', async () => {
  const url = 'https://example.test/api/dashboard/headcount';
  assert.deepEqual(permissions.apiPageRequirements(new Request(url)), ['dashboard']);
  for (const suffix of ['', '?stream=1']) {
    let allowed = false;
    let reads = 0;
    const handler = loadTs('src/app/api/dashboard/headcount/route.ts', {
      '@/lib/auth-session': { authorizeRequest: async (_request, permission) => {
        assert.equal(permission, 'view');
        return allowed ? { ok: true, user: {} } : { ok: false, response: new Response(null, { status: 403 }) };
      } },
      '@/lib/company-headcount': { readCompanyHeadcount: async () => { reads++; return { count: 42, updatedAt: '2026-09-17T08:00:00Z' }; } },
      '@/lib/headcount-stream': { createHeadcountStream: () => { reads++; return new ReadableStream({ start: (controller) => controller.close() }); } },
    });
    assert.equal((await handler.GET(new Request(url + suffix))).status, 403);
    assert.equal(reads, 0);
    allowed = true;
    const response = await handler.GET(new Request(url + suffix));
    assert.equal(response.status, 200);
    assert.equal(reads, 1);
    assert.match(response.headers.get('Cache-Control'), /no-store/);
    if (suffix) assert.equal(response.headers.get('X-Accel-Buffering'), 'no');
    else assert.equal((await response.json()).count, 42);
  }
});
