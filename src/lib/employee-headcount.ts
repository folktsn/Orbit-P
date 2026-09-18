import { parseEmployeeDate } from "@/app/employees/lib/resignation";
import { matchesStation, normalizeSearchText } from "@/app/employees/lib/search";
import { STATION_CODES } from "@/app/components/station-map-data";

export type HeadcountSnapshot = { count: number; byStation: Record<string, number>; updatedAt: string };

export const HEADCOUNT_FIELDS = [
  "staff_id", "status", "resign_status", "resign_date", "last_working_date", "last_work_date", "separation_date",
  "start_date", "hire_date", "contractStart",
  "station", "station_th", "station_en", "work_location",
] as const;

function text(value: unknown) {
  if (typeof value !== "string") return "";
  const normalized = value.trim().toLowerCase();
  return ["", "-", "null", "undefined"].includes(normalized) ? "" : normalized;
}

function dateFrom(employee: Record<string, unknown>, fields: string[]) {
  for (const field of fields) {
    const date = parseEmployeeDate(employee[field]);
    if (date) return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  return "";
}

export function isCurrentCompanyEmployee(employee: Record<string, unknown>, today: string) {
  if (!text(employee.staff_id)) return false;
  // Match the directory's Active default for legacy records without a status.
  const status = text(employee.status) || text(employee.resign_status) || "active";
  if (["resign", "resigned", "failed probation", "terminated", "retired", "inactive", "ลาออก", "เลิกจ้าง", "เกษียณ"].includes(status)) return false;
  const start = dateFrom(employee, ["start_date", "hire_date", "contractStart"]);
  if (start && start > today) return false;
  const departure = dateFrom(employee, ["resign_date", "last_working_date", "last_work_date", "separation_date"]);
  if (departure && departure <= today) return false;
  if (status === "active") return true;
  // A pending departure remains employed until its effective date.
  return ["pending", "resigning"].includes(status) && Boolean(departure && departure > today);
}

export function createHeadcountAccumulator(today: string) {
  const countedIds = new Set<string>();
  const byStation: Record<string, number> = Object.fromEntries(STATION_CODES.map((code) => [code, 0]));
  return {
    add(employee: Record<string, unknown>) {
      if (!isCurrentCompanyEmployee(employee, today)) return;
      const id = String(employee.staff_id).trim();
      if (countedIds.has(id)) return;
      countedIds.add(id);
      // Use the directory's field precedence, then group operational sub-stations by airport.
      const station = text(employee.station)
        || [text(employee.station_th), text(employee.station_en)].filter(Boolean).join(" / ")
        || text(employee.work_location);
      const code = headcountStationCode(station);
      if (code) byStation[code]++;
    },
    summarize() { return { count: countedIds.size, byStation: { ...byStation } }; },
  };
}

function headcountStationCode(station: string) {
  const exact = STATION_CODES.find((candidate) => matchesStation(station, candidate));
  if (exact) return exact;
  const parts = normalizeSearchText(station).toUpperCase().split(/\s*\/\s*/)
    .map((part) => part.replace(/[\s[\]._-]/g, ""));
  const keys = parts.map((part) => part.replace(/[()]/g, ""));
  // Employee records use GF(BKKPA) for the BKKPA group and DMK(PA) for Don Mueang.
  if (keys.includes("GFBKKPA")) return "BKKPA";
  if (keys.includes("DMKPA")) return "DMK";
  // BKK(BM), BKK(GA-A), BKK(GC), etc. belong to BKK. BKK(PA) matched BKKPA above.
  if (parts.some((part) => /^BKK\([A-Z0-9]+\)$/.test(part))) return "BKK";
  return undefined;
}

export function parseHeadcountSnapshot(value: unknown): HeadcountSnapshot {
  const data = value as HeadcountSnapshot | null;
  if (!data || !Number.isSafeInteger(data.count) || data.count < 0
    || typeof data.updatedAt !== "string" || !Number.isFinite(Date.parse(data.updatedAt))
    || !data.byStation || typeof data.byStation !== "object" || Array.isArray(data.byStation)
    || STATION_CODES.some((code) => !Number.isSafeInteger(data.byStation[code]) || data.byStation[code] < 0 || data.byStation[code] > data.count)) {
    throw new Error("Invalid headcount");
  }
  return { count: data.count, byStation: Object.fromEntries(STATION_CODES.map((code) => [code, data.byStation[code]])), updatedAt: data.updatedAt };
}
