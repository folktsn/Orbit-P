"use client";

import { useRef } from "react";
import type { PayrollOffset, PayrollSheet } from "../lib/payroll";
import styles from "../EmployeesWorkspace.module.css";

const monthFormatter = new Intl.DateTimeFormat("th-TH", { month: "short", year: "numeric" });
const labels = { [-1]: "ก่อนหน้า", 0: "ปัจจุบัน", 1: "ถัดไป" };

export function NewJoinSheets({ sheets, selected, onSelect }: {
  sheets: PayrollSheet[];
  selected: PayrollOffset;
  onSelect: (offset: PayrollOffset) => void;
}) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  return (
    <div className={styles.payrollSheets} role="tablist" aria-label="Sheet รอบเงินเดือน New Join">
      {sheets.map((sheet, index) => (
        <button key={sheet.offset} type="button" role="tab"
          ref={(element) => { buttons.current[index] = element; }}
          id={`new-join-sheet-${sheet.offset + 1}`} aria-controls="new-join-sheet-panel"
          aria-selected={selected === sheet.offset} tabIndex={selected === sheet.offset ? 0 : -1}
          className={styles.payrollSheet} onClick={() => onSelect(sheet.offset)}
          onKeyDown={(event) => {
            const next = event.key === "ArrowRight" ? (index + 1) % sheets.length
              : event.key === "ArrowLeft" ? (index + sheets.length - 1) % sheets.length
                : event.key === "Home" ? 0 : event.key === "End" ? sheets.length - 1 : null;
            if (next === null) return;
            event.preventDefault();
            onSelect(sheets[next].offset);
            buttons.current[next]?.focus();
          }}>
          <span>{labels[sheet.offset]}</span>
          <strong>{monthFormatter.format(sheet.end)}</strong>
        </button>
      ))}
    </div>
  );
}
