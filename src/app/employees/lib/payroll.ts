import { parseEmployeeDate } from "./resignation";

export type PayrollPeriod = { start: Date; end: Date };

export function getCurrentPayrollPeriod(today: string): PayrollPeriod | null {
  const date = parseEmployeeDate(today);
  if (!date) return null;
  const endMonth = date.getMonth() + (date.getDate() > 20 ? 1 : 0);
  return {
    start: new Date(date.getFullYear(), endMonth - 1, 21),
    end: new Date(date.getFullYear(), endMonth, 20),
  };
}

export function getNewJoinEmployees<T extends { id: string; contractStart?: string }>(
  employees: T[], period: PayrollPeriod | null,
): T[] {
  if (!period) return [];
  return employees.flatMap((employee) => {
    const start = parseEmployeeDate(employee.contractStart);
    return start && start >= period.start && start <= period.end ? [{ employee, start }] : [];
  }).sort((a, b) => a.start.getTime() - b.start.getTime()
    || a.employee.id.localeCompare(b.employee.id, "en", { numeric: true }))
    .map(({ employee }) => employee);
}
