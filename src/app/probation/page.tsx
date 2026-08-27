"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  ChevronRight,
  CircleAlert,
  Clock3,
  Database,
  MapPin,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EmployeeProfileDrawer,
  type EmployeeData,
} from "@/app/employees/components/EmployeeProfileDrawer";

type RawEmployee = Record<string, unknown>;
type Urgency = "all" | "overdue" | "due30" | "due60" | "later" | "missing";

type ProbationRecord = {
  raw: RawEmployee;
  employee: EmployeeData;
  endDate: Date | null;
  startDate: Date | null;
  daysRemaining: number | null;
  probationDays: number;
  inferredEndDate: boolean;
  urgency: Exclude<Urgency, "all">;
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

const URGENCY_OPTIONS: Array<{ value: Urgency; label: string }> = [
  { value: "all", label: "ทั้งหมด" },
  { value: "overdue", label: "เลยกำหนด" },
  { value: "due30", label: "ภายใน 30 วัน" },
  { value: "due60", label: "31-60 วัน" },
  { value: "later", label: "มากกว่า 60 วัน" },
  { value: "missing", label: "ข้อมูลไม่ครบ" },
];

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

function formatDate(date: Date | null) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
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

  return { raw: item, employee, endDate, startDate, daysRemaining, probationDays, inferredEndDate, urgency };
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
    <div className="flex min-h-24 items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-[#121212]">
      <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", tone)}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-2xl font-bold text-slate-950 dark:text-white">{value.toLocaleString()}</p>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{helper}</p>
      </div>
    </div>
  );
}

export default function ProbationPage() {
  const [rawEmployees, setRawEmployees] = useState<RawEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [fetchedAt, setFetchedAt] = useState("");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [station, setStation] = useState("all");
  const [urgency, setUrgency] = useState<Urgency>("all");
  const [visibleCount, setVisibleCount] = useState(30);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeData | null>(null);

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
  const stations = useMemo(() => Array.from(new Set(records.map((record) => record.employee.station).filter((value) => value !== "-"))).sort(), [records]);

  const filteredRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const urgencyRank: Record<ProbationRecord["urgency"], number> = {
      overdue: 0,
      due30: 1,
      due60: 2,
      later: 3,
      missing: 4,
    };

    return records
      .filter((record) => {
        const searchable = [
          record.employee.id,
          record.employee.name,
          record.employee.nameEn,
          record.employee.title,
          record.employee.department,
          record.employee.station,
        ].join(" ").toLowerCase();
        return (!normalizedSearch || searchable.includes(normalizedSearch))
          && (department === "all" || record.employee.department === department)
          && (station === "all" || record.employee.station === station)
          && (urgency === "all" || record.urgency === urgency);
      })
      .sort((left, right) => {
        const rankDifference = urgencyRank[left.urgency] - urgencyRank[right.urgency];
        if (rankDifference !== 0) return rankDifference;
        if (left.daysRemaining === null) return 1;
        if (right.daysRemaining === null) return -1;
        return left.daysRemaining - right.daysRemaining;
      });
  }, [department, records, search, station, urgency]);

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
    <main className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
      <section className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-white/10 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-sky-600 dark:text-sky-400">
            <CalendarClock className="size-4" />
            Probation Management
          </div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white sm:text-3xl">ติดตามช่วงทดลองงาน</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            ข้อมูลพนักงานทดลองงานปัจจุบันจากระบบ เรียงตามวันที่ต้องดำเนินการก่อน
          </p>
          {fetchedAt && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
              อัปเดตล่าสุด {new Date(fetchedAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
        >
          <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
          {isRefreshing ? "กำลังอัปเดต" : "Refresh"}
        </button>
      </section>

      {!isLoading && !error && (
        <section className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard label="พนักงานทดลองงาน" value={counts.total} helper="Active & Probation" icon={Users} tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" />
          <KpiCard label="เลยกำหนด" value={counts.overdue} helper="ต้องติดตามทันที" icon={AlertTriangle} tone="bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" />
          <KpiCard label="ภายใน 30 วัน" value={counts.due30} helper="ใกล้ครบกำหนด" icon={Clock3} tone="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" />
          <KpiCard label="31-60 วัน" value={counts.due60} helper="เตรียมการประเมิน" icon={CalendarClock} tone="bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" />
          <KpiCard label="ข้อมูลไม่ครบ" value={counts.missing} helper="ไม่มีวันที่ใช้อ้างอิง" icon={CircleAlert} tone="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" />
        </section>
      )}

      <section className="mt-5 border-y border-slate-200 py-4 dark:border-white/10">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(280px,1.4fr)_1fr_1fr]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setVisibleCount(30);
              }}
              placeholder="ค้นหาชื่อ รหัส ตำแหน่ง..."
              className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-sky-500 dark:border-white/10 dark:bg-[#121212] dark:text-white"
            />
          </label>
          <select
            value={department}
            onChange={(event) => {
              setDepartment(event.target.value);
              setVisibleCount(30);
            }}
            className="h-11 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-sky-500 dark:border-white/10 dark:bg-[#121212] dark:text-slate-100"
          >
            <option value="all">ทุกฝ่าย / All Departments</option>
            {departments.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select
            value={station}
            onChange={(event) => {
              setStation(event.target.value);
              setVisibleCount(30);
            }}
            className="h-11 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-sky-500 dark:border-white/10 dark:bg-[#121212] dark:text-slate-100"
          >
            <option value="all">ทุกสถานี / All Stations</option>
            {stations.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {URGENCY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setUrgency(option.value);
                setVisibleCount(30);
              }}
              className={cn(
                "h-9 shrink-0 rounded-lg border px-3 text-xs font-semibold transition-colors",
                urgency === option.value
                  ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-400 dark:border-white/10 dark:bg-[#121212] dark:text-slate-300 dark:hover:border-white/30",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      {isLoading && (
        <div className="flex min-h-80 flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
          <RefreshCw className="size-7 animate-spin text-sky-500" />
          <p className="text-sm font-medium">กำลังดึงข้อมูลพนักงานทดลองงาน...</p>
        </div>
      )}

      {!isLoading && error && (
        <div className="my-8 flex min-h-72 flex-col items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-5 text-center dark:border-rose-900/60 dark:bg-rose-950/20">
          <Database className="mb-3 size-8 text-rose-500" />
          <h2 className="font-semibold text-rose-800 dark:text-rose-200">เชื่อมต่อข้อมูลไม่สำเร็จ</h2>
          <p className="mt-1 max-w-lg text-sm text-rose-700 dark:text-rose-300">{error}</p>
          <button type="button" onClick={handleRetry} className="mt-4 h-10 rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700">
            ลองอีกครั้ง
          </button>
        </div>
      )}

      {!isLoading && !error && (
        <section className="mt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-950 dark:text-white">รายการที่ต้องติดตาม</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">พบ {filteredRecords.length.toLocaleString()} คน</p>
            </div>
          </div>

          {filteredRecords.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center border-y border-slate-200 text-center dark:border-white/10">
              <Users className="mb-2 size-7 text-slate-400" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">ไม่พบพนักงานตามเงื่อนไขที่เลือก</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
              {filteredRecords.slice(0, visibleCount).map((record) => {
                const elapsedDays = record.daysRemaining === null
                  ? 0
                  : Math.max(0, record.probationDays - Math.max(record.daysRemaining, 0));
                const progress = record.startDate
                  ? Math.min(100, Math.max(0, (elapsedDays / record.probationDays) * 100))
                  : 0;

                return (
                  <button
                    key={record.employee.id}
                    type="button"
                    onClick={() => setSelectedEmployee(record.employee)}
                    className="group grid min-h-32 w-full grid-cols-[auto_minmax(0,1fr)_auto] gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-sky-300 hover:bg-sky-50/40 dark:border-white/10 dark:bg-[#121212] dark:hover:border-sky-800 dark:hover:bg-sky-950/20"
                  >
                    <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white", record.employee.colorClass)}>
                      {record.employee.initials}
                    </span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-xs font-bold text-sky-600 dark:text-sky-400">ID: {record.employee.id}</span>
                        <span className={cn("rounded-md border px-2 py-0.5 text-[11px] font-semibold", urgencyStyle(record.urgency))}>
                          {urgencyLabel(record)}
                        </span>
                      </span>
                      <span className="mt-1 block truncate text-sm font-bold text-slate-950 dark:text-white sm:text-base">{record.employee.nameEn}</span>
                      <span className="block truncate text-xs text-slate-600 dark:text-slate-400">{record.employee.name}</span>
                      <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className="inline-flex min-w-0 items-center gap-1"><BriefcaseBusiness className="size-3.5 shrink-0" /><span className="truncate">{record.employee.title}</span></span>
                        <span className="inline-flex min-w-0 items-center gap-1"><Building2 className="size-3.5 shrink-0" /><span className="truncate">{record.employee.department}</span></span>
                        <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{record.employee.station}</span>
                      </span>
                      <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <span
                          className={cn("block h-full rounded-full", record.urgency === "overdue" ? "bg-rose-500" : record.urgency === "due30" ? "bg-amber-500" : "bg-sky-500")}
                          style={{ width: `${progress}%` }}
                        />
                      </span>
                      <span className="mt-1 flex flex-wrap justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-500">
                        <span>เริ่ม {formatDate(record.startDate)}</span>
                        <span>ครบกำหนด {formatDate(record.endDate)}{record.inferredEndDate ? " (คำนวณ)" : ""}</span>
                      </span>
                    </span>
                    <span className="flex h-full items-center text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-500">
                      <ChevronRight className="size-5" />
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {visibleCount < filteredRecords.length && (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={() => setVisibleCount((count) => count + 30)}
                className="h-10 rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 hover:border-slate-500 dark:border-white/15 dark:bg-[#121212] dark:text-slate-200"
              >
                แสดงเพิ่มอีก {Math.min(30, filteredRecords.length - visibleCount)} คน
              </button>
            </div>
          )}
        </section>
      )}

      <EmployeeProfileDrawer
        isOpen={Boolean(selectedEmployee)}
        employee={selectedEmployee}
        onClose={() => setSelectedEmployee(null)}
        onUpdate={handleEmployeeUpdate}
      />
    </main>
  );
}
