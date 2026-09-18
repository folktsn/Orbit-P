import "server-only";

import { ScanCommand, type NativeAttributeValue } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/dynamodb";
import { getEmployeesRevision } from "@/lib/employeesCache";
import { HEADCOUNT_FIELDS, createHeadcountAccumulator, type HeadcountSnapshot } from "@/lib/employee-headcount";
import { getEmployeeToday } from "@/app/employees/lib/age";

type HeadcountState = { snapshot?: HeadcountSnapshot; revision?: number; today?: string; inFlight?: Promise<HeadcountSnapshot> };
const globalCache = globalThis as typeof globalThis & { __orbitCompanyHeadcount?: HeadcountState };
const state = globalCache.__orbitCompanyHeadcount ??= {};

async function scanHeadcount(today: string, signal: AbortSignal) {
  const counts = createHeadcountAccumulator(today);
  let cursor: Record<string, NativeAttributeValue> | undefined;
  do {
    const response = await docClient.send(new ScanCommand({
      TableName: "fullstaff",
      ConsistentRead: true,
      ExclusiveStartKey: cursor,
      ProjectionExpression: HEADCOUNT_FIELDS.map((_, index) => `#f${index}`).join(", "),
      ExpressionAttributeNames: Object.fromEntries(HEADCOUNT_FIELDS.map((field, index) => [`#f${index}`, field])),
    }), { abortSignal: signal });
    for (const employee of response.Items ?? []) {
      counts.add(employee);
    }
    cursor = response.LastEvaluatedKey;
  } while (cursor);
  return counts.summarize();
}

export async function readCompanyHeadcount(): Promise<HeadcountSnapshot> {
  const today = getEmployeeToday();
  if (state.snapshot && state.revision === getEmployeesRevision() && state.today === today
    && Date.now() - Date.parse(state.snapshot.updatedAt) < 10_000) return state.snapshot;
  if (state.inFlight) return state.inFlight;

  // Share a scan across connected dashboards instead of scanning per viewer.
  state.inFlight = (async () => {
    const signal = AbortSignal.timeout(20_000);
    for (let attempt = 0; attempt < 3; attempt++) {
      const revision = getEmployeesRevision();
      const scanDate = getEmployeeToday();
      const counts = await scanHeadcount(scanDate, signal);
      if (revision !== getEmployeesRevision() || scanDate !== getEmployeeToday()) continue;
      state.snapshot = { ...counts, updatedAt: new Date().toISOString() };
      state.revision = revision;
      state.today = scanDate;
      return state.snapshot;
    }
    throw new Error("Employee data changed during the headcount refresh");
  })();
  try { return await state.inFlight; } finally { state.inFlight = undefined; }
}
