"use client";

import {
  CheckCircle2,
  CircleDot,
  Clock3,
  EyeOff,
  Loader2,
  Save,
  UserRoundSearch,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { cn } from "@/lib/utils";

export type WorkflowStatus = "open" | "in_progress" | "resolved" | "ignored";

export type WorkflowRecord = {
  issueId: string;
  status: WorkflowStatus;
  assignee: { id: string; name: string; position: string } | null;
  dueDate: string;
  note: string;
  updatedAt: string;
  updatedBy: { id: string; name: string };
  history: Array<{
    status: WorkflowStatus;
    changedAt: string;
    changedBy: { id: string; name: string };
    note: string;
  }>;
};

type WorkflowIssue = {
  id: string;
  title: string;
  description: string;
  employee: { id: string; nameTh: string; nameEn: string };
};

const STATUS_OPTIONS = [
  { value: "open", label: "ยังไม่ดำเนินการ", icon: CircleDot, active: "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-950" },
  { value: "in_progress", label: "กำลังดำเนินการ", icon: Clock3, active: "border-sky-500 bg-sky-500 text-white" },
  { value: "resolved", label: "แก้ไขแล้ว", icon: CheckCircle2, active: "border-emerald-500 bg-emerald-500 text-white" },
  { value: "ignored", label: "ยกเว้น", icon: EyeOff, active: "border-slate-500 bg-slate-500 text-white" },
] satisfies Array<{ value: WorkflowStatus; label: string; icon: typeof CircleDot; active: string }>;

function formatTimestamp(value: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

export function IssueWorkflowDialog({
  issue,
  record,
  onClose,
  onSaved,
}: {
  issue: WorkflowIssue;
  record?: WorkflowRecord;
  onClose: () => void;
  onSaved: (record: WorkflowRecord) => void;
}) {
  const { user } = useAuth();
  const [status, setStatus] = useState<WorkflowStatus>(record?.status ?? "open");
  const [assigneeId, setAssigneeId] = useState(record?.assignee?.id ?? "");
  const [assignee, setAssignee] = useState(record?.assignee ?? null);
  const [dueDate, setDueDate] = useState(record?.dueDate ?? "");
  const [note, setNote] = useState(record?.note ?? "");
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "found" | "missing">(record?.assignee ? "found" : "idle");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    const id = assigneeId.trim();
    if (!id) {
      const frame = requestAnimationFrame(() => {
        setAssignee(null);
        setLookupState("idle");
      });
      return () => cancelAnimationFrame(frame);
    }
    if (record?.assignee?.id === id) {
      const frame = requestAnimationFrame(() => {
        setAssignee(record.assignee);
        setLookupState("found");
      });
      return () => cancelAnimationFrame(frame);
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLookupState("loading");
      try {
        const response = await fetch(`/api/employees?id=${encodeURIComponent(id)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("not-found");
        const employee = await response.json();
        const name = employee.name_en
          || employee.name_th
          || [employee.first_name_en || employee.first_name_th, employee.last_name_en || employee.last_name_th].filter(Boolean).join(" ")
          || id;
        const position = employee.position_en || employee.position_th || employee.position || employee.title || "-";
        setAssignee({ id, name, position });
        setLookupState("found");
      } catch (lookupError) {
        if ((lookupError as Error).name === "AbortError") return;
        setAssignee(null);
        setLookupState("missing");
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [assigneeId, record?.assignee]);

  const save = async () => {
    if (assigneeId.trim() && (!assignee || assignee.id !== assigneeId.trim())) {
      setError("กรุณารอให้ระบบตรวจสอบรหัสผู้รับผิดชอบ");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/data-quality/actions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueId: issue.id,
          status,
          assigneeId: assigneeId.trim(),
          dueDate,
          note,
          actor: { id: user?.username || "unknown", name: user?.displayName || "Unknown user" },
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "ไม่สามารถบันทึกข้อมูลได้");
      onSaved(payload.record);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "ไม่สามารถบันทึกข้อมูลได้");
    } finally {
      setSaving(false);
    }
  };

  const employeeName = issue.employee.nameEn || issue.employee.nameTh || "ไม่พบชื่อพนักงาน";

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="workflow-title" className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-lg border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#101010] sm:rounded-lg">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3.5 dark:border-white/10 sm:px-5">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase text-sky-600 dark:text-sky-400"><CircleDot className="h-3.5 w-3.5" />Data Quality Workflow</div>
            <h2 id="workflow-title" className="truncate text-base font-extrabold text-slate-950 dark:text-white">จัดการรายการตรวจสอบ</h2>
            <p className="mt-1 truncate text-xs text-slate-500">ID {issue.employee.id} · {employeeName}</p>
          </div>
          <button type="button" onClick={onClose} title="Close" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/5 dark:hover:text-white"><X className="h-4 w-4" /></button>
        </header>

        <div className="overflow-y-auto px-4 py-4 sm:px-5">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
            <p className="text-sm font-bold text-slate-900 dark:text-white">{issue.title}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{issue.description}</p>
          </div>

          <fieldset className="mt-4">
            <legend className="mb-2 text-xs font-bold text-slate-700 dark:text-slate-300">สถานะ</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {STATUS_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <button key={option.value} type="button" onClick={() => setStatus(option.value)} className={cn("flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-bold text-slate-600 transition dark:border-white/10 dark:bg-[#151515] dark:text-slate-300", status === option.value && option.active)}>
                    <Icon className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">รหัสพนักงานผู้รับผิดชอบ</span>
              <div className="relative">
                <input value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} placeholder="เช่น 02622" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 pr-9 text-sm text-slate-800 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100 dark:border-white/10 dark:bg-black dark:text-white dark:focus:border-sky-500/40 dark:focus:ring-sky-500/10" />
                {lookupState === "loading" ? <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-sky-500" /> : <UserRoundSearch className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />}
              </div>
              <div className="mt-1.5 min-h-8 text-[10px]">
                {lookupState === "found" && assignee && <><p className="font-bold text-emerald-600 dark:text-emerald-400">{assignee.name}</p><p className="truncate text-slate-500">{assignee.position}</p></>}
                {lookupState === "missing" && <p className="font-bold text-rose-600 dark:text-rose-400">ไม่พบรหัสพนักงานนี้</p>}
                {lookupState === "idle" && <p className="text-slate-400">ไม่บังคับระบุผู้รับผิดชอบ</p>}
              </div>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">กำหนดเสร็จ</span>
              <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100 dark:border-white/10 dark:bg-black dark:text-white dark:focus:border-sky-500/40 dark:focus:ring-sky-500/10" />
            </label>
          </div>

          <label className="mt-3 block">
            <span className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">หมายเหตุ</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} rows={3} placeholder="รายละเอียดการตรวจสอบหรือการแก้ไข" className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm leading-5 text-slate-800 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100 dark:border-white/10 dark:bg-black dark:text-white dark:focus:border-sky-500/40 dark:focus:ring-sky-500/10" />
          </label>

          {!!record?.history?.length && (
            <section className="mt-4 border-t border-slate-200 pt-4 dark:border-white/10">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">ประวัติล่าสุด</h3>
              <div className="mt-2 grid gap-2">
                {record.history.slice(-4).reverse().map((entry, index) => (
                  <div key={`${entry.changedAt}-${index}`} className="flex items-start justify-between gap-3 text-[10px]">
                    <div className="min-w-0"><p className="font-bold text-slate-700 dark:text-slate-200">{STATUS_OPTIONS.find((option) => option.value === entry.status)?.label} · {entry.changedBy.name}</p>{entry.note && <p className="truncate text-slate-500">{entry.note}</p>}</div>
                    <time className="shrink-0 text-slate-400">{formatTimestamp(entry.changedAt)}</time>
                  </div>
                ))}
              </div>
            </section>
          )}

          {error && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}
        </div>

        <footer className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-white/10 sm:px-5">
          <button type="button" onClick={onClose} className="h-10 rounded-lg border border-slate-200 px-4 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">ยกเลิก</button>
          <button type="button" onClick={() => void save()} disabled={saving || lookupState === "loading" || lookupState === "missing"} className="inline-flex h-10 items-center gap-2 rounded-lg bg-sky-600 px-4 text-xs font-bold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            บันทึก
          </button>
        </footer>
      </div>
    </div>
  );
}
