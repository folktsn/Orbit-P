import { Cake } from "lucide-react";
import { getEmployeeAge } from "../lib/age";
import styles from "../EmployeesWorkspace.module.css";

export function EmployeeAge({ birthDate, today }: { birthDate?: string; today: string }) {
  const age = getEmployeeAge(birthDate, today);
  return (
    <p className={styles.employeeAge}>
      <Cake size={13} aria-hidden="true" />
      <span>{age === null ? "อายุ: ไม่ทราบ" : `อายุ ${age} ปี`}</span>
    </p>
  );
}
