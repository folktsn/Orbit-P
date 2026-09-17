import { parseEmployeeDate } from "@/app/employees/lib/resignation";

export type HeadcountSnapshot = { count: number; updatedAt: string };

export const HEADCOUNT_FIELDS = [
  "staff_id", "status", "resign_status", "resign_date", "last_working_date", "last_work_date", "separation_date",
  "start_date", "hire_date", "contractStart",
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
