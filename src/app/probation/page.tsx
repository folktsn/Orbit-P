"use client";

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BriefcaseBusiness,
  Building2,
  CalendarCheck2,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock3,
  Database,
  Eye,
  MapPin,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_FOLLOW_UP_COMMENT_LENGTH } from "@/lib/probationFollowUp";
import { CustomSelect } from "@/components/ui/CustomSelect";
import {
  EmployeeProfileDrawer,
  type EmployeeData,
} from "@/app/employees/components/EmployeeProfileDrawer";
import styles from "@/app/employees/EmployeesWorkspace.module.css";
import probationStyles from "./ProbationWorkspace.module.css";
import { EmployeeAge } from "@/app/employees/components/EmployeeAge";
import { useEmployeeToday } from "@/app/employees/lib/useEmployeeToday";

type RawEmployee = Record<string, unknown>;
type Urgency = "all" | "overdue" | "due30" | "due60" | "later" | "missing";
type FollowUpFilter = "followUp1" | "followUp2" | "followUp3";
type ListFilter = Urgency | FollowUpFilter;
type EvaluationPeriodFilter = Extract<Urgency, "due30" | "due60" | "later">;
type FollowUpSlot = 1 | 2 | 3;
type Evaluator = {
  employeeId: string;
  name: string;
  nameEn: string;
  position: string;
};
type FollowUpEntry = {
  date: string;
  evaluatorId: string;
  evaluatorName: string;
  evaluatorNameEn: string;
  evaluatorPosition: string;
  comment: string;
  attachmentName: string;
  attachmentData: string;
};
type FollowUpEntries = [FollowUpEntry, FollowUpEntry, FollowUpEntry];

type ProbationRecord = {
  raw: RawEmployee;
  employee: EmployeeData;
  searchText: string;
  endDate: Date | null;
  startDate: Date | null;
  daysRemaining: number | null;
  probationDays: number;
  inferredEndDate: boolean;
  urgency: Exclude<Urgency, "all">;
  followUps: FollowUpEntries;
};

type ProbationResponse = {
  items?: RawEmployee[];
  fetchedAt?: string;
  error?: string;
};

const COLOR_CLASSES = [
  "bg-emerald-500",
  "bg-sky-500",
  "bg-pink-500",
  "bg-amber-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-indigo-500",
];

const QUICK_FILTER_OPTIONS: Array<{ value: ListFilter; label: string }> = [
  { value: "all", label: "ทั้งหมด" },
  { value: "overdue", label: "เลยกำหนด" },
  { value: "missing", label: "ข้อมูลไม่ครบ" },
];

const EVALUATION_PERIOD_OPTIONS: Array<{ value: EvaluationPeriodFilter; label: string }> = [
  { value: "due30", label: "30 วัน" },
  { value: "due60", label: "60 วัน" },
  { value: "later", label: "90 วัน" },
];

const FOLLOW_UP_FILTER_OPTIONS: Array<{ value: FollowUpFilter; label: string }> = [
  { value: "followUp1", label: "ติดตาม ครั้งที่ 1" },
  { value: "followUp2", label: "ติดตาม ครั้งที่ 2" },
  { value: "followUp3", label: "ติดตาม ครั้งที่ 3" },
];

function hasCompletedFollowUp(record: ProbationRecord, filter: FollowUpFilter) {
  const followUpIndex: Record<FollowUpFilter, number> = {
    followUp1: 0,
    followUp2: 1,
    followUp3: 2,
  };

  return hasValue(record.followUps[followUpIndex[filter]]?.date);
}

function hasValue(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized !== "" && normalized !== "-" && normalized !== "undefined" && normalized !== "null";
}

function valueOf(item: RawEmployee, fields: readonly string[], fallback = "-") {
  for (const field of fields) {
    if (hasValue(item[field])) return String(item[field]).trim();
  }
  return fallback;
}

function dualLanguage(item: RawEmployee, thaiField: string, englishField: string, fallbackField: string) {
  const thai = valueOf(item, [thaiField], "");
  const english = valueOf(item, [englishField], "");
  const fallback = valueOf(item, [fallbackField], "-");
  if (thai && english && thai.toLowerCase() !== english.toLowerCase()) return `${thai} / ${english}`;
  return thai || english || fallback;
}

function parseDateOnly(value: unknown) {
  if (!hasValue(value)) return null;
  const input = String(value).trim();
  const isoDate = input.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (isoDate) {
    const date = new Date(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const displayDate = input.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (displayDate) {
    const date = new Date(Number(displayDate[3]), Number(displayDate[2]) - 1, Number(displayDate[1]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function dateDifferenceInDays(target: Date) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

const dateFormatter = new Intl.DateTimeFormat("th-TH", { day: "2-digit", month: "short", year: "numeric" });
const updatedAtFormatter = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" });

function formatDate(date: Date | null) {
  if (!date) return "-";
  return dateFormatter.format(date);
}

function todayDateOnly() {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
}

function followUpsFromRecord(item: RawEmployee): FollowUpEntries {
  return ([1, 2, 3] as FollowUpSlot[]).map((slot) => ({
    date: valueOf(item, [`probation_follow_up_${slot}_date`], ""),
    evaluatorId: valueOf(item, [`probation_follow_up_${slot}_evaluator_id`], ""),
    evaluatorName: valueOf(item, [`probation_follow_up_${slot}_evaluator_name`], ""),
    evaluatorNameEn: valueOf(item, [`probation_follow_up_${slot}_evaluator_name_en`], ""),
    evaluatorPosition: valueOf(item, [`probation_follow_up_${slot}_evaluator_position`], ""),
    comment: typeof item[`probation_follow_up_${slot}_comment`] === "string" ? item[`probation_follow_up_${slot}_comment`] as string : "",
    attachmentName: valueOf(item, [`probation_follow_up_${slot}_attachment_name`], ""),
    attachmentData: valueOf(item, [`probation_follow_up_${slot}_attachment_data`], ""),
  })) as FollowUpEntries;
}

function cleanName(value: string, language: "th" | "en") {
  if (value === "-") return value;
  if (language === "th") return value.replace(/^(?:นาย|นางสาว|นาง)\s*/, "").trim();
  return value.replace(/^(?:Mr\.?|Mrs\.?|Miss|Ms\.?|Dr\.?)\s*/i, "").trim();
}

function initialsFromName(name: string) {
  const parts = cleanName(name, "en").split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts.at(-1)?.[0] ?? ""}`.toUpperCase();
  return (parts[0] || "EMP").slice(0, 2).toUpperCase();
}

function colorFromId(id: string) {
  let hash = 0;
  for (const character of id) hash = character.charCodeAt(0) + ((hash << 5) - hash);
  return COLOR_CLASSES[Math.abs(hash) % COLOR_CLASSES.length];
}

function probationDaysFromRecord(item: RawEmployee) {
  const rawValue = valueOf(item, [
    "probation_days",
    "probation_day",
    "probation_period_days",
    "probation_duration_days",
    "probation_total_days",
    "prob_days",
    "prob_period",
  ], "119");
  const parsed = Number.parseInt(rawValue.replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 119;
}

function buildEmployeeData(item: RawEmployee): EmployeeData {
  const id = valueOf(item, ["emp_code", "staff_id", "employeeId", "id"], "N/A");
  const titleThai = valueOf(item, ["title_th"], "");
  const titleEnglish = valueOf(item, ["title_en"], "");
  const firstThai = valueOf(item, ["first_name_th"], "");
  const lastThai = valueOf(item, ["last_name_th"], "");
  const firstEnglish = valueOf(item, ["first_name_en"], "");
  const lastEnglish = valueOf(item, ["last_name_en"], "");
  const rawThaiName = firstThai || lastThai
    ? `${firstThai} ${lastThai}`.trim()
    : valueOf(item, ["name_th", "name"], "-");
  const rawEnglishName = firstEnglish || lastEnglish
    ? `${firstEnglish} ${lastEnglish}`.trim()
    : valueOf(item, ["name_en"], "-");
  const thaiName = cleanName(rawThaiName, "th");
  const englishName = cleanName(rawEnglishName, "en");
  const probationEnd = valueOf(item, ["probation_end_date", "probation_end"], "-");

  return {
    id,
    name: titleThai && thaiName !== "-" ? `${titleThai}${thaiName}` : thaiName,
    nameEn: titleEnglish && englishName !== "-" ? `${titleEnglish} ${englishName}` : englishName,
    initials: initialsFromName(englishName),
    colorClass: colorFromId(id),
    title: dualLanguage(item, "position_th", "position_en", "position"),
    department: dualLanguage(item, "department_th", "department_en", "department"),
    station: dualLanguage(item, "station_th", "station_en", "station"),
    division: dualLanguage(item, "division_th", "division_en", "division"),
    section: dualLanguage(item, "section_th", "section_en", "section"),
    unit: dualLanguage(item, "unit_th", "unit_en", "unit"),
    supervisor: valueOf(item, ["supervisor"]),
    status: valueOf(item, ["status"], "Active"),
    empType: valueOf(item, ["emp_type"], "Probation"),
    contractStart: valueOf(item, ["start_date", "hire_date", "contractStart"]),
    contractEnd: valueOf(item, ["contractEnd", "contract_end"]),
    probationEnd,
    probationDays: probationDaysFromRecord(item),
    resignDate: valueOf(item, ["resign_date"], "-"),
    gender: valueOf(item, ["gender"]),
    nationality: valueOf(item, ["nationality"]),
    idCard: valueOf(item, ["id_card"]),
    birthDate: valueOf(item, ["birth_date"], "-"),
    email: valueOf(item, ["email"]),
    phone: valueOf(item, ["phone"]),
    address: valueOf(item, ["address"]),
    emergencyContact: valueOf(item, ["emergency_contact"]),
    emergencyContactName: valueOf(item, ["emergency_contact_name"], ""),
    emergencyContactRelation: valueOf(item, ["emergency_contact_relation"], ""),
    emergencyContactPhone: valueOf(item, ["emergency_contact_phone"], ""),
    education: valueOf(item, ["education"]),
    workHistory: valueOf(item, ["work_history"]),
    bankAccount: valueOf(item, ["bank_account_no", "bank_account"]),
    nickname: valueOf(item, ["nickname"], ""),
    titlePrefix: titleThai && titleEnglish ? `${titleThai} / ${titleEnglish}` : titleThai || titleEnglish,
    firstNameTh: firstThai || undefined,
    lastNameTh: lastThai || undefined,
    firstNameEn: firstEnglish || undefined,
    lastNameEn: lastEnglish || undefined,
    probationOutcome: valueOf(item, ["probation_outcome"]),
    lastWorkingDate: valueOf(item, ["last_working_date", "last_work_date"], "-"),
    probationExtensionDays: Number(valueOf(item, ["probation_extension_days"], "0")) || 0,
  };
}

function buildProbationRecord(item: RawEmployee): ProbationRecord {
  const employee = buildEmployeeData(item);
  const startDate = parseDateOnly(valueOf(item, ["start_date", "hire_date", "contractStart"], ""));
  const explicitEndDate = parseDateOnly(valueOf(item, ["probation_end_date", "probation_end"], ""));
  const probationDays = probationDaysFromRecord(item);
  let endDate = explicitEndDate;
  let inferredEndDate = false;

  if (!endDate && startDate) {
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + probationDays - 1);
    inferredEndDate = true;
    employee.probationEnd = [
      endDate.getFullYear(),
      String(endDate.getMonth() + 1).padStart(2, "0"),
      String(endDate.getDate()).padStart(2, "0"),
    ].join("-");
  }

  const daysRemaining = endDate ? dateDifferenceInDays(endDate) : null;
  let urgency: ProbationRecord["urgency"] = "missing";
  if (daysRemaining !== null && daysRemaining < 0) urgency = "overdue";
  else if (daysRemaining !== null && daysRemaining <= 30) urgency = "due30";
  else if (daysRemaining !== null && daysRemaining <= 60) urgency = "due60";
  else if (daysRemaining !== null) urgency = "later";

  return {
    raw: item,
    employee,
    searchText: [employee.id, employee.name, employee.nameEn, employee.title, employee.department,
      employee.division, employee.section, employee.unit, employee.station].join(" ").toLowerCase(),
    endDate,
    startDate,
    daysRemaining,
    probationDays,
    inferredEndDate,
    urgency,
    followUps: followUpsFromRecord(item),
  };
}

function urgencyLabel(record: ProbationRecord) {
  if (record.daysRemaining === null) return "ต้องตรวจสอบวันที่";
  if (record.daysRemaining < 0) return `เลยกำหนด ${Math.abs(record.daysRemaining).toLocaleString()} วัน`;
  if (record.daysRemaining === 0) return "ครบกำหนดวันนี้";
  return `เหลือ ${record.daysRemaining.toLocaleString()} วัน`;
}

function urgencyStyle(urgency: ProbationRecord["urgency"]) {
  if (urgency === "overdue") return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300";
  if (urgency === "due30") return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300";
  if (urgency === "due60") return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-300";
  if (urgency === "missing") return "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200";
  return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300";
}

function FollowUpDialog({
  record,
  onClose,
  onSaved,
}: {
  record: ProbationRecord;
  onClose: () => void;
  onSaved: (employeeId: string, slot: FollowUpSlot, entry: FollowUpEntry) => void;
}) {
  const [entries, setEntries] = useState<FollowUpEntries>(record.followUps);
  const [evaluators, setEvaluators] = useState<Array<Evaluator | null>>(
    record.followUps.map((entry) => entry.evaluatorId && (entry.evaluatorName || entry.evaluatorNameEn)
      ? {
          employeeId: entry.evaluatorId,
          name: entry.evaluatorName,
          nameEn: entry.evaluatorNameEn,
          position: entry.evaluatorPosition,
        }
      : null),
  );
  const [savingSlot, setSavingSlot] = useState<FollowUpSlot | null>(null);
  const [lookingUpSlot, setLookingUpSlot] = useState<FollowUpSlot | null>(null);
  const [savedSlot, setSavedSlot] = useState<FollowUpSlot | null>(null);
  const [slotErrors, setSlotErrors] = useState<Partial<Record<FollowUpSlot, string>>>({});
  const lookupTimersRef = useRef<Array<number | null>>([null, null, null]);
  const lookupVersionsRef = useRef([0, 0, 0]);
  const latestAllowedDate = todayDateOnly();

  useEffect(() => () => {
    lookupTimersRef.current.forEach((timer) => {
      if (timer) window.clearTimeout(timer);
    });
  }, []);

  const updateEntry = (slot: FollowUpSlot, changes: Partial<FollowUpEntry>) => {
    setEntries((current) => {
      const next = [...current] as FollowUpEntries;
      next[slot - 1] = { ...next[slot - 1], ...changes };
      return next;
    });
    setSavedSlot(null);
    setSlotErrors((current) => ({ ...current, [slot]: "" }));
  };

  const setEvaluator = (slot: FollowUpSlot, evaluator: Evaluator | null) => {
    setEvaluators((current) => {
      const next = [...current];
      next[slot - 1] = evaluator;
      return next;
    });
  };

  const lookupEvaluator = async (slot: FollowUpSlot, requestedId?: string) => {
    const evaluatorId = (requestedId ?? entries[slot - 1].evaluatorId).trim();
    if (!evaluatorId) throw new Error("กรุณากรอกรหัสพนักงานผู้ติดตาม");

    const lookupIndex = slot - 1;
    const pendingTimer = lookupTimersRef.current[lookupIndex];
    if (pendingTimer) window.clearTimeout(pendingTimer);
    lookupTimersRef.current[lookupIndex] = null;

    const lookupVersion = ++lookupVersionsRef.current[lookupIndex];
    setLookingUpSlot(slot);
    setSlotErrors((current) => ({ ...current, [slot]: "" }));
    try {
      const response = await fetch(`/api/probation/follow-up?employeeId=${encodeURIComponent(evaluatorId)}`, {
        cache: "no-store",
      });
      const payload = await response.json() as { evaluator?: Evaluator; error?: string };
      if (!response.ok || !payload.evaluator) {
        throw new Error(payload.error || "ไม่พบข้อมูลผู้ติดตาม");
      }
      if (lookupVersion !== lookupVersionsRef.current[lookupIndex]) return null;

      setEvaluator(slot, payload.evaluator);
      updateEntry(slot, {
        evaluatorId: payload.evaluator.employeeId,
        evaluatorName: payload.evaluator.name,
        evaluatorNameEn: payload.evaluator.nameEn,
        evaluatorPosition: payload.evaluator.position,
      });
      return payload.evaluator;
    } catch (error) {
      if (lookupVersion !== lookupVersionsRef.current[lookupIndex]) return null;
      const message = error instanceof Error ? error.message : "ไม่สามารถตรวจสอบผู้ติดตามได้";
      setEvaluator(slot, null);
      setSlotErrors((current) => ({ ...current, [slot]: message }));
      throw error;
    } finally {
      if (lookupVersion === lookupVersionsRef.current[lookupIndex]) {
        setLookingUpSlot((current) => current === slot ? null : current);
      }
    }
  };

  const scheduleEvaluatorLookup = (slot: FollowUpSlot, value: string) => {
    const index = slot - 1;
    lookupVersionsRef.current[index] += 1;
    const currentTimer = lookupTimersRef.current[index];
    if (currentTimer) window.clearTimeout(currentTimer);

    updateEntry(slot, { evaluatorId: value });
    setEvaluator(slot, null);

    const evaluatorId = value.trim();
    if (evaluatorId.length < 5) {
      setLookingUpSlot((current) => current === slot ? null : current);
      return;
    }

    lookupTimersRef.current[index] = window.setTimeout(() => {
      void lookupEvaluator(slot, evaluatorId).catch(() => undefined);
    }, 450);
  };

  const viewImage = async (slot: FollowUpSlot) => {
    const entry = entries[slot - 1];
    const previewWindow = window.open("", "_blank");
    try {
      const response = await fetch(
        `/api/attachments?key=${encodeURIComponent(entry.attachmentData)}&disposition=inline&name=${encodeURIComponent(entry.attachmentName || "follow-up-image")}`,
      );
      const payload = await response.json() as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error || "ไม่สามารถเปิดรูปได้");
      if (previewWindow) previewWindow.location.href = payload.url;
      else window.location.href = payload.url;
    } catch (error) {
      previewWindow?.close();
      setSlotErrors((current) => ({
        ...current,
        [slot]: error instanceof Error ? error.message : "ไม่สามารถเปิดรูปได้",
      }));
    }
  };

  const saveFollowUp = async (slot: FollowUpSlot) => {
    const currentEntry = entries[slot - 1];
    const date = currentEntry.date || latestAllowedDate;
    setSlotErrors((current) => ({ ...current, [slot]: "" }));

    try {
      let evaluator = evaluators[slot - 1];
      if (!evaluator || evaluator.employeeId !== currentEntry.evaluatorId.trim()) {
        evaluator = await lookupEvaluator(slot);
      }
      if (!evaluator) throw new Error("กรุณารอการตรวจสอบรหัสพนักงานผู้ติดตาม");

      setSavingSlot(slot);
      const response = await fetch("/api/probation/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: record.employee.id,
          followUpNumber: slot,
          followUpDate: date,
          evaluatorId: evaluator.employeeId,
          comment: currentEntry.comment,
        }),
      });
      const payload = await response.json() as {
        error?: string;
        evaluator?: Evaluator;
        comment?: string;
      };
      if (!response.ok || !payload.evaluator) throw new Error(payload.error || "ไม่สามารถบันทึกการติดตามได้");

      const savedEntry: FollowUpEntry = {
        date,
        evaluatorId: payload.evaluator.employeeId,
        evaluatorName: payload.evaluator.name,
        evaluatorNameEn: payload.evaluator.nameEn,
        evaluatorPosition: payload.evaluator.position,
        comment: payload.comment ?? currentEntry.comment,
        attachmentName: currentEntry.attachmentName,
        attachmentData: currentEntry.attachmentData,
      };

      updateEntry(slot, savedEntry);
      setEvaluator(slot, payload.evaluator);
      onSaved(record.employee.id, slot, savedEntry);
      setSavedSlot(slot);
    } catch (error) {
      setSlotErrors((current) => ({
        ...current,
        [slot]: error instanceof Error ? error.message : "ไม่สามารถบันทึกการติดตามได้",
      }));
    } finally {
      setSavingSlot(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-2 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && savingSlot === null) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="follow-up-title"
        className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#121212]"
      >
        <header className="flex items-start justify-between gap-3 px-3 pb-1.5 pt-2.5 dark:border-white/10">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400">
              <CalendarCheck2 className="size-3.5" />
              Probation Follow-up
            </div>
            <h2 id="follow-up-title" className="mt-0.5 truncate text-base font-bold text-slate-950 dark:text-white">
              บันทึกการติดตามผล
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={savingSlot !== null}
            title="ปิด"
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-950 disabled:opacity-50 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X className="size-4" />
          </button>
        </header>

        <section aria-label="ข้อมูลพนักงานผู้ถูกติดตาม" className="border-b border-slate-200 px-3 pb-2.5 dark:border-white/10">
          <div className="flex min-w-0 items-start gap-2.5">
            <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white", record.employee.colorClass)}>
              {record.employee.initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-[10px] font-bold uppercase text-sky-600 dark:text-sky-400">ผู้ถูกติดตาม</span>
                <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">ID {record.employee.id}</span>
              </div>
              <p className="text-xs font-bold leading-snug text-slate-950 dark:text-white">
                {record.employee.nameEn}
                {record.employee.name !== "-" && <span className="font-medium text-slate-600 dark:text-slate-300"> · {record.employee.name}</span>}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-600 dark:text-slate-400">{record.employee.title}</p>
            </div>
            <span className={cn("hidden shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold sm:inline-flex", urgencyStyle(record.urgency))}>
              {urgencyLabel(record)}
            </span>
          </div>
          <div className="mt-1.5 grid gap-x-3 gap-y-0.5 text-[10px] text-slate-500 dark:text-slate-400 sm:grid-cols-2">
            <span className="flex min-w-0 items-center gap-1.5"><Building2 className="size-3.5 shrink-0" /><span className="truncate">{record.employee.department}</span></span>
            <span className="flex min-w-0 items-center gap-1.5"><MapPin className="size-3.5 shrink-0" /><span className="truncate">{record.employee.station}</span></span>
            <span className="flex min-w-0 items-center gap-1.5 sm:col-span-2"><CalendarClock className="size-3.5 shrink-0" /><span className="truncate">เริ่ม {formatDate(record.startDate)} · ครบกำหนด {formatDate(record.endDate)}</span></span>
          </div>
        </section>

        <div className="space-y-1.5 overflow-y-auto px-3 py-2">
          {([1, 2, 3] as FollowUpSlot[]).map((slot) => {
            const entry = entries[slot - 1];
            const evaluator = evaluators[slot - 1];
            const isSaving = savingSlot === slot;
            const isLookingUp = lookingUpSlot === slot;
            return (
              <div key={slot} className="rounded-lg border border-slate-200 px-2.5 py-2 dark:border-white/10 dark:bg-white/[0.02]">
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold text-slate-950 dark:text-white">การติดตามครั้งที่ {slot}</h3>
                  {entry.date ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <Check className="size-3.5" /> ติดตามเมื่อ {formatDate(parseDateOnly(entry.date))}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">ยังไม่ได้ติดตาม</span>
                  )}
                </div>

                <div className="grid gap-1.5 sm:grid-cols-2">
                  <label className="block min-w-0">
                    <span className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">วันที่ติดตาม</span>
                    <input
                      type="date"
                      value={entry.date}
                      max={latestAllowedDate}
                      onChange={(event) => updateEntry(slot, { date: event.target.value })}
                      disabled={savingSlot !== null}
                      aria-label={`วันที่ติดตามครั้งที่ ${slot}`}
                      className="h-8 w-full min-w-0 rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-950 outline-none focus:border-sky-500 disabled:opacity-60 dark:border-white/15 dark:bg-[#0a0a0a] dark:text-white"
                    />
                  </label>

                  <label className="block min-w-0">
                    <span className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      รหัสผู้ติดตาม <span className="font-normal text-slate-400">(อัตโนมัติ)</span>
                    </span>
                    <span className="relative block">
                      <input
                        value={entry.evaluatorId}
                        onChange={(event) => scheduleEvaluatorLookup(slot, event.target.value)}
                        disabled={savingSlot !== null}
                        placeholder="เช่น 05283"
                        aria-label={`รหัสพนักงานผู้ติดตามครั้งที่ ${slot}`}
                        className="h-8 w-full min-w-0 rounded-md border border-slate-300 bg-white px-2.5 pr-8 text-xs text-slate-950 outline-none focus:border-sky-500 disabled:opacity-60 dark:border-white/15 dark:bg-[#0a0a0a] dark:text-white"
                      />
                      {isLookingUp && (
                        <RefreshCw className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-sky-500" />
                      )}
                    </span>
                  </label>
                </div>

                {evaluator && (
                  <div className="mt-2 border-l-2 border-sky-500 pl-2 text-xs">
                    <p className="font-semibold leading-tight text-slate-950 dark:text-white">
                      {evaluator.name}{evaluator.nameEn ? ` / ${evaluator.nameEn}` : ""}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-tight text-slate-500 dark:text-slate-400">{evaluator.position}</p>
                  </div>
                )}

                <label className="mt-2 block min-w-0">
                  <span className="mb-1 flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">Comment <span className="font-normal">(ไม่บังคับ)</span></span>
                    <span>{entry.comment.length.toLocaleString()}/{MAX_FOLLOW_UP_COMMENT_LENGTH.toLocaleString()}</span>
                  </span>
                  <textarea
                    rows={2}
                    value={entry.comment}
                    maxLength={MAX_FOLLOW_UP_COMMENT_LENGTH}
                    onChange={(event) => updateEntry(slot, { comment: event.target.value })}
                    disabled={savingSlot !== null}
                    aria-label={`Comment การติดตามครั้งที่ ${slot}`}
                    className="block min-h-14 w-full min-w-0 resize-y rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs leading-5 text-slate-950 outline-none focus:border-sky-500 disabled:opacity-60 dark:border-white/15 dark:bg-[#0a0a0a] dark:text-white"
                  />
                </label>

                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    {entry.attachmentData && (
                      <button
                        type="button"
                        onClick={() => void viewImage(slot)}
                        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-sky-700 hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-sky-950/30"
                        title={entry.attachmentName || "ดูรูปเดิม"}
                        aria-label={`ดูรูปเดิมการติดตามครั้งที่ ${slot}`}
                      >
                        <Eye className="size-3.5" />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void saveFollowUp(slot)}
                    aria-label={`บันทึกการติดตามครั้งที่ ${slot}`}
                    disabled={savingSlot !== null || lookingUpSlot !== null}
                    className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-2.5 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
                  >
                    {isSaving ? <RefreshCw className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                    {entry.date ? "บันทึกการติดตาม" : "ติดตามแล้ววันนี้"}
                  </button>
                </div>

                {slotErrors[slot] && (
                  <p role="alert" className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-300">
                    {slotErrors[slot]}
                  </p>
                )}
              </div>
            );
          })}

          {savedSlot && !slotErrors[savedSlot] && (
            <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300">
              บันทึกการติดตามครั้งที่ {savedSlot} เรียบร้อยแล้ว
            </p>
          )}
        </div>

      </section>
    </div>
  );
}

function BulkFollowUpDialog({
  records,
  onClose,
  onSaved,
  onComplete,
}: {
  records: ProbationRecord[];
  onClose: () => void;
  onSaved: (employeeId: string, slot: FollowUpSlot, entry: FollowUpEntry) => void;
  onComplete: () => void;
}) {
  const [slot, setSlot] = useState<FollowUpSlot>(1);
  const [followUpDate, setFollowUpDate] = useState(todayDateOnly());
  const [comments, setComments] = useState<Record<FollowUpSlot, string>>({ 1: "", 2: "", 3: "" });
  const [evaluatorId, setEvaluatorId] = useState("");
  const [evaluator, setEvaluator] = useState<Evaluator | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const lookupTimerRef = useRef<number | null>(null);
  const lookupVersionRef = useRef(0);

  const pendingRecords = useMemo(
    () => records.filter((record) => !hasValue(record.followUps[slot - 1]?.date)),
    [records, slot],
  );
  const skippedCount = records.length - pendingRecords.length;

  useEffect(() => () => {
    if (lookupTimerRef.current) window.clearTimeout(lookupTimerRef.current);
  }, []);

  const lookupEvaluator = async (requestedId?: string) => {
    const normalizedId = (requestedId ?? evaluatorId).trim();
    if (!normalizedId) throw new Error("กรุณากรอกรหัสพนักงานผู้ติดตาม");

    if (lookupTimerRef.current) window.clearTimeout(lookupTimerRef.current);
    lookupTimerRef.current = null;
    const lookupVersion = ++lookupVersionRef.current;
    setIsLookingUp(true);
    setError("");
    try {
      const response = await fetch(`/api/probation/follow-up?employeeId=${encodeURIComponent(normalizedId)}`, {
        cache: "no-store",
      });
      const payload = await response.json() as { evaluator?: Evaluator; error?: string };
      if (!response.ok || !payload.evaluator) throw new Error(payload.error || "ไม่พบข้อมูลผู้ติดตาม");
      if (lookupVersion !== lookupVersionRef.current) return null;
      setEvaluator(payload.evaluator);
      setEvaluatorId(payload.evaluator.employeeId);
      return payload.evaluator;
    } catch (lookupError) {
      if (lookupVersion !== lookupVersionRef.current) return null;
      setEvaluator(null);
      setError(lookupError instanceof Error ? lookupError.message : "ไม่สามารถตรวจสอบผู้ติดตามได้");
      throw lookupError;
    } finally {
      if (lookupVersion === lookupVersionRef.current) setIsLookingUp(false);
    }
  };

  const scheduleEvaluatorLookup = (value: string) => {
    lookupVersionRef.current += 1;
    if (lookupTimerRef.current) window.clearTimeout(lookupTimerRef.current);
    setEvaluatorId(value);
    setEvaluator(null);
    setError("");

    const normalizedId = value.trim();
    if (normalizedId.length < 5) {
      setIsLookingUp(false);
      return;
    }
    lookupTimerRef.current = window.setTimeout(() => {
      void lookupEvaluator(normalizedId).catch(() => undefined);
    }, 450);
  };

  const saveBulkFollowUp = async () => {
    setError("");
    if (pendingRecords.length === 0) {
      setError(`พนักงานที่เลือกมีข้อมูลการติดตามครั้งที่ ${slot} ครบแล้ว`);
      return;
    }

    try {
      let verifiedEvaluator = evaluator;
      if (!verifiedEvaluator || verifiedEvaluator.employeeId !== evaluatorId.trim()) {
        verifiedEvaluator = await lookupEvaluator();
      }
      if (!verifiedEvaluator) throw new Error("กรุณารอการตรวจสอบรหัสพนักงานผู้ติดตาม");

      setIsSaving(true);
      setProgress(0);
      const failedEmployeeIds: string[] = [];
      let completed = 0;

      for (let index = 0; index < pendingRecords.length; index += 5) {
        const batch = pendingRecords.slice(index, index + 5);
        const results = await Promise.allSettled(batch.map(async (record) => {
          const response = await fetch("/api/probation/follow-up", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              employeeId: record.employee.id,
              followUpNumber: slot,
              followUpDate,
              evaluatorId: verifiedEvaluator.employeeId,
              comment: comments[slot],
            }),
          });
          const payload = await response.json() as {
            error?: string;
            evaluator?: Evaluator;
            comment?: string;
          };
          if (!response.ok || !payload.evaluator) {
            throw new Error(payload.error || "ไม่สามารถบันทึกการติดตามได้");
          }

          const savedEntry: FollowUpEntry = {
            date: followUpDate,
            evaluatorId: payload.evaluator.employeeId,
            evaluatorName: payload.evaluator.name,
            evaluatorNameEn: payload.evaluator.nameEn,
            evaluatorPosition: payload.evaluator.position,
            comment: payload.comment ?? comments[slot],
            attachmentName: record.followUps[slot - 1].attachmentName,
            attachmentData: record.followUps[slot - 1].attachmentData,
          };
          return { employeeId: record.employee.id, savedEntry };
        }));

        results.forEach((result, resultIndex) => {
          const employeeId = batch[resultIndex].employee.id;
          if (result.status === "fulfilled") {
            onSaved(employeeId, slot, result.value.savedEntry);
          } else {
            failedEmployeeIds.push(employeeId);
          }
        });
        completed += batch.length;
        setProgress(completed);
      }

      if (failedEmployeeIds.length > 0) {
        setError(
          `บันทึกสำเร็จ ${pendingRecords.length - failedEmployeeIds.length} คน และไม่สำเร็จ ${failedEmployeeIds.length} คน (${failedEmployeeIds.join(", ")})`,
        );
        return;
      }
      onComplete();
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "ไม่สามารถบันทึกการติดตามแบบกลุ่มได้");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !isSaving) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-follow-up-title"
        className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#121212]"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-white/10">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400">
              <CalendarCheck2 className="size-3.5" />
              Probation Follow-up
            </div>
            <h2 id="bulk-follow-up-title" className="mt-0.5 text-base font-bold text-slate-950 dark:text-white">
              บันทึกการติดตาม {records.length.toLocaleString()} คน
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            title="ปิด"
            className="flex size-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-white/10"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 space-y-3 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block min-w-0">
              <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">ครั้งที่ติดตาม</span>
              <select
                value={slot}
                onChange={(event) => setSlot(Number(event.target.value) as FollowUpSlot)}
                disabled={isSaving}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-sky-500 dark:border-white/15 dark:bg-[#0a0a0a] dark:text-white"
              >
                <option value={1}>ครั้งที่ 1</option>
                <option value={2}>ครั้งที่ 2</option>
                <option value={3}>ครั้งที่ 3</option>
              </select>
            </label>
            <label className="block min-w-0">
              <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">วันที่ติดตาม</span>
              <input
                type="date"
                value={followUpDate}
                max={todayDateOnly()}
                onChange={(event) => setFollowUpDate(event.target.value)}
                disabled={isSaving}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-sky-500 dark:border-white/15 dark:bg-[#0a0a0a] dark:text-white"
              />
            </label>
          </div>

          <label className="block min-w-0">
            <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">รหัสพนักงานผู้ติดตาม</span>
            <span className="relative block">
              <input
                value={evaluatorId}
                onChange={(event) => scheduleEvaluatorLookup(event.target.value)}
                disabled={isSaving}
                placeholder="เช่น 05283"
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 pr-9 text-sm text-slate-950 outline-none focus:border-sky-500 dark:border-white/15 dark:bg-[#0a0a0a] dark:text-white"
              />
              {isLookingUp && <RefreshCw className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-sky-500" />}
            </span>
          </label>

          {evaluator && (
            <div className="border-l-2 border-sky-500 pl-2 text-xs">
              <p className="font-semibold text-slate-950 dark:text-white">
                {evaluator.name}{evaluator.nameEn ? ` / ${evaluator.nameEn}` : ""}
              </p>
              <p className="mt-0.5 text-slate-500 dark:text-slate-400">{evaluator.position}</p>
            </div>
          )}

          <label className="block min-w-0">
            <span className="mb-1 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-600 dark:text-slate-300">Comment <span className="font-normal">(ไม่บังคับ)</span></span>
              <span>{comments[slot].length.toLocaleString()}/{MAX_FOLLOW_UP_COMMENT_LENGTH.toLocaleString()}</span>
            </span>
            <textarea
              rows={3}
              value={comments[slot]}
              maxLength={MAX_FOLLOW_UP_COMMENT_LENGTH}
              onChange={(event) => setComments((current) => ({ ...current, [slot]: event.target.value }))}
              disabled={isSaving}
              aria-label={`Comment การติดตามครั้งที่ ${slot} สำหรับพนักงานที่เลือก`}
              className="block w-full min-w-0 resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-sky-500 disabled:opacity-60 dark:border-white/15 dark:bg-[#0a0a0a] dark:text-white"
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2 text-xs dark:bg-white/5">
            <span className="text-slate-600 dark:text-slate-300">พร้อมบันทึก {pendingRecords.length.toLocaleString()} คน</span>
            {skippedCount > 0 && <span className="text-amber-600 dark:text-amber-300">ข้ามข้อมูลเดิม {skippedCount.toLocaleString()} คน</span>}
          </div>

          {error && <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-300">{error}</p>}

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-3 dark:border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="h-9 rounded-md px-3 text-xs font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-white/10"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={() => void saveBulkFollowUp()}
              disabled={isSaving || isLookingUp || pendingRecords.length === 0}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
            >
              {isSaving ? <RefreshCw className="size-4 animate-spin" /> : <Check className="size-4" />}
              {isSaving ? `กำลังบันทึก ${progress}/${pendingRecords.length}` : `บันทึก ${pendingRecords.length.toLocaleString()} คน`}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  helper: string;
  icon: typeof Users;
  tone: string;
}) {
  return (
    <div className={probationStyles.metric}>
      <div className={cn("flex size-7 shrink-0 items-center justify-center rounded-md", tone)}>
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className={probationStyles.metricLabel}>{label}</p>
        <p className={probationStyles.metricValue}>{value.toLocaleString()}</p>
        <p className={probationStyles.metricHelper}>{helper}</p>
      </div>
    </div>
  );
}

const ProbationCard = memo(function ProbationCard({ record, selected, onOpen, onFollowUp, onToggle, today }: {
  record: ProbationRecord;
  selected: boolean;
  onOpen: (employee: EmployeeData) => void;
  onFollowUp: (record: ProbationRecord) => void;
  onToggle: (employeeId: string) => void;
  today: string;
}) {
  const name = record.employee.nameEn !== "-" ? record.employee.nameEn : record.employee.name;
  const completedCount = record.followUps.filter((entry) => hasValue(entry.date)).length;
  return (
    <li className={styles.employeeItem}>
      <article className={cn(styles.employeeCard, selected && probationStyles.selectedCard)}>
        <button type="button" className={styles.openEmployee} onClick={() => onOpen(record.employee)}
          aria-label={`เปิดข้อมูลพนักงาน ${name} (${record.employee.id})`} />
        <div className={styles.employeeIdentity}>
          <span className={cn(styles.avatar, record.employee.colorClass)}>{record.employee.initials}</span>
          <div className={styles.employeeName}>
            <p className={styles.employeeId}>ID: {record.employee.id}</p>
            <h3>{name}</h3>
            {record.employee.nameEn !== "-" && <p className={styles.thaiName}>{record.employee.name}</p>}
            <EmployeeAge birthDate={record.employee.birthDate} today={today} />
          </div>
        </div>
        <div className={styles.employeeWork}>
          <p><BriefcaseBusiness size={15} /><span title={record.employee.title}>{record.employee.title}</span></p>
          <p><Building2 size={15} /><span title={record.employee.department}>{record.employee.department}</span></p>
        </div>
        <ChevronRight size={18} className={styles.cardArrow} />
        <div className={styles.employeeFooter}>
          <div className={styles.station}><MapPin size={13} /><span>{record.employee.station}</span></div>
          <span className={styles.employeeStatus}
            data-tone={record.urgency === "overdue" ? "danger" : record.urgency === "due30" ? "warning" : record.urgency === "due60" ? "info" : record.urgency === "later" ? "active" : undefined}
            title={`เริ่ม ${formatDate(record.startDate)} · ครบกำหนด ${formatDate(record.endDate)}${record.inferredEndDate ? " (คำนวณ)" : ""}`}>
            <Clock3 size={13} /><span>{urgencyLabel(record)}</span>
          </span>
          <div className={probationStyles.followUpActions}>
            <label className={probationStyles.selectionLabel}>
              <input type="checkbox" checked={selected} onChange={() => onToggle(record.employee.id)} aria-label={`เลือก ${name} สำหรับติดตาม`} />
              เลือกติดตาม
            </label>
            <span className={probationStyles.followUpCount}>ติดตามแล้ว {completedCount}/3</span>
            <button type="button" onClick={() => onFollowUp(record)} className={probationStyles.followUpButton}
              title="บันทึกการติดตาม" aria-label={`บันทึกการติดตาม ${name}`}>
              <CalendarCheck2 size={15} /><span>บันทึกการติดตาม</span>
            </button>
          </div>
        </div>
      </article>
    </li>
  );
});

export default function ProbationPage() {
  const today = useEmployeeToday();
  const [rawEmployees, setRawEmployees] = useState<RawEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [fetchedAt, setFetchedAt] = useState("");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [department, setDepartment] = useState("");
  const [division, setDivision] = useState("");
  const [section, setSection] = useState("");
  const [unit, setUnit] = useState("");
  const [station, setStation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [listFilter, setListFilter] = useState<ListFilter>("all");
  const [visibleCount, setVisibleCount] = useState(30);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeData | null>(null);
  const [followUpRecord, setFollowUpRecord] = useState<ProbationRecord | null>(null);
  const [selectedFollowUpIds, setSelectedFollowUpIds] = useState<Set<string>>(() => new Set());
  const [isBulkFollowUpOpen, setIsBulkFollowUpOpen] = useState(false);
  const resultsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (resultsRef.current?.scrollTop) resultsRef.current.scrollTo({ top: 0, behavior: "instant" });
  }, [deferredSearch, department, division, section, unit, station, startDate, endDate, listFilter]);

  const fetchProbation = useCallback(async (forceRefresh = false) => {
    try {
      const response = await fetch(`/api/probation${forceRefresh ? "?refresh=1" : ""}`, {
        cache: "no-store",
      });
      const payload = await response.json() as ProbationResponse;
      if (!response.ok) throw new Error(payload.error || "ไม่สามารถโหลดข้อมูลทดลองงานได้");
      setRawEmployees(Array.isArray(payload.items) ? payload.items : []);
      setFetchedAt(payload.fetchedAt || new Date().toISOString());
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "ไม่สามารถโหลดข้อมูลทดลองงานได้");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void fetchProbation(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchProbation]);

  const records = useMemo(() => rawEmployees.map(buildProbationRecord), [rawEmployees]);
  const departments = useMemo(() => Array.from(new Set(records.map((record) => record.employee.department).filter((value) => value !== "-"))).sort(), [records]);
  const divisions = useMemo(() => Array.from(new Set(records
    .filter((record) => !department || record.employee.department === department)
    .map((record) => record.employee.division)
    .filter((value) => value !== "-"))).sort(), [department, records]);
  const sections = useMemo(() => Array.from(new Set(records
    .filter((record) => (!department || record.employee.department === department)
      && (!division || record.employee.division === division))
    .map((record) => record.employee.section)
    .filter((value) => value !== "-"))).sort(), [department, division, records]);
  const units = useMemo(() => Array.from(new Set(records
    .filter((record) => (!department || record.employee.department === department)
      && (!division || record.employee.division === division)
      && (!section || record.employee.section === section))
    .map((record) => record.employee.unit)
    .filter((value) => value !== "-"))).sort(), [department, division, records, section]);
  const stations = useMemo(() => Array.from(new Set(records.map((record) => record.employee.station).filter((value) => value !== "-"))).sort(), [records]);

  const dateRangeText = useMemo(() => {
    if (!startDate && !endDate) return "ค้นหาวันเริ่มงาน...";
    const formatLocal = (dateValue: string) => {
      const parsed = parseDateOnly(dateValue);
      return parsed
        ? parsed.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })
        : dateValue;
    };
    if (startDate && endDate) return `${formatLocal(startDate)} - ${formatLocal(endDate)}`;
    if (startDate) return `ตั้งแต่ ${formatLocal(startDate)}`;
    return `จนถึง ${formatLocal(endDate)}`;
  }, [endDate, startDate]);

  const hasActiveFilters = Boolean(
    search || department || division || section || unit || station || startDate || endDate || listFilter !== "all",
  );
  const activeFilterCount = [department, division, section, unit, station, startDate || endDate,
    listFilter !== "all" ? listFilter : ""].filter(Boolean).length;

  const evaluationPeriod = EVALUATION_PERIOD_OPTIONS.find((option) => option.value === listFilter)?.label ?? "";
  const followUpStatus = FOLLOW_UP_FILTER_OPTIONS.find((option) => option.value === listFilter)?.label ?? "";

  const orderedRecords = useMemo(() => {
    const urgencyRank: Record<ProbationRecord["urgency"], number> = {
      overdue: 0,
      due30: 1,
      due60: 2,
      later: 3,
      missing: 4,
    };

    return [...records].sort((left, right) => {
      const rankDifference = urgencyRank[left.urgency] - urgencyRank[right.urgency];
      if (rankDifference !== 0) return rankDifference;
      if (left.daysRemaining === null && right.daysRemaining === null) return 0;
      if (left.daysRemaining === null) return 1;
      if (right.daysRemaining === null) return -1;
      return left.daysRemaining - right.daysRemaining;
    });
  }, [records]);

  const filteredRecords = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();
    const filterStartDate = startDate ? parseDateOnly(startDate) : null;
    const filterEndDate = endDate ? parseDateOnly(endDate) : null;
    return orderedRecords
      .filter((record) => {
        const matchesStartDate = !filterStartDate
          || Boolean(record.startDate && record.startDate >= filterStartDate);
        const matchesEndDate = !filterEndDate
          || Boolean(record.startDate && record.startDate <= filterEndDate);
        return (!normalizedSearch || record.searchText.includes(normalizedSearch))
          && (!department || record.employee.department === department)
          && (!division || record.employee.division === division)
          && (!section || record.employee.section === section)
          && (!unit || record.employee.unit === unit)
          && (!station || record.employee.station === station)
          && matchesStartDate
          && matchesEndDate
          && (listFilter === "all"
            || (listFilter.startsWith("followUp")
              ? hasCompletedFollowUp(record, listFilter as FollowUpFilter)
              : record.urgency === listFilter));
      });
  }, [department, division, endDate, listFilter, orderedRecords, deferredSearch, section, startDate, station, unit]);

  const displayedRecords = useMemo(
    () => filteredRecords.slice(0, visibleCount),
    [filteredRecords, visibleCount],
  );
  const selectedFollowUpRecords = useMemo(
    () => records.filter((record) => selectedFollowUpIds.has(record.employee.id)),
    [records, selectedFollowUpIds],
  );
  const allDisplayedSelected = displayedRecords.length > 0
    && displayedRecords.every((record) => selectedFollowUpIds.has(record.employee.id));

  const counts = useMemo(() => ({
    total: records.length,
    overdue: records.filter((record) => record.urgency === "overdue").length,
    due30: records.filter((record) => record.urgency === "due30").length,
    due60: records.filter((record) => record.urgency === "due60").length,
    missing: records.filter((record) => record.urgency === "missing").length,
  }), [records]);

  const handleEmployeeUpdate = (updatedEmployee: EmployeeData) => {
    setSelectedEmployee(updatedEmployee);
    setIsRefreshing(true);
    void fetchProbation(true);
  };

  const handleFollowUpSaved = (employeeId: string, slot: FollowUpSlot, entry: FollowUpEntry) => {
    const prefix = `probation_follow_up_${slot}`;
    setRawEmployees((current) => current.map((item) => {
      const itemId = valueOf(item, ["emp_code", "staff_id", "employeeId", "id"], "");
      return itemId === employeeId
        ? {
            ...item,
            [`${prefix}_date`]: entry.date,
            [`${prefix}_evaluator_id`]: entry.evaluatorId,
            [`${prefix}_evaluator_name`]: entry.evaluatorName,
            [`${prefix}_evaluator_name_en`]: entry.evaluatorNameEn,
            [`${prefix}_evaluator_position`]: entry.evaluatorPosition,
            [`${prefix}_comment`]: entry.comment,
            [`${prefix}_attachment_name`]: entry.attachmentName,
            [`${prefix}_attachment_data`]: entry.attachmentData,
          }
        : item;
    }));
    setFetchedAt(new Date().toISOString());
  };

  const toggleFollowUpSelection = useCallback((employeeId: string) => {
    setSelectedFollowUpIds((current) => {
      const next = new Set(current);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
  }, []);

  const toggleDisplayedSelection = () => {
    setSelectedFollowUpIds((current) => {
      const next = new Set(current);
      displayedRecords.forEach((record) => {
        if (allDisplayedSelected) next.delete(record.employee.id);
        else next.add(record.employee.id);
      });
      return next;
    });
  };

  const handleRefresh = () => {
    setError("");
    setIsRefreshing(true);
    void fetchProbation(true);
  };

  const handleRetry = () => {
    setError("");
    setIsLoading(true);
    void fetchProbation(true);
  };

  return (
    <main className={styles.workspace}>
      <aside className={styles.sidebar} aria-label="ค้นหาและกรองพนักงานทดลองงาน">
        <header className={styles.sidebarHeading}>
          <div className={styles.eyebrow}>
            <CalendarClock className="size-4" />
            PEOPLE DIRECTORY
          </div>
          <h1>Probation</h1>
          <p>ติดตามช่วงทดลองงาน</p>
        </header>
        <div className={cn(styles.statusTabs, probationStyles.statusTabs)} role="group" aria-label="สถานะทดลองงาน">
          {QUICK_FILTER_OPTIONS.map((option) => (
            <button key={option.value} type="button" aria-pressed={listFilter === option.value}
              onClick={() => { setListFilter(option.value); setVisibleCount(30); }}>
              {option.label}
            </button>
          ))}
        </div>
        <div className={styles.searchField}>
          <Search size={16} />
          <input
            aria-label="ค้นหาพนักงานทดลองงาน"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setVisibleCount(30);
            }}
            placeholder="Search by name, ID, or component..."
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setVisibleCount(30);
              }}
              aria-label="Clear search"
              title="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <button type="button" className={styles.filterToggle} aria-expanded={filtersExpanded}
          aria-controls="probation-advanced-filters" onClick={() => setFiltersExpanded((expanded) => !expanded)}>
          <SlidersHorizontal size={16} /> ตัวกรอง
          {activeFilterCount > 0 && <span className={styles.filterCount}>{activeFilterCount}</span>}
          <ChevronDown size={16} />
        </button>
        <div id="probation-advanced-filters" className={styles.advancedFilters} data-expanded={filtersExpanded}>
        <div className={styles.filterFields}>
          <div className={styles.filterField}>
          <span className="sr-only">Department</span>
          <CustomSelect
            value={department}
            onChange={(value) => {
              setDepartment(value);
              setDivision("");
              setSection("");
              setUnit("");
              setVisibleCount(30);
            }}
            options={departments}
            placeholder="Department"
            portal
            triggerClassName={styles.selectTrigger}
          />
          </div>
          <div className={styles.filterField}>
          <span className="sr-only">Division</span>
          <CustomSelect
            value={division}
            onChange={(value) => {
              setDivision(value);
              setSection("");
              setUnit("");
              setVisibleCount(30);
            }}
            options={divisions}
            placeholder="Division"
            portal
            triggerClassName={styles.selectTrigger}
          />
          </div>
          <div className={styles.filterField}>
          <span className="sr-only">Section</span>
          <CustomSelect
            value={section}
            onChange={(value) => {
              setSection(value);
              setUnit("");
              setVisibleCount(30);
            }}
            options={sections}
            placeholder="Section"
            portal
            triggerClassName={styles.selectTrigger}
          />
          </div>
          <div className={styles.filterField}>
          <span className="sr-only">Unit</span>
          <CustomSelect
            value={unit}
            onChange={(value) => {
              setUnit(value);
              setVisibleCount(30);
            }}
            options={units}
            placeholder="Unit"
            portal
            triggerClassName={styles.selectTrigger}
          />
          </div>
          <div className={styles.filterField}>
          <span className="sr-only">Station</span>
          <CustomSelect
            value={station}
            onChange={(value) => {
              setStation(value);
              setVisibleCount(30);
            }}
            options={stations}
            placeholder="Station"
            portal
            triggerClassName={styles.selectTrigger}
          />
          </div>
          <div className={styles.filterField}>
            <button
              type="button"
              onClick={() => setIsDatePickerOpen((open) => !open)}
              className={styles.dateTrigger}
              aria-expanded={isDatePickerOpen}
              aria-controls="probation-date-range"
            >
              <span className="truncate pr-2">{dateRangeText}</span>
              <CalendarClock className="size-4 shrink-0 text-slate-400" />
            </button>
            {isDatePickerOpen && (
                <div id="probation-date-range" className={styles.dateRange}
                  onKeyDown={(event) => { if (event.key === "Escape") setIsDatePickerOpen(false); }}>
                  <div className="space-y-1">
                    <label htmlFor="probation-start-date">จากวันที่ (Start Date)</label>
                    <input
                      id="probation-start-date"
                      type="date"
                      value={startDate}
                      onChange={(event) => {
                        setStartDate(event.target.value);
                        setVisibleCount(30);
                      }}
                      max={endDate || undefined}
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="probation-end-date">ถึงวันที่ (End Date)</label>
                    <input
                      id="probation-end-date"
                      type="date"
                      value={endDate}
                      onChange={(event) => {
                        setEndDate(event.target.value);
                        setVisibleCount(30);
                      }}
                      min={startDate || undefined}
                    />
                  </div>
                  <div className={styles.dateActions}>
                    <button
                      type="button"
                      onClick={() => {
                        setStartDate("");
                        setEndDate("");
                        setIsDatePickerOpen(false);
                        setVisibleCount(30);
                      }}
                    >
                      ล้างค่า
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsDatePickerOpen(false)}
                    >
                      ตกลง
                    </button>
                  </div>
                </div>
            )}
          </div>

          <div className={styles.filterField}>
          <span className="sr-only">ช่วงการประเมิน</span>
          <CustomSelect
            value={evaluationPeriod}
            onChange={(value) => {
              const selectedPeriod = EVALUATION_PERIOD_OPTIONS.find((option) => option.label === value);
              setListFilter(selectedPeriod?.value ?? "all");
              setVisibleCount(30);
            }}
            options={EVALUATION_PERIOD_OPTIONS.map((option) => option.label)}
            placeholder="ช่วงการประเมิน"
            portal
            triggerClassName={styles.selectTrigger}
          />
          </div>
          <div className={styles.filterField}>
          <span className="sr-only">สถานะการติดตาม</span>
          <CustomSelect
            value={followUpStatus}
            onChange={(value) => {
              const selectedFollowUp = FOLLOW_UP_FILTER_OPTIONS.find((option) => option.label === value);
              setListFilter(selectedFollowUp?.value ?? "all");
              setVisibleCount(30);
            }}
            options={FOLLOW_UP_FILTER_OPTIONS.map((option) => option.label)}
            placeholder="สถานะการติดตาม"
            portal
            triggerClassName={styles.selectTrigger}
          />
          </div>
        </div>
        </div>
          <div className={styles.filterActions}>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={styles.refreshButton}
            >
              <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
              {isRefreshing ? "กำลังอัปเดต" : "Refresh"}
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setDepartment("");
                  setDivision("");
                  setSection("");
                  setUnit("");
                  setStation("");
                  setSearch("");
                  setStartDate("");
                  setEndDate("");
                  setListFilter("all");
                  setIsDatePickerOpen(false);
                  setVisibleCount(30);
                }}
                className={styles.clearButton}
              >
                <X className="size-4" />
                Clear
              </button>
            )}
          </div>
      </aside>

      <section ref={resultsRef} tabIndex={0} className={styles.results} aria-label="รายชื่อพนักงานทดลองงาน"
        aria-busy={isLoading || isRefreshing || search !== deferredSearch} inert={search !== deferredSearch}>
        <header className={styles.resultsHeading}>
          <div>
            <span className={styles.eyebrow}><Users size={14} /> PROBATION MANAGEMENT</span>
            <h2>รายการที่ต้องติดตาม</h2>
            {fetchedAt && <p className={probationStyles.updatedAt}>
              อัปเดตล่าสุด {updatedAtFormatter.format(new Date(fetchedAt))}
            </p>}
          </div>
          {!isLoading && !error && <span className={styles.resultCount} role="status">{filteredRecords.length.toLocaleString()} คน</span>}
        </header>
        {!isLoading && !error && (
          <section className={probationStyles.metrics} aria-label="ภาพรวมทดลองงาน">
            <KpiCard label="ทดลองงานทั้งหมด" value={counts.total} helper="Active & Probation" icon={Users} tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" />
            <KpiCard label="เลยกำหนด" value={counts.overdue} helper="ต้องติดตามทันที" icon={AlertTriangle} tone="bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" />
            <KpiCard label="30 วัน" value={counts.due30} helper="ใกล้ครบกำหนด" icon={Clock3} tone="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" />
            <KpiCard label="60 วัน" value={counts.due60} helper="เตรียมการประเมิน" icon={CalendarClock} tone="bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" />
            <KpiCard label="ข้อมูลไม่ครบ" value={counts.missing} helper="ไม่มีวันที่ใช้อ้างอิง" icon={CircleAlert} tone="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" />
          </section>
        )}

      {isLoading && (
        <div className={styles.loadingState} role="status">
          <p>กำลังดึงข้อมูลพนักงานทดลองงาน...</p>
          {Array.from({ length: 5 }, (_, index) => <div key={index} className={styles.skeletonCard} aria-hidden="true">
            <span /><div><i /><i /><i /></div>
          </div>)}
        </div>
      )}

      {!isLoading && error && (
        <div role="alert" className="my-8 flex min-h-72 flex-col items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-5 text-center dark:border-rose-900/60 dark:bg-rose-950/20">
          <Database className="mb-3 size-8 text-rose-500" />
          <h2 className="font-semibold text-rose-800 dark:text-rose-200">เชื่อมต่อข้อมูลไม่สำเร็จ</h2>
          <p className="mt-1 max-w-lg text-sm text-rose-700 dark:text-rose-300">{error}</p>
          <button type="button" onClick={handleRetry} className="mt-4 h-10 rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700">
            ลองอีกครั้ง
          </button>
        </div>
      )}

      {!isLoading && !error && (
        <div>
            {(displayedRecords.length > 0 || selectedFollowUpRecords.length > 0) && (
              <div className={probationStyles.selectionToolbar} aria-label="ติดตามหลายคน">
                {displayedRecords.length > 0 && <label className={probationStyles.selectionLabel}>
                  <input type="checkbox" checked={allDisplayedSelected} onChange={toggleDisplayedSelection}
                    ref={(input) => { if (input) input.indeterminate = !allDisplayedSelected && displayedRecords.some((record) => selectedFollowUpIds.has(record.employee.id)); }} />
                  เลือกที่แสดง ({displayedRecords.length})
                </label>}
                {selectedFollowUpRecords.length > 0 && (
                  <>
                    <span className={probationStyles.selectedCount} role="status">
                      เลือก {selectedFollowUpRecords.length.toLocaleString()} คน
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsBulkFollowUpOpen(true)}
                      className={probationStyles.bulkButton}
                    >
                      <CalendarCheck2 className="size-4" />
                      ติดตามที่เลือก
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedFollowUpIds(new Set())}
                      title="ล้างรายการที่เลือก"
                      aria-label="ล้างรายการที่เลือก"
                      className={probationStyles.clearSelection}
                    >
                      <X className="size-4" />
                    </button>
                  </>
                )}
              </div>
            )}

          {filteredRecords.length === 0 ? (
            <div className={styles.emptyState} role="status">
              <Users className="mb-2 size-7 text-slate-400" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">ไม่พบพนักงานตามเงื่อนไขที่เลือก</p>
            </div>
          ) : (
            <ul className={styles.employeeStack} aria-label="ผลการค้นหาพนักงานทดลองงาน">
              {displayedRecords.map((record) => (
                <ProbationCard key={record.employee.id} record={record} selected={selectedFollowUpIds.has(record.employee.id)}
                  onOpen={setSelectedEmployee} onFollowUp={setFollowUpRecord} onToggle={toggleFollowUpSelection} today={today} />
              ))}
            </ul>
          )}

          {visibleCount < filteredRecords.length && (
            <div className={styles.pagination}>
              <button
                type="button"
                onClick={() => setVisibleCount((count) => count + 30)}
              >
                แสดงเพิ่มอีก {Math.min(30, filteredRecords.length - visibleCount)} คน
              </button>
            </div>
          )}
        </div>
      )}
      </section>

      <EmployeeProfileDrawer
        isOpen={Boolean(selectedEmployee)}
        employee={selectedEmployee}
        blurBackground
        onClose={() => setSelectedEmployee(null)}
        onUpdate={handleEmployeeUpdate}
      />

      {followUpRecord && (
        <FollowUpDialog
          key={followUpRecord.employee.id}
          record={followUpRecord}
          onClose={() => setFollowUpRecord(null)}
          onSaved={handleFollowUpSaved}
        />
      )}

      {isBulkFollowUpOpen && selectedFollowUpRecords.length > 0 && (
        <BulkFollowUpDialog
          records={selectedFollowUpRecords}
          onClose={() => setIsBulkFollowUpOpen(false)}
          onSaved={handleFollowUpSaved}
          onComplete={() => setSelectedFollowUpIds(new Set())}
        />
      )}
    </main>
  );
}
