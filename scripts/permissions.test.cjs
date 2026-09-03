const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

// Compile the real handlers in memory and replace only external services.
function loadTs(file, mocks = {}, env = {}, fetchMock = async () => { throw new Error('Unexpected network request'); }) {
  const source = readFileSync(path.resolve(file), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  const module = { exports: {} };
  const localRequire = (id) => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id.startsWith('@/') || id === 'server-only') throw new Error(`Missing isolated mock: ${id}`);
    return require(id);
  };
  new Function('require', 'module', 'exports', 'process', 'fetch', outputText)(
    localRequire, module, module.exports, { env: { NODE_ENV: 'production', ...env } }, fetchMock,
  );
  return module.exports;
}

const permissions = loadTs('src/lib/permissions.ts');
const { ADMIN_PERMISSIONS, DEFAULT_PERMISSIONS } = permissions;
const adminLineId = `U${'a'.repeat(32)}`;
const otherLineId = `U${'b'.repeat(32)}`;
const admin = { username: '00001', staffId: '00001', provider: 'line', role: 'admin', displayName: 'Test Admin', permissions: ADMIN_PERMISSIONS };
const userRequest = (token, url = '/api/auth/session') => new Request(`https://example.test${url}`, {
  headers: token ? { cookie: `orbithire_auth=${token}` } : {},
});

function createDatabase(initial = []) {
  const grants = new Map(initial.map((row) => [row.staffId, row]));
  const prisma = {
    permissionGrant: {
      findUnique: async ({ where }) => grants.get(where.staffId) || null,
      findMany: async () => [...grants.values()],
      count: async () => [...grants.values()].filter((row) => row.adminPermission).length,
      upsert: async ({ where, create, update }) => {
        const row = { ...(grants.get(where.staffId) || create), ...update, updatedAt: new Date() };
        grants.set(where.staffId, row);
        return row;
      },
    },
    $transaction: async (fn) => fn(prisma),
  };
  return { prisma, grants };
}

const adminGrant = (staffId = '00001') => ({ staffId, accessPermission: true, viewPermission: true, editPermission: true, adminPermission: true });
function sessionModule(prisma) {
  return loadTs('src/lib/auth-session.ts', {
    'server-only': {}, '@/lib/prisma': { prisma }, '@/lib/permissions': permissions,
  }, { AUTH_SESSION_SECRET: 'isolated-test-secret-not-for-production' });
}

test('permission hierarchy preserves view-only defaults', () => {
  assert.deepEqual(permissions.normalizePermissions({ admin: true }), ADMIN_PERMISSIONS);
  assert.deepEqual(permissions.normalizePermissions({ edit: true }), { access: true, view: true, edit: true, admin: false });
  assert.equal(DEFAULT_PERMISSIONS.admin, false);
  assert.equal(DEFAULT_PERMISSIONS.edit, false);
});

test('sessions reject tampering, extra segments, expiry, and missing expiry', async () => {
  const { prisma } = createDatabase([adminGrant()]);
  const auth = sessionModule(prisma);
  const token = auth.createSessionToken(admin);
  assert.equal((await auth.getSessionUser(userRequest(token))).permissions.admin, true);
  assert.equal(await auth.getSessionUser(userRequest(`${token}x`)), null);
  assert.equal(await auth.getSessionUser(userRequest(`${token}.extra`)), null);
  const { createHmac } = require('node:crypto');
  for (const expiresAt of [Date.now() - 1000, undefined, 'tomorrow']) {
    const payload = Buffer.from(JSON.stringify({ ...admin, expiresAt })).toString('base64url');
    const signature = createHmac('sha256', 'isolated-test-secret-not-for-production').update(payload).digest('base64url');
    assert.equal(await auth.getSessionUser(userRequest(`${payload}.${signature}`)), null);
  }
});

test('permissions are reloaded on every request and deleted grants do not retain Admin', async () => {
  const { prisma, grants } = createDatabase([adminGrant()]);
  const auth = sessionModule(prisma);
  const token = auth.createSessionToken(admin);
  grants.delete('00001');
  const user = await auth.getSessionUser(userRequest(token));
  assert.deepEqual(user.permissions, DEFAULT_PERMISSIONS);
  assert.equal(user.role, 'employee');
  grants.set('00001', { staffId: '00001', accessPermission: false, viewPermission: false, editPermission: false, adminPermission: false });
  assert.equal(await auth.getSessionUser(userRequest(token)), null);
});

test('unauthenticated, view-only, and credential-only production sessions cannot administer', async () => {
  const { prisma } = createDatabase();
  const auth = sessionModule(prisma);
  assert.equal((await auth.authorizeRequest(userRequest(), 'admin')).response.status, 401);
  const viewToken = auth.createSessionToken({ ...admin, staffId: '00002', permissions: DEFAULT_PERMISSIONS });
  assert.equal((await auth.authorizeRequest(userRequest(viewToken), 'admin')).response.status, 403);
  const localToken = auth.createSessionToken({ ...admin, provider: 'credentials', staffId: undefined });
  assert.equal(await auth.getSessionUser(userRequest(localToken)), null);
});

function lineRoute({ identity = adminLineId, items = [], mapping = null, employee = null, channel = '1234567890', expires = 3600, scanError = false } = {}) {
  const state = { cookies: [], mappingQueries: [], upserts: 0 };
  const prisma = {
    lineWebhook: {
      findFirst: async (query) => { state.mappingQueries.push(query); return mapping; },
      findUnique: async () => mapping,
      upsert: async () => { state.upserts++; },
    },
  };
  const route = loadTs('src/app/api/auth/line/lookup/route.ts', {
    '@/lib/prisma': { prisma },
    '@/lib/permissions': permissions,
    '@/lib/auth-session': {
      resolvePermissionsForStaff: async (staffId) => staffId === '00001' ? ADMIN_PERMISSIONS : DEFAULT_PERMISSIONS,
      setSessionCookie: (response, user) => { state.cookies.push(user); return response; },
    },
    '@/lib/dynamodb': { docClient: { send: async (command) => {
      if (command.constructor.name === 'ScanCommand') {
        if (scanError) throw new Error('Test database outage');
        return { Items: items };
      }
      return { Item: employee };
    } } },
  }, { LINE_LOGIN_CHANNEL_ID: '1234567890', AUTH_APP_ORIGIN: 'https://example.test' }, async (url) => {
    if (url.includes('/verify?')) return Response.json({ client_id: channel, expires_in: expires });
    return Response.json({ userId: identity, displayName: 'Same Display Name' });
  });
  const request = (body = { accessToken: 'test-token' }) => new Request('https://example.test/api/auth/line/lookup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return { route, state, request };
}

const employee = { staff_id: '00001', line_user_id: adminLineId, first_name_en: 'Test', last_name_en: 'Admin', status: 'Active' };
test('verified exact LINE account receives the configured Admin grant', async () => {
  const { route, state, request } = lineRoute({ items: [employee] });
  assert.equal((await route.POST(request())).status, 200);
  assert.equal(state.cookies[0].staffId, '00001');
  assert.equal(state.cookies[0].permissions.admin, true);
});

test('public login origin works behind a reverse proxy and cross-site origins are rejected', async () => {
  const { route, state } = lineRoute({ items: [employee] });
  for (const [origin, expected] of [['https://other.test', 403], ['null', 403], ['https://example.test', 200]]) {
    const response = await route.POST(new Request('http://localhost:3000/api/auth/line/lookup', {
      method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ accessToken: 'test-token' }),
    }));
    assert.equal(response.status, expected);
  }
  assert.equal(state.cookies.length, 1);
});

test('a submitted LINE ID without a token cannot create a production session', async () => {
  const { route, state, request } = lineRoute({ items: [employee] });
  assert.equal((await route.POST(request({ lineUserId: adminLineId }))).status, 401);
  assert.equal((await route.GET(userRequest(null, `/api/auth/line/lookup?lineUserId=${adminLineId}`))).status, 403);
  assert.equal(state.cookies.length, 0);
});

test('wrong channel and expired access tokens are rejected', async () => {
  for (const options of [{ channel: 'another-channel' }, { expires: 0 }]) {
    const { route, state, request } = lineRoute(options);
    assert.equal((await route.POST(request())).status, 401);
    assert.equal(state.cookies.length, 0);
  }
});

test('a matching display name is never used as a login identity', async () => {
  const { route, state, request } = lineRoute({ identity: otherLineId });
  assert.equal((await route.POST(request())).status, 404);
  assert.deepEqual(state.mappingQueries[0].where, { lineUserId: otherLineId, status: 'Linked' });
  assert.equal(state.cookies.length, 0);
  assert.equal(state.upserts, 0);
});

test('stale mappings and duplicate employee LINE bindings fail closed', async () => {
  const stale = lineRoute({ identity: otherLineId, mapping: { staffId: '00001', lineNickname: 'Same Display Name' }, employee });
  assert.equal((await stale.route.POST(stale.request())).status, 404);
  assert.equal(stale.state.cookies.length, 0);
  const duplicate = lineRoute({ items: [employee, { ...employee, staff_id: '00002' }] });
  assert.equal((await duplicate.route.POST(duplicate.request())).status, 409);
  assert.equal(duplicate.state.cookies.length, 0);
});

test('last Admin cannot be removed; another Admin allows a controlled demotion', async () => {
  const { prisma, grants } = createDatabase([adminGrant()]);
  const auth = sessionModule(prisma);
  const route = loadTs('src/app/api/permissions/route.ts', {
    '@/lib/auth-session': auth, '@/lib/prisma': { prisma }, '@/lib/permissions': permissions,
    '@/lib/dynamodb': { docClient: { send: async () => ({ Item: { staff_id: '00001' } }) } },
  });
  const token = auth.createSessionToken(admin);
  const request = () => new Request('https://example.test/api/permissions', {
    method: 'PUT', headers: { cookie: `orbithire_auth=${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ staffId: '00001', permissions: DEFAULT_PERMISSIONS }),
  });
  assert.equal((await route.PUT(request())).status, 409);
  assert.equal(grants.get('00001').adminPermission, true);
  grants.set('00002', adminGrant('00002'));
  assert.equal((await route.PUT(request())).status, 200);
  assert.equal(grants.get('00001').adminPermission, false);
});

test('only an Admin can save valid employee grants and actor metadata is server supplied', async () => {
  const { prisma, grants } = createDatabase([adminGrant()]);
  const auth = sessionModule(prisma);
  let lookups = 0;
  const route = loadTs('src/app/api/permissions/route.ts', {
    '@/lib/auth-session': auth, '@/lib/prisma': { prisma }, '@/lib/permissions': permissions,
    '@/lib/dynamodb': { docClient: { send: async (command) => {
      lookups++;
      return command.input.Key.staff_id === '00002' ? { Item: { staff_id: '00002' } } : {};
    } } },
  });
  const request = (token, staffId = '00002', values = ADMIN_PERMISSIONS) => new Request('https://example.test/api/permissions', {
    method: 'PUT', headers: { cookie: `orbithire_auth=${token || ''}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ staffId, permissions: values, updatedById: 'forged-actor' }),
  });
  const viewer = auth.createSessionToken({ ...admin, staffId: '00002', permissions: DEFAULT_PERMISSIONS });
  assert.equal((await route.PUT(request())).status, 401);
  assert.equal((await route.PUT(request(viewer))).status, 403);
  assert.equal(lookups, 0);
  const token = auth.createSessionToken(admin);
  assert.equal((await route.PUT(request(token, '00002', { admin: true }))).status, 400);
  assert.equal((await route.PUT(request(token, 'missing'))).status, 404);
  assert.equal(grants.has('missing'), false);
  const response = await route.PUT(request(token));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(result.permissions, ADMIN_PERMISSIONS);
  assert.equal(result.updatedBy.id, admin.staffId);
  assert.equal(grants.get('00002').adminPermission, true);
});

function directoryRoute(records = []) {
  const { prisma, grants } = createDatabase([adminGrant()]);
  prisma.lineWebhook = { findMany: async () => [{ staffId: '00002' }] };
  const auth = sessionModule(prisma);
  const state = { scans: [], cache: new Map() };
  const route = loadTs('src/app/api/admin/users/route.ts', {
    '@/lib/auth-session': auth, '@/lib/prisma': { prisma }, '@/lib/permissions': permissions,
    '@/lib/employeesCache': {
      getCachedEmployeeValue: (key) => state.cache.get(key),
      setCachedEmployeeValue: (key, value) => state.cache.set(key, value),
    },
    '@/lib/dynamodb': { docClient: { send: async (command) => {
      state.scans.push(command.input);
      return command.input.ExclusiveStartKey
        ? { Items: records.slice(10) }
        : { Items: records.slice(0, 10), LastEvaluatedKey: { staff_id: 'cursor' } };
    } } },
  });
  return { route, state, grants, auth, token: auth.createSessionToken(admin) };
}

const directoryRecords = Array.from({ length: 25 }, (_, index) => ({
  staff_id: String(index + 1).padStart(5, '0'),
  first_name_en: 'Test', last_name_en: `Employee ${index + 1}`, name_th: `พนักงาน ทดสอบ ${index + 1}`,
  position_th: 'เจ้าหน้าที่บุคคล', department: 'Human Resources',
  status: index === 24 ? 'Resigned' : 'Active',
  line_user_id: index === 0 ? adminLineId : '',
  id_card: 'private', bank_account: 'private', email: 'private', birth_date: 'private',
}));

test('admin directory rejects unauthenticated and non-admin callers before scanning', async () => {
  const { route, state, auth, token } = directoryRoute(directoryRecords);
  assert.equal((await route.GET(userRequest(null, '/api/admin/users'))).status, 401);
  const viewer = auth.createSessionToken({ ...admin, staffId: '00002', permissions: DEFAULT_PERMISSIONS });
  assert.equal((await route.GET(userRequest(viewer, '/api/admin/users'))).status, 403);
  assert.equal(state.scans.length, 0);
  assert.equal((await route.GET(userRequest(token, '/api/admin/users?permission=superuser'))).status, 400);
  assert.equal(state.scans.length, 0);
});

test('admin directory paginates all Dynamo pages and returns only safe fields', async () => {
  const { route, state, token } = directoryRoute(directoryRecords);
  const response = await route.GET(userRequest(token, '/api/admin/users'));
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const result = await response.json();
  assert.equal(result.users.length, 20);
  assert.equal(result.total, 24);
  assert.equal(result.totalEmployees, 25);
  assert.equal(result.totalAdmins, 1);
  assert.equal(result.users[0].staffId, '00001');
  assert.equal(result.users[1].linked, true);
  assert.equal(state.scans.length, 2);
  assert.deepEqual(Object.keys(result.users[0]).sort(), ['staffId', 'name', 'nameTh', 'position', 'department', 'status', 'linked', 'permissions', 'isExplicit'].sort());
  const projectedFields = Object.values(state.scans[0].ExpressionAttributeNames);
  assert.equal(projectedFields.includes('id_card'), false);
  assert.equal(projectedFields.includes('bank_account'), false);
  const last = await (await route.GET(userRequest(token, '/api/admin/users?page=99'))).json();
  assert.equal(last.page, 2);
  assert.equal(last.users.length, 4);
  assert.equal(state.scans.length, 2);
});

test('admin search and status filters combine with fresh permission grants', async () => {
  const { route, grants, token, state } = directoryRoute(directoryRecords);
  const get = async (query) => (await route.GET(userRequest(token, `/api/admin/users?${query}`))).json();
  assert.equal((await get('q=00002')).users[0].staffId, '00002');
  assert.equal((await get('q=Test%20Resources')).total, 24);
  assert.equal((await get(`q=${encodeURIComponent('พนักงาน')}`)).total, 24);
  assert.equal((await get('status=inactive')).users[0].staffId, '00025');
  assert.equal((await get('status=all')).total, 25);
  assert.equal((await get('permission=edit')).total, 1);
  grants.set('00002', adminGrant('00002'));
  assert.equal((await get('permission=admin')).total, 2);
  grants.set('00003', { staffId: '00003', accessPermission: false, viewPermission: false, editPermission: false, adminPermission: false });
  assert.equal((await get('permission=blocked')).users[0].staffId, '00003');
  assert.equal((await get('q=no-match')).total, 0);
  assert.equal(state.scans.length, 2);
});

test('an editor cannot rebind an Admin LINE identity through the employee update API', async () => {
  let updates = 0;
  const route = loadTs('src/app/api/employees/update/route.ts', {
    '@/lib/auth-session': { authorizeRequest: async () => ({ ok: true, user: { ...admin, permissions: { ...ADMIN_PERMISSIONS, admin: false } } }) },
    '@/lib/dynamodb': { docClient: { send: async (command) => {
      if (command.constructor.name === 'GetCommand') return { Item: { line_user_id: adminLineId } };
      updates++;
      return {};
    } } },
    '@/lib/s3': { uploadAttachment: async () => { throw new Error('No uploads allowed in this test'); } },
    '@/lib/employeeDocumentStorage': {}, '@/lib/employeesCache': {},
  });
  const response = await route.PUT(new Request('https://example.test/api/employees/update', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: '00001', lineUserId: otherLineId }),
  }));
  assert.equal(response.status, 403);
  assert.equal(updates, 0);
});

const allPages = permissions.normalizePageAccess();
const onlyPages = (...keys) => Object.fromEntries(Object.keys(allPages).map((key) => [key, keys.includes(key)]));
const pageGrant = (pages, editable = false) => ({
  staffId: '00002', accessPermission: true, viewPermission: true, editPermission: editable, adminPermission: false,
  pageAccess: JSON.stringify(pages),
});

test('legacy page access is preserved, but malformed explicit grants fail closed', () => {
  assert.deepEqual(permissions.normalizePageAccess(null), allPages);
  assert.deepEqual(permissions.normalizePageAccess('{invalid'), onlyPages());
  assert.deepEqual(permissions.normalizePageAccess({ employees: true }), onlyPages('employees'));
  assert.equal(permissions.isPageAccess({ ...allPages, extra: true }), false);
  assert.equal(permissions.isPageAccess({ ...allPages, employees: 'true' }), false);
  assert.equal(permissions.isPageAccess(allPages), true);
  assert.equal(permissions.hasPageAccess({ permissions: DEFAULT_PERMISSIONS, pageAccess: onlyPages('probation') }, 'employees'), false);
  assert.equal(permissions.homePageForUser({ permissions: DEFAULT_PERMISSIONS, pageAccess: onlyPages('probation') }), '/probation');
  assert.equal(permissions.pageKeyForPath('/employees/00002'), 'employees');
  assert.equal(permissions.pageKeyForPath('/employees-other'), undefined);
  assert.equal(permissions.hasPageAccess({ permissions: ADMIN_PERMISSIONS, pageAccess: onlyPages() }, 'admin'), true);
  assert.equal(permissions.hasPageAccess({ permissions: { ...DEFAULT_PERMISSIONS, view: false }, pageAccess: allPages }, 'employees'), false);
});

test('page permissions are reread from the database and cannot be forged in a session', async () => {
  const { prisma, grants } = createDatabase([pageGrant(onlyPages('probation'))]);
  const auth = sessionModule(prisma);
  const token = auth.createSessionToken({ ...admin, staffId: '00002', permissions: ADMIN_PERMISSIONS, pageAccess: allPages });
  assert.deepEqual((await auth.getSessionUser(userRequest(token))).pageAccess, onlyPages('probation'));
  assert.equal((await auth.authorizeRequest(userRequest(token, '/api/probation'), 'view')).ok, true);
  assert.equal((await auth.authorizeRequest(userRequest(token, '/api/employees'), 'view')).response.status, 403);
  grants.set('00002', pageGrant(onlyPages('employees')));
  assert.equal((await auth.authorizeRequest(userRequest(token, '/api/probation'), 'view')).response.status, 403);
  assert.equal((await auth.authorizeRequest(userRequest(token, '/api/employees'), 'view')).ok, true);
});

test('module API permissions reject direct calls, forged headers, and unclassified endpoints', async () => {
  const { prisma } = createDatabase([pageGrant(onlyPages('dashboard'), true)]);
  const auth = sessionModule(prisma);
  const token = auth.createSessionToken({ ...admin, staffId: '00002' });
  const routes = ['/api/ats', '/api/probation', '/api/probation/follow-up', '/api/employees', '/api/employees?id=00001',
    '/api/employees?view=directory', '/api/organization', '/api/organization/update', '/api/manpower/current',
    '/api/manpower/budgets', '/api/data-quality', '/api/data-quality/actions', '/api/attachments', '/api/permissions',
    '/api/auth/line/mappings', '/api/unknown'];
  for (const route of routes) {
    const request = new Request(`https://example.test${route}`, { headers: {
      cookie: `orbithire_auth=${token}`, referer: 'https://example.test/probation', 'x-page': 'probation',
    } });
    const result = await auth.authorizeRequest(request, 'view');
    assert.equal(result.response?.status, 403, route);
  }
  for (const route of ['/api/employees/update', '/api/organization/update', '/api/manpower/budgets', '/api/probation/follow-up', '/api/data-quality/actions', '/api/ats']) {
    const result = await auth.authorizeRequest(new Request(`https://example.test${route}`, { method: 'PUT', headers: { cookie: `orbithire_auth=${token}` } }), 'edit');
    assert.equal(result.response?.status, 403, route);
  }
});

test('shared workflows retain profile and lookup access without exposing the full employee directory', async () => {
  const { prisma } = createDatabase([pageGrant(onlyPages('probation'), true)]);
  const auth = sessionModule(prisma);
  const token = auth.createSessionToken({ ...admin, staffId: '00002' });
  for (const route of ['/api/probation', '/api/probation/follow-up', '/api/employees?id=00003', '/api/employees?view=directory', '/api/organization', '/api/attachments']) {
    assert.equal((await auth.authorizeRequest(userRequest(token, route), 'view')).ok, true, route);
  }
  assert.equal((await auth.authorizeRequest(userRequest(token, '/api/employees'), 'view')).response.status, 403);
  assert.equal((await auth.authorizeRequest(userRequest(token, '/api/manpower/current'), 'view')).response.status, 403);
  const mutation = new Request('https://example.test/api/organization/update', { method: 'PUT', headers: { cookie: `orbithire_auth=${token}` } });
  assert.equal((await auth.authorizeRequest(mutation, 'edit')).response.status, 403);
  const viewOnly = sessionModule(createDatabase([pageGrant(onlyPages('probation'))]).prisma);
  assert.equal((await viewOnly.authorizeRequest(new Request('https://example.test/api/probation/follow-up', { method: 'PUT', headers: { cookie: `orbithire_auth=${token}` } }), 'edit')).response.status, 403);
});

test('page grants save atomically, reject malformed inputs, and survive legacy permission-only updates', async () => {
  const { prisma, grants } = createDatabase([adminGrant(), pageGrant(allPages)]);
  const auth = sessionModule(prisma);
  const route = loadTs('src/app/api/permissions/route.ts', {
    '@/lib/auth-session': auth, '@/lib/prisma': { prisma }, '@/lib/permissions': permissions,
    '@/lib/dynamodb': { docClient: { send: async () => ({ Item: { staff_id: '00002' } }) } },
  });
  const token = auth.createSessionToken(admin);
  const request = (pageAccess) => new Request('https://example.test/api/permissions', {
    method: 'PUT', headers: { cookie: `orbithire_auth=${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ staffId: '00002', permissions: DEFAULT_PERMISSIONS, pageAccess }),
  });
  for (const invalid of [null, [], {}, { ...allPages, employees: 'false' }, { ...allPages, admin: true }]) {
    assert.equal((await route.PUT(request(invalid))).status, 400);
  }
  const selected = onlyPages('employees', 'probation');
  const response = await route.PUT(request(selected));
  assert.deepEqual((await response.json()).pageAccess, selected);
  assert.deepEqual(JSON.parse(grants.get('00002').pageAccess), selected);
  assert.equal((await route.PUT(request(undefined))).status, 200);
  assert.deepEqual(JSON.parse(grants.get('00002').pageAccess), selected);
  const stored = await route.GET(userRequest(token, '/api/permissions?staffId=00002'));
  assert.deepEqual((await stored.json()).pageAccess, selected);
});

test('employee directory lookup exposes no personal or financial data and is gated before cache access', async () => {
  const { prisma, grants } = createDatabase([pageGrant(onlyPages('probation'))]);
  const auth = sessionModule(prisma);
  const token = auth.createSessionToken({ ...admin, staffId: '00002' });
  const cache = new Map();
  let scans = 0;
  const route = loadTs('src/app/api/employees/route.ts', {
    '@/lib/auth-session': auth,
    '@/lib/employeesCache': {
      getCachedEmployeeValue: (key) => cache.get(key), setCachedEmployeeValue: (key, value) => cache.set(key, value),
      getCachedEmployees: (key) => cache.get(key), setCachedEmployees: (value, key) => cache.set(key, value),
    },
    '@/lib/dynamodb': { docClient: { send: async () => {
      scans++; return { Items: [{ staff_id: '00003', name_en: 'Test Employee', position: 'Staff', id_card: 'private', bank_account: 'private', birth_date: 'private' }] };
    } } },
  });
  const allowed = await route.GET(userRequest(token, '/api/employees?view=directory'));
  assert.equal(allowed.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(await allowed.json(), [{ staff_id: '00003', name_en: 'Test Employee', position: 'Staff' }]);
  assert.equal((await route.GET(userRequest(token, '/api/employees'))).status, 403);
  grants.set('00002', pageGrant(onlyPages()));
  assert.equal((await route.GET(userRequest(token, '/api/employees?view=directory'))).status, 403);
  assert.equal(scans, 1);
});
