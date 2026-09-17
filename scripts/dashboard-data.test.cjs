const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const { outputText } = ts.transpileModule(readFileSync('src/app/components/dashboard-data.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const compiled = { exports: {} };
new Function('module', 'exports', outputText)(compiled, compiled.exports);
const { summarizeWorkforce, summarizeRecruitment, summarizeProbation } = compiled.exports;

test('workforce uses actual department counts, ranks them, and preserves the input', () => {
  const departments = [
    { department: 'Engineering', departmentCode: 'ENG', current: 12 },
    { department: 'Operations', departmentCode: 'OPS', current: 46 },
    { department: 'HR', departmentCode: 'HR', current: 0 },
  ];
  const summary = summarizeWorkforce({ departments });
  assert.equal(summary.total, 58);
  assert.deepEqual(summary.departments.map((item) => item.departmentCode), ['OPS', 'ENG', 'HR']);
  assert.equal(departments[0].departmentCode, 'ENG');
});

test('recruitment counts each real status including an empty pipeline', () => {
  const summary = summarizeRecruitment({ success: true, candidates: [
    { status: 'สมัครแล้ว' }, { status: 'สัมภาษณ์' }, { status: 'สัมภาษณ์' }, { status: 'จ้างงาน' },
  ] });
  assert.equal(summary.total, 4);
  assert.deepEqual(summary.stages.map((stage) => stage.count), [1, 0, 2, 1]);
  assert.equal(summarizeRecruitment({ success: true, candidates: [] }).total, 0);
});

test('unavailable or malformed data never becomes a misleading zero', () => {
  for (const value of [null, { error: 'Unavailable' }, { departments: [{ department: 'A', current: -1 }] }, { departments: [{ department: 'A', current: '12' }] }]) {
    assert.throws(() => summarizeWorkforce(value));
  }
  assert.throws(() => summarizeRecruitment({ success: false, candidates: [] }));
  assert.throws(() => summarizeProbation({ error: 'Unavailable' }));
  assert.equal(summarizeProbation({ items: [] }), 0);
  assert.equal(summarizeProbation({ items: [{ staff_id: 'test-1' }, { staff_id: 'test-2' }] }), 2);
});
