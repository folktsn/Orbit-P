const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { NextRequest } = require('next/server');

// Exercise the real routes without loading credentials or external services.
function loadTs(file, mocks = {}) {
  const { outputText } = ts.transpileModule(readFileSync(path.resolve(file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  const loaded = { exports: {} };
  const localRequire = (id) => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id.startsWith('@/')) throw new Error(`Missing isolated mock: ${id}`);
    return require(id);
  };
  new Function('require', 'module', 'exports', outputText)(localRequire, loaded, loaded.exports);
  return loaded.exports;
}

const limits = loadTs('src/lib/probationFollowUp.ts');
const record = {
  staff_id: '10001', status: 'Active', emp_type: 'Probation', first_name_en: 'Test', last_name_en: 'Employee',
  start_date: '2026-08-01', probation_end_date: '2026-11-29',
  probation_follow_up_1_attachment_name: 'existing.png',
  probation_follow_up_1_attachment_data: 'evaluation/follow-up/10001/Follow_Up_1/existing.png',
  probation_follow_up_2_comment: 'Existing round two note',
  bank_account: 'PRIVATE_FIELD_NOT_IN_LIST',
};

function harness({ deniedStatus, missingEvaluator, updateError } = {}) {
  const rows = new Map([['10001', { ...record }], ['10002', { ...record, staff_id: '10002' }]]);
  const state = { commands: [], uploads: 0, employeeInvalidations: 0, probationInvalidations: 0, authorizations: [] };
  const cache = loadTs('src/lib/probationCache.ts');
  const mocks = {
    '@/lib/probationFollowUp': limits,
    '@/lib/auth-session': { authorizeRequest: async (_request, required) => {
      state.authorizations.push(required);
      return deniedStatus ? { ok: false, response: Response.json({ error: 'Denied' }, { status: deniedStatus }) } : { ok: true };
    } },
    '@/lib/employeesCache': { invalidateEmployeesCache: () => { state.employeeInvalidations++; } },
    '@/lib/probationCache': { ...cache, invalidateProbationCache: () => {
      state.probationInvalidations++;
      cache.invalidateProbationCache();
    } },
    '@/lib/s3': { uploadAttachment: async () => { state.uploads++; throw new Error('Unexpected upload'); } },
    '@/lib/dynamodb': { docClient: { send: async (command) => {
      const input = command.input;
      state.commands.push(command);
      if (command.constructor.name === 'GetCommand') {
        if (input.Key.staff_id === '20001') return { Item: missingEvaluator ? undefined : {
          staff_id: '20001', first_name_en: 'Test', last_name_en: 'Evaluator', position_en: 'HR Officer',
        } };
        return { Item: rows.get(input.Key.staff_id) };
      }
      if (command.constructor.name === 'ScanCommand') {
        const projected = Object.values(input.ExpressionAttributeNames);
        return { Items: [...rows.values()].map((row) => Object.fromEntries(projected.filter((key) => key in row).map((key) => [key, row[key]]))) };
      }
      assert.equal(command.constructor.name, 'UpdateCommand');
      assert.equal(input.ConditionExpression, 'attribute_exists(staff_id)');
      if (updateError) throw Object.assign(new Error('Missing employee'), { name: updateError });
      const row = rows.get(input.Key.staff_id);
      assert.ok(row);
      const changed = {};
      for (const assignment of input.UpdateExpression.replace(/^SET /, '').split(', ')) {
        const [name, value] = assignment.split(' = ');
        const key = input.ExpressionAttributeNames[name];
        assert.ok(key);
        row[key] = input.ExpressionAttributeValues[value];
        changed[key] = row[key];
      }
      return { Attributes: changed };
    } } },
  };
  const followUp = loadTs('src/app/api/probation/follow-up/route.ts', mocks);
  const list = loadTs('src/app/api/probation/route.ts', mocks);
  const save = (body = {}) => followUp.POST(new Request('https://example.test/api/probation/follow-up', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employeeId: '10001', followUpNumber: 1, followUpDate: '2026-09-03', evaluatorId: '20001', ...body }),
  }));
  const read = () => list.GET(new NextRequest('https://example.test/api/probation'));
  return { rows, state, save, read };
}

test('each round saves and reloads its own multiline comment without uploading or changing old images', async () => {
  const { rows, state, save, read } = harness();
  for (const slot of [1, 2, 3]) {
    const comment = `ติดตามครั้งที่ ${slot}\nรอผลประเมินจากหัวหน้างาน`;
    const response = await save({ followUpNumber: slot, comment: `  ${comment}  ` });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.comment, comment);
    assert.equal(payload.evaluator.position, 'HR Officer');
    const field = `probation_follow_up_${slot}_comment`;
    assert.equal(rows.get('10001')[field], comment);
    const result = await (await read()).json();
    assert.equal(result.items.find((item) => item.staff_id === '10001')[field], comment);
    assert.equal(result.items[0].bank_account, undefined);
  }
  assert.equal(state.uploads, 0);
  assert.equal(state.employeeInvalidations, 3);
  assert.equal(state.probationInvalidations, 3);
  assert.equal(rows.get('10001').probation_follow_up_1_attachment_data, record.probation_follow_up_1_attachment_data);
  assert.equal(rows.get('10001').status, 'Active');
  assert.equal(rows.get('10001').emp_type, 'Probation');
  assert.equal(rows.get('10002').probation_follow_up_1_comment, undefined);
  const scans = state.commands.filter((command) => command.constructor.name === 'ScanCommand');
  for (const slot of [1, 2, 3]) assert.ok(Object.values(scans[0].input.ExpressionAttributeNames).includes(`probation_follow_up_${slot}_comment`));
});

test('empty comments are optional, can be cleared, and omitted legacy fields preserve existing notes', async () => {
  const { rows, save } = harness();
  assert.equal((await save()).status, 200);
  assert.equal(rows.get('10001').probation_follow_up_1_comment, undefined);
  assert.equal((await save({ followUpNumber: 2 })).status, 200);
  assert.equal(rows.get('10001').probation_follow_up_2_comment, record.probation_follow_up_2_comment);
  for (const comment of ['null', '-', '<script>text only</script>', '']) {
    const response = await save({ followUpNumber: 2, comment });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).comment, comment);
  }
  assert.equal(rows.get('10001').probation_follow_up_2_comment, '');
});

test('comment length limit accepts the boundary and rejects invalid types before database or storage calls', async () => {
  const { state, save } = harness();
  const longComment = 'ก'.repeat(limits.MAX_FOLLOW_UP_COMMENT_LENGTH);
  for (const comment of [null, 42, true, {}, [], longComment + 'ก']) {
    assert.equal((await save({ comment })).status, 400);
  }
  assert.equal(state.commands.length, 0);
  assert.equal(state.uploads, 0);
  assert.equal((await save({ comment: longComment })).status, 200);
});

test('follow-up saves still require Edit and a denied user cannot read or mutate anything', async () => {
  for (const deniedStatus of [401, 403]) {
    const { state, save, read } = harness({ deniedStatus });
    assert.equal((await save({ comment: 'Denied' })).status, deniedStatus);
    assert.equal((await read()).status, deniedStatus);
    assert.deepEqual(state.authorizations, ['edit', 'view']);
    assert.equal(state.commands.length, 0);
    assert.equal(state.uploads, 0);
  }
});

test('invalid rounds, dates, evaluator and employee identifiers never save comments', async () => {
  const { state, save } = harness();
  for (const body of [{ followUpNumber: 0 }, { followUpNumber: 4 }, { followUpDate: '2026-02-30' }, { evaluatorId: '' }, { employeeId: '' }]) {
    assert.equal((await save({ comment: 'Not saved', ...body })).status, 400);
  }
  assert.equal((await save({ employeeId: '99999', comment: 'Not saved' })).status, 404);
  assert.equal(state.commands.some((command) => command.constructor.name === 'UpdateCommand'), false);
  assert.equal((await harness({ missingEvaluator: true }).save({ comment: 'Not saved' })).status, 404);
});

test('a missing target during update returns failure without invalidating caches or claiming success', async () => {
  const { rows, state, save } = harness({ updateError: 'ConditionalCheckFailedException' });
  assert.equal((await save({ comment: 'Not saved' })).status, 404);
  assert.equal(rows.get('10001').probation_follow_up_1_comment, undefined);
  assert.equal(state.employeeInvalidations, 0);
  assert.equal(state.probationInvalidations, 0);
});

test('a follow-up write invalidates the list cache so a subsequent read returns the latest comment', async () => {
  const { read, save } = harness();
  assert.equal((await read()).headers.get('X-Probation-Cache'), 'MISS');
  assert.equal((await read()).headers.get('X-Probation-Cache'), 'HIT');
  assert.equal((await save({ comment: 'Updated comment' })).status, 200);
  const response = await read();
  assert.equal(response.headers.get('X-Probation-Cache'), 'MISS');
  assert.equal((await response.json()).items[0].probation_follow_up_1_comment, 'Updated comment');
});
