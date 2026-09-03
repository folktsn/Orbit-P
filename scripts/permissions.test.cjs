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
  }, { LINE_LOGIN_CHANNEL_ID: '1234567890' }, async (url) => {
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
