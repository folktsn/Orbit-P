const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

function loadTs(file, mocks = {}) {
  const { outputText } = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const compiled = { exports: {} };
  const localRequire = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('@/')) throw new Error(`Missing isolated mock: ${name}`);
    return require(name);
  };
  new Function('require', 'module', 'exports', outputText)(localRequire, compiled, compiled.exports);
  return compiled.exports;
}

const profile = loadTs('src/lib/employee-work-profile.ts');
const employee = {
  position_en: ' People Operations Manager ', position: 'ผู้จัดการ',
  unit_en: 'HQ Support', section_en: 'People Operations',
  division_en: 'Human Resources', department_en: 'Corporate Services',
  id_card: 'private-test-value', bank_account: 'private-test-value',
};
const expected = {
  position: 'People Operations Manager', unit: 'HQ Support', section: 'People Operations',
  division: 'Human Resources', department: 'Corporate Services',
};

function route(user, send) {
  return loadTs('src/app/api/auth/work-profile/route.ts', {
    '@/lib/auth-session': { getSessionUser: async () => user },
    '@/lib/dynamodb': { docClient: { send } },
    '@/lib/employee-work-profile': profile,
  });
}
const request = (search = '') => new Request(`https://example.test/api/auth/work-profile${search}`);

test('English profile preserves the company hierarchy and returns only the five work fields', () => {
  assert.deepEqual(profile.toEmployeeWorkProfile(employee), expected);
  assert.deepEqual(profile.WORK_PROFILE_FIELDS.map(({ label }) => label), ['Position', 'Unit', 'Section', 'Division', 'Department']);
});

test('legacy English values work while missing, malformed and Thai-only values remain unspecified', () => {
  assert.deepEqual(profile.toEmployeeWorkProfile({
    position_en: '-', position: 'Ramp Agent', unit_en: 'NULL', unit: 'Ramp Services',
    section_en: 'N/A', section: 'ส่วนงานลานจอด', division_en: {}, department_en: '—',
  }), { position: 'Ramp Agent', unit: 'Ramp Services', section: null, division: null, department: null });
  assert.deepEqual(profile.toEmployeeWorkProfile({}), { position: null, unit: null, section: null, division: null, department: null });
});

test('unauthenticated and unlinked sessions cannot query employee records', async () => {
  const send = async () => assert.fail('Employee lookup must not run');
  const denied = await route(null, send).GET(request('?staffId=another-person'));
  assert.equal(denied.status, 401);
  const unlinked = await route({ username: 'local-user' }, send).GET(request());
  assert.deepEqual(await unlinked.json(), { profile: null });
});

test('the endpoint reads only the signed-in employee and projects only the required fields', async () => {
  const handler = route({ staffId: 'self-001' }, async (command) => {
    assert.deepEqual(command.input.Key, { staff_id: 'self-001' });
    assert.equal(command.input.TableName, 'fullstaff');
    assert.deepEqual(Object.values(command.input.ExpressionAttributeNames), profile.WORK_PROFILE_SOURCE_FIELDS);
    assert.equal(command.input.ProjectionExpression.split(', ').length, 10);
    return { Item: employee };
  });
  const response = await handler.GET(request('?staffId=someone-else&id=someone-else'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.deepEqual(await response.json(), { profile: expected });
});

test('missing employee data and unavailable storage have distinct responses', async () => {
  const missing = await route({ staffId: 'self-001' }, async () => ({})).GET(request());
  assert.equal(missing.status, 200);
  assert.deepEqual(await missing.json(), { profile: null });
  const failed = await route({ staffId: 'self-001' }, async () => { throw new Error('storage failed'); }).GET(request());
  assert.equal(failed.status, 503);
  assert.deepEqual(await failed.json(), { error: 'Work profile is temporarily unavailable' });
});
