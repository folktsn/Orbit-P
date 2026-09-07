const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const source = readFileSync(path.resolve("src/app/employees/lib/resignation.ts"), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const moduleUnderTest = { exports: {} };
new Function("require", "module", "exports", outputText)(require, moduleUnderTest, moduleUnderTest.exports);

const {
  compareDepartureRecords,
  getDepartureDate,
  isDepartureRecord,
  parseEmployeeDate,
} = moduleUnderTest.exports;

test("resigned employees remain visible with past or missing dates", () => {
  assert.equal(isDepartureRecord({ status: "Resign", resignDate: "2023-01-01" }), true);
  assert.equal(isDepartureRecord({ status: "Resign" }), true);
  assert.equal(isDepartureRecord({ status: "Active" }), false);
});

test("alternate departure fields are recognized", () => {
  const pending = { status: "Pending", separationDate: "2026-10-01" };
  assert.equal(isDepartureRecord(pending), true);
  assert.equal(getDepartureDate(pending), "2026-10-01");
  assert.equal(isDepartureRecord({ status: "Failed Probation" }), true);
});

test("Thai Buddhist and day-first dates parse consistently", () => {
  const parts = (date) => [date.getFullYear(), date.getMonth() + 1, date.getDate()];
  assert.deepEqual(parts(parseEmployeeDate("07/09/2569")), [2026, 9, 7]);
  assert.deepEqual(parts(parseEmployeeDate("2026-09-07T00:00:00Z")), [2026, 9, 7]);
  assert.equal(parseEmployeeDate("31/02/2569"), null);
});

test("departure sorting prioritizes upcoming, recent past, then missing dates", () => {
  const today = new Date(2026, 8, 7);
  const rows = [
    { id: "4", status: "Resign" },
    { id: "3", status: "Resign", resignDate: "2025-01-01" },
    { id: "2", status: "Resign", resignDate: "2026-09-06" },
    { id: "1", status: "Pending", resignDate: "2026-09-08" },
  ];
  rows.sort((a, b) => compareDepartureRecords(a, b, today));
  assert.deepEqual(rows.map((row) => row.id), ["1", "2", "3", "4"]);
});
