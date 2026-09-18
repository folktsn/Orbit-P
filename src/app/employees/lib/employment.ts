import { isCurrentCompanyEmployee } from "@/lib/employee-headcount";
import type { DepartureRecord } from "./resignation";

type DirectoryEmploymentRecord = DepartureRecord & {
  id: string;
  contractStart?: string;
};

// The directory and dashboard use the same effective employment dates.
export function getActiveEmployees<T extends DirectoryEmploymentRecord>(employees: T[], today: string): T[] {
  return employees.filter((employee) => isCurrentCompanyEmployee({
    staff_id: employee.id,
    status: employee.status,
    resign_status: employee.resignStatus,
    contractStart: employee.contractStart,
    resign_date: employee.resignDate,
    last_working_date: employee.lastWorkingDate,
    last_work_date: employee.lastWorkDate,
    separation_date: employee.separationDate,
  }, today));
}
