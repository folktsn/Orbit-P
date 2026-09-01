"use client";

import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  CircleDot,
  ClipboardCheck,
  Clock3,
  Copy,
  Download,
  EyeOff,
  Info,
  Network,
  PanelRightOpen,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  EmployeeProfileDrawer,
  type EmployeeData,
} from "@/app/employees/components/EmployeeProfileDrawer";
import { cn } from "@/lib/utils";
import {
  IssueWorkflowDialog,
  type WorkflowRecord,
  type WorkflowStatus,
} from "./components/IssueWorkflowDialog";

type Severity = "critical" | "warning" | "info";
type Category = "duplicate" | "missing" | "date" | "organization";

type QualityIssue = {
  id: string;
  severity: Severity;
  category: Category;
  title: string;
  description: string;
  fields: string[];
  employee: {
    id: string;
    nameTh: string;
    nameEn: string;
    status: string;
    position: string;
    department: string;
    division: string;
    section: string;
    station: string;
  };
  relatedEmployeeIds?: string[];
};

type QualityResult = {
  generatedAt: string;
  today: string;
  summary: {
    totalRecords: number;
    currentRecords: number;
    affectedEmployees: number;
    healthyEmployees: number;
    critical: number;
    warning: number;
    info: number;
    duplicate: number;
    missing: number;
    date: number;
    organization: number;
  };
  issues: QualityIssue[];
  metadata: {
    organizationRecords: number;
    rulesVersion: string;
  };
};

const SEVERITY = {
  critical: { label: "เร่งด่วน", className: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300", icon: CircleAlert },
  warning: { label: "ตรวจสอบ", className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300", icon: AlertTriangle },
  info: { label: "ข้อมูลแนะนำ", className: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300", icon: Info },
} satisfies Record<Severity, { label: string; className: string; icon: typeof CircleAlert }>;

const CATEGORY = {
  duplicate: { label: "ข้อมูลซ้ำ", icon: Copy },
  missing: { label: "ข้อมูลไม่ครบ", icon: CircleAlert },
  date: { label: "วันที่ผิดปกติ", icon: CalendarDays },
  organization: { label: "ผังองค์กร", icon: Network },
} satisfies Record<Category, { label: string; icon: typeof Copy }>;

const WORKFLOW_STATUS = {
  open: { label: "ยังไม่ดำเนินการ", className: "border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300", icon: CircleDot },
  in_progress: { label: "กำลังดำเนินการ", className: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300", icon: Clock3 },
  resolved: { label: "แก้ไขแล้ว", className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300", icon: CheckCircle2 },
  ignored: { label: "ยกเว้น", className: "border-slate-300 bg-slate-100 text-slate-600 dark:border-white/15 dark:bg-white/10 dark:text-slate-300", icon: EyeOff },
} satisfies Record<WorkflowStatus, { label: string; className: string; icon: typeof CircleDot }>;

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

function displayName(issue: QualityIssue) {
  return issue.employee.nameEn || issue.employee.nameTh || "ไม่พบชื่อพนักงาน";
}

function employeeProfileFromIssue(issue: QualityIssue): EmployeeData {
  const employee = issue.employee;
  const profileName = employee.nameEn || employee.nameTh || employee.id || "EMP";
  const nameParts = profileName
    .replace(/^(?:Mr\.?|Mrs\.?|Miss|Ms\.?|Dr\.?|นาย|นางสาว|นาง)\s*/i, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const initials = nameParts.length > 1
    ? `${nameParts[0][0]}${nameParts.at(-1)?.[0] ?? ""}`.toUpperCase()
    : (nameParts[0] || "EMP").slice(0, 2).toUpperCase();
  const colors = ["bg-emerald-500", "bg-blue-500", "bg-pink-500", "bg-amber-500", "bg-purple-500", "bg-rose-500", "bg-indigo-500"];
  let colorHash = 0;
  for (const character of employee.id) colorHash = character.charCodeAt(0) + ((colorHash << 5) - colorHash);

  return {
    id: employee.id,
    name: employee.nameTh || employee.nameEn || "-",
    nameEn: employee.nameEn || employee.nameTh || "-",
    initials,
    colorClass: colors[Math.abs(colorHash) % colors.length],
    title: employee.position || "-",
    department: employee.department || "-",
    station: employee.station || "-",
    division: employee.division || "-",
    section: employee.section || "-",
    unit: "-",
    supervisor: "-",
    status: employee.status || "Active",
    empType: "-",
    contractStart: "-",
    contractEnd: "-",
    probationEnd: "-",
    gender: "-",
    nationality: "-",
    idCard: "-",
    email: "-",
    phone: "-",
    address: "-",
    emergencyContact: "-",
    education: "-",
    workHistory: "-",
  };
}

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function IssueBadge({ issue }: { issue: QualityIssue }) {
  const config = SEVERITY[issue.severity];
  const Icon = config.icon;
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center gap-1 rounded-full border px-2 text-[10px] font-bold", config.className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

function WorkflowBadge({ status }: { status: WorkflowStatus }) {
  const config = WORKFLOW_STATUS[status];
  const Icon = config.icon;
  return (
    <span className={cn("inline-flex h-6 max-w-full items-center gap-1 rounded-full border px-2 text-[9px] font-bold", config.className)}>
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate">{config.label}</span>
    </span>
  );
}

export default function DataQualityPage() {
  const [data, setData] = useState<QualityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState<"all" | Severity>("all");
  const [category, setCategory] = useState<"all" | Category>("all");
  const [workflowStatus, setWorkflowStatus] = useState<"all" | WorkflowStatus>("all");
  const [workflows, setWorkflows] = useState<Record<string, WorkflowRecord>>({});
  const [workflowLoading, setWorkflowLoading] = useState(true);
  const [workflowError, setWorkflowError] = useState("");
  const [selectedIssue, setSelectedIssue] = useState<QualityIssue | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeData | null>(null);

  const loadData = useCallback(async (refresh = false) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/data-quality${refresh ? "?refresh=1" : ""}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "ไม่สามารถตรวจสอบข้อมูลได้");
      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "ไม่สามารถตรวจสอบข้อมูลได้");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWorkflow = useCallback(async () => {
    setWorkflowLoading(true);
    setWorkflowError("");
    try {
      const response = await fetch("/api/data-quality/actions", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "ไม่สามารถโหลดสถานะการดำเนินงานได้");
      setWorkflows(payload.items ?? {});
    } catch (loadError) {
      setWorkflowError(loadError instanceof Error ? loadError.message : "ไม่สามารถโหลดสถานะการดำเนินงานได้");
    } finally {
      setWorkflowLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void Promise.all([loadData(), loadWorkflow()]));
    return () => cancelAnimationFrame(frame);
  }, [loadData, loadWorkflow]);

  const filteredIssues = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("th");
    return (data?.issues ?? []).filter((issue) => {
      if (severity !== "all" && issue.severity !== severity) return false;
      if (category !== "all" && issue.category !== category) return false;
      const issueWorkflowStatus = workflows[issue.id]?.status ?? "open";
      if (workflowStatus !== "all" && issueWorkflowStatus !== workflowStatus) return false;
      if (!normalizedQuery) return true;
      return [
        issue.employee.id,
        issue.employee.nameTh,
        issue.employee.nameEn,
        issue.employee.position,
        issue.employee.department,
        issue.employee.station,
        issue.title,
        issue.description,
        ...issue.fields,
      ].join(" ").toLocaleLowerCase("th").includes(normalizedQuery);
    });
  }, [category, data?.issues, query, severity, workflowStatus, workflows]);

  const workflowCounts = useMemo(() => {
    const counts: Record<WorkflowStatus, number> = { open: 0, in_progress: 0, resolved: 0, ignored: 0 };
    (data?.issues ?? []).forEach((issue) => {
      counts[workflows[issue.id]?.status ?? "open"] += 1;
    });
    return counts;
  }, [data?.issues, workflows]);

  const healthyPercent = data?.summary.currentRecords
    ? Math.round((data.summary.healthyEmployees / data.summary.currentRecords) * 100)
    : 0;

  const exportCsv = () => {
    const header = ["Severity", "Category", "Workflow", "Assignee", "Due Date", "Employee ID", "Name TH", "Name EN", "Issue", "Description", "Fields", "Department", "Position", "Station"];
    const rows = filteredIssues.map((issue) => [
      SEVERITY[issue.severity].label,
      CATEGORY[issue.category].label,
      WORKFLOW_STATUS[workflows[issue.id]?.status ?? "open"].label,
      workflows[issue.id]?.assignee?.name ?? "",
      workflows[issue.id]?.dueDate ?? "",
      issue.employee.id,
      issue.employee.nameTh,
      issue.employee.nameEn,
      issue.title,
      issue.description,
      issue.fields.join(", "),
      issue.employee.department,
      issue.employee.position,
      issue.employee.station,
    ]);
    const csv = `\uFEFF${[header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `employee-data-quality-${data?.today ?? "report"}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <section className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-white/10 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center gap-2 text-xs font-bold text-sky-600 dark:text-sky-400">
            <ShieldCheck className="h-4 w-4" />
            Data Quality
          </div>
          <h1 className="text-2xl font-extrabold text-slate-950 dark:text-white">ศูนย์ตรวจสอบข้อมูลพนักงาน</h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {data ? `ตรวจล่าสุด ${formatTimestamp(data.generatedAt)}` : "กำลังตรวจสอบข้อมูลปัจจุบัน"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportCsv}
            disabled={!filteredIssues.length}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-[#121212] dark:text-slate-200 dark:hover:bg-white/5"
          >
            <Download className="h-4 w-4" />
            CSV
          </button>
          <button
            type="button"
            onClick={() => void Promise.all([loadData(true), loadWorkflow()])}
            disabled={loading || workflowLoading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 text-xs font-bold text-sky-700 transition hover:bg-sky-100 disabled:opacity-60 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300"
          >
            <RefreshCw className={cn("h-4 w-4", (loading || workflowLoading) && "animate-spin")} />
            Refresh
          </button>
        </div>
      </section>

      {error ? (
        <div className="flex min-h-44 flex-col items-center justify-center rounded-lg border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-500/20 dark:bg-rose-500/10">
          <CircleAlert className="mb-3 h-7 w-7 text-rose-500" />
          <p className="font-bold text-rose-700 dark:text-rose-300">{error}</p>
          <button type="button" onClick={() => void loadData(true)} className="mt-4 text-xs font-bold text-rose-600 underline">ลองใหม่</button>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
            <MetricCard label="พนักงานปัจจุบัน" value={data?.summary.currentRecords} detail={`ทั้งหมด ${data?.summary.totalRecords ?? 0} รายการ`} icon={Users} tone="sky" loading={loading} />
            <MetricCard label="พนักงานที่ต้องตรวจ" value={data?.summary.affectedEmployees} detail={`${healthyPercent}% ผ่านกฎทั้งหมด`} icon={AlertTriangle} tone="amber" loading={loading} />
            <MetricCard label="เร่งด่วน" value={data?.summary.critical} detail="ควรตรวจสอบก่อน" icon={CircleAlert} tone="rose" loading={loading} />
            <MetricCard label="รายการตรวจสอบ" value={data?.summary.warning} detail="อาจกระทบรายงาน" icon={AlertTriangle} tone="amber" loading={loading} />
            <MetricCard label="ข้อมูลสมบูรณ์" value={data?.summary.healthyEmployees} detail="ไม่พบข้อสังเกต" icon={CheckCircle2} tone="emerald" loading={loading} className="col-span-2 lg:col-span-1" />
          </section>

          <section className="space-y-3 border-y border-slate-200 py-4 dark:border-white/10">
            <div className="grid min-w-0 grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_170px_170px_190px]">
              <label className="relative block min-w-0">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by name, ID, issue, or department..."
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-10 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100 dark:border-white/10 dark:bg-[#121212] dark:text-slate-200 dark:focus:border-sky-500/40 dark:focus:ring-sky-500/10"
                />
                {query && (
                  <button type="button" onClick={() => setQuery("")} title="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </label>
              <SelectFilter value={severity} onChange={(value) => setSeverity(value as "all" | Severity)} label="ทุกระดับ" options={Object.entries(SEVERITY).map(([value, item]) => ({ value, label: item.label }))} />
              <SelectFilter value={category} onChange={(value) => setCategory(value as "all" | Category)} label="ทุกประเภท" options={Object.entries(CATEGORY).map(([value, item]) => ({ value, label: item.label }))} />
              <SelectFilter value={workflowStatus} onChange={(value) => setWorkflowStatus(value as "all" | WorkflowStatus)} label="ทุกสถานะดำเนินงาน" options={Object.entries(WORKFLOW_STATUS).map(([value, item]) => ({ value, label: item.label }))} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>พบ {filteredIssues.length.toLocaleString("th-TH")} รายการ</span>
              <span>กำลังดำเนินการ {workflowCounts.in_progress.toLocaleString("th-TH")} · แก้แล้ว {workflowCounts.resolved.toLocaleString("th-TH")}</span>
            </div>
            {workflowError && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{workflowError}</p>}
          </section>

          <section>
            {loading && !data ? (
              <div className="grid gap-2.5">
                {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-[#121212]" />)}
              </div>
            ) : filteredIssues.length ? (
              <>
                <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-[#121212] lg:block">
                  <div className="grid grid-cols-[105px_205px_145px_minmax(210px,1fr)_180px_150px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[10px] font-extrabold uppercase text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
                    <span>ระดับ</span><span>พนักงาน</span><span>ประเภท</span><span>ข้อสังเกต</span><span>ข้อมูลอ้างอิง</span><span>ดำเนินการ</span>
                  </div>
                  {filteredIssues.map((issue) => <IssueRow key={issue.id} issue={issue} workflow={workflows[issue.id]} onManage={() => setSelectedIssue(issue)} onOpenEmployee={() => setSelectedEmployee(employeeProfileFromIssue(issue))} />)}
                </div>
                <div className="grid gap-2.5 lg:hidden">
                  {filteredIssues.map((issue) => <IssueCard key={issue.id} issue={issue} workflow={workflows[issue.id]} onManage={() => setSelectedIssue(issue)} onOpenEmployee={() => setSelectedEmployee(employeeProfileFromIssue(issue))} />)}
                </div>
              </>
            ) : (
              <div className="flex min-h-52 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center dark:border-white/15 dark:bg-[#121212]">
                <CheckCircle2 className="mb-3 h-8 w-8 text-emerald-500" />
                <p className="font-bold text-slate-800 dark:text-slate-100">ไม่พบรายการตามเงื่อนไข</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">ปรับตัวกรองหรือรีเฟรชข้อมูลอีกครั้ง</p>
              </div>
            )}
          </section>
        </>
      )}
      {selectedIssue && (
        <IssueWorkflowDialog
          issue={selectedIssue}
          record={workflows[selectedIssue.id]}
          onClose={() => setSelectedIssue(null)}
          onSaved={(record) => setWorkflows((current) => ({ ...current, [record.issueId]: record }))}
        />
      )}
      <EmployeeProfileDrawer
        isOpen={Boolean(selectedEmployee)}
        employee={selectedEmployee}
        blurBackground
        onClose={() => setSelectedEmployee(null)}
        onUpdate={(updatedEmployee) => {
          setSelectedEmployee(updatedEmployee);
          void loadData(true);
        }}
      />
    </div>
  );
}

function MetricCard({ label, value, detail, icon: Icon, tone, loading, className }: { label: string; value?: number; detail: string; icon: typeof Users; tone: "sky" | "amber" | "rose" | "emerald"; loading: boolean; className?: string }) {
  const tones = {
    sky: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300",
    rose: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
  };
  return (
    <div className={cn("flex min-h-24 items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#121212]", className)}>
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", tones[tone])}><Icon className="h-5 w-5" /></span>
      <div className="min-w-0">
        <p className="truncate text-[10px] font-bold text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-2xl font-extrabold leading-none text-slate-950 dark:text-white">{loading && value === undefined ? "-" : (value ?? 0).toLocaleString("th-TH")}</p>
        <p className="mt-1 truncate text-[10px] text-slate-500 dark:text-slate-400">{detail}</p>
      </div>
    </div>
  );
}

function SelectFilter({ value, onChange, label, options }: { value: string; onChange: (value: string) => void; label: string; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="relative block">
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-9 text-sm font-semibold text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100 dark:border-white/10 dark:bg-[#121212] dark:text-slate-200 dark:focus:border-sky-500/40 dark:focus:ring-sky-500/10">
        <option value="all">{label}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </label>
  );
}

function IssueRow({ issue, workflow, onManage, onOpenEmployee }: { issue: QualityIssue; workflow?: WorkflowRecord; onManage: () => void; onOpenEmployee: () => void }) {
  const CategoryIcon = CATEGORY[issue.category].icon;
  const status = workflow?.status ?? "open";
  return (
    <div className="grid min-h-20 grid-cols-[105px_205px_145px_minmax(210px,1fr)_180px_150px] items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-slate-50/70 dark:border-white/5 dark:hover:bg-white/[0.025]">
      <IssueBadge issue={issue} />
      <div className="min-w-0"><p className="truncate text-xs font-extrabold text-sky-600 dark:text-sky-400">ID: {issue.employee.id}</p><p className="truncate text-sm font-bold text-slate-900 dark:text-white">{displayName(issue)}</p><p className="truncate text-[10px] text-slate-500">{issue.employee.nameTh}</p></div>
      <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300"><CategoryIcon className="h-4 w-4 shrink-0 text-slate-400" /><span className="truncate">{CATEGORY[issue.category].label}</span></div>
      <div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900 dark:text-white">{issue.title}</p><p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{issue.description}</p></div>
      <div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-300">{issue.employee.department || "-"}</p><p className="mt-0.5 truncate text-[10px] text-slate-500">{issue.fields.join(", ")}</p></div>
      <div className="flex min-w-0 items-center gap-1.5">
        <div className="min-w-0 flex-1"><WorkflowBadge status={status} />{workflow?.assignee && <p className="mt-1 truncate text-[9px] text-slate-500">{workflow.assignee.name}</p>}</div>
        <button type="button" onClick={onManage} title="Manage workflow" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-500/10 dark:hover:text-amber-300"><ClipboardCheck className="h-4 w-4" /></button>
        <button type="button" onClick={onOpenEmployee} title="Open employee profile" aria-label={`Open employee profile ${issue.employee.id}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-sky-50 hover:text-sky-600 dark:hover:bg-sky-500/10 dark:hover:text-sky-300"><PanelRightOpen className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

function IssueCard({ issue, workflow, onManage, onOpenEmployee }: { issue: QualityIssue; workflow?: WorkflowRecord; onManage: () => void; onOpenEmployee: () => void }) {
  const CategoryIcon = CATEGORY[issue.category].icon;
  const status = workflow?.status ?? "open";
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm dark:border-white/10 dark:bg-[#121212]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="text-xs font-extrabold text-sky-600 dark:text-sky-400">ID: {issue.employee.id}</p><p className="truncate text-sm font-extrabold text-slate-950 dark:text-white">{displayName(issue)}</p><p className="truncate text-[10px] text-slate-500">{issue.employee.nameTh}</p></div>
        <IssueBadge issue={issue} />
      </div>
      <div className="my-3 border-t border-slate-100 dark:border-white/5" />
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400"><CategoryIcon className="h-4 w-4" />{CATEGORY[issue.category].label}</div>
      <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">{issue.title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{issue.description}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-300">{issue.employee.department || issue.employee.position || "-"}</p><p className="mt-0.5 truncate text-[10px] text-slate-400">{issue.fields.join(", ")}</p></div>
        <div className="flex shrink-0 items-center gap-1.5">
          <WorkflowBadge status={status} />
          <button type="button" onClick={onManage} title="Manage workflow" className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-amber-200 hover:text-amber-600 dark:border-white/10 dark:hover:border-amber-500/30 dark:hover:text-amber-300"><ClipboardCheck className="h-4 w-4" /></button>
          <button type="button" onClick={onOpenEmployee} title="Open employee profile" aria-label={`Open employee profile ${issue.employee.id}`} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-sky-200 hover:text-sky-600 dark:border-white/10 dark:hover:border-sky-500/30 dark:hover:text-sky-300"><PanelRightOpen className="h-4 w-4" /></button>
        </div>
      </div>
      {workflow?.assignee && <p className="mt-2 truncate text-[10px] text-slate-500">ผู้รับผิดชอบ: {workflow.assignee.name}{workflow.dueDate ? ` · ${workflow.dueDate}` : ""}</p>}
    </article>
  );
}
