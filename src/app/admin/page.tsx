"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Link2, Loader2, RefreshCw, Search, ShieldCheck, ShieldX, UserRound, X } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { PermissionPanel } from "@/app/employees/components/PermissionPanel";
import { type PermissionSet } from "@/lib/permissions";

type DirectoryUser = {
  staffId: string; name: string; nameTh: string; position: string; department: string;
  status: string; linked: boolean; permissions: PermissionSet; isExplicit: boolean;
};
type DirectoryResponse = {
  users: DirectoryUser[]; total: number; page: number; totalPages: number;
  totalEmployees: number; totalAdmins: number;
};

export default function AdminPage() {
  const { can } = useAuth();
  return can("admin") ? <AdminDirectory /> : <AdminDenied />;
}

function AdminDenied() {
  return (
    <section className="mx-auto max-w-3xl px-5 py-16 text-center">
      <ShieldX className="mx-auto h-8 w-8 text-amber-500" />
      <h1 className="mt-4 text-xl font-semibold text-slate-900 dark:text-white">เฉพาะผู้ดูแลระบบ</h1>
      <p className="mt-2 text-sm text-slate-500">บัญชีนี้ไม่มี Admin Permission</p>
    </section>
  );
}

function AdminDirectory() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [permission, setPermission] = useState("all");
  const [status, setStatus] = useState("active");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [directory, setDirectory] = useState<DirectoryResponse | null>(null);
  const [selected, setSelected] = useState<DirectoryUser | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const editorRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ q: search, permission, status, page: String(page) });
        const response = await fetch(`/api/admin/users?${params}`, { cache: "no-store", signal: controller.signal });
        if (response.status === 401 || response.status === 403) {
          setForbidden(true);
          return;
        }
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "ไม่สามารถโหลดรายชื่อได้");
        if (!controller.signal.aborted) setDirectory(result);
      } catch (loadError) {
        if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "ไม่สามารถโหลดรายชื่อได้");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, search ? 250 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, permission, status, page, refreshKey]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const selectEmployee = (employee: DirectoryUser | null) => {
    if (saving) return;
    if (selected?.staffId === employee?.staffId) return;
    if (dirty && !window.confirm("มีสิทธิ์ที่ยังไม่ได้บันทึก ต้องการละทิ้งการเปลี่ยนแปลงหรือไม่?")) return;
    setDirty(false);
    setSelected(employee);
    if (employee && window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  const handleSaved = useCallback((staffId: string, permissions: PermissionSet) => {
    setDirty(false);
    setSelected((current) => current?.staffId === staffId ? { ...current, permissions, isExplicit: true } : current);
    setRefreshKey((key) => key + 1);
    if (staffId === user?.staffId && !permissions.admin) window.location.reload();
  }, [user?.staffId]);

  if (forbidden) return <AdminDenied />;
  const inputClass = "h-10 min-w-0 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 dark:border-white/10 dark:bg-[#121212] dark:text-slate-200";

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl px-4 py-6 sm:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5 dark:border-white/10">
        <div>
          <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400"><ShieldCheck className="h-5 w-5" /><span className="text-xs font-semibold">Admin</span></div>
          <h1 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">จัดการสิทธิ์ผู้ใช้งาน</h1>
        </div>
        <div className="flex items-center gap-5 text-xs text-slate-500">
          <span>พนักงาน <strong className="ml-1 text-base text-slate-900 dark:text-white">{directory?.totalEmployees.toLocaleString() ?? "-"}</strong></span>
          <span>Admin <strong className="ml-1 text-base text-emerald-600 dark:text-emerald-400">{directory?.totalAdmins ?? "-"}</strong></span>
        </div>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)_40px] gap-2 border-b border-slate-200 py-4 sm:grid-cols-[minmax(0,1fr)_160px_140px_40px] dark:border-white/10">
        <label className="relative col-span-2 min-w-0 sm:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input aria-label="ค้นหาพนักงาน" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="ค้นหาชื่อ รหัสพนักงาน ตำแหน่ง หรือฝ่าย" className={`${inputClass} w-full pl-9`} />
        </label>
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:contents">
          <select aria-label="กรองสิทธิ์" value={permission} onChange={(event) => { setPermission(event.target.value); setPage(1); }} className={inputClass}>
            <option value="all">สิทธิ์ทั้งหมด</option><option value="admin">Admin Permission</option><option value="edit">Edit Permission</option><option value="view">View Permission</option><option value="access">Access Permission</option><option value="blocked">ปิดสิทธิ์เข้าถึง</option>
          </select>
          <select aria-label="สถานะพนักงาน" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className={inputClass}>
            <option value="active">Active</option><option value="all">ทุกสถานะ</option><option value="inactive">สถานะอื่น</option>
          </select>
        </div>
        <button type="button" onClick={() => setRefreshKey((key) => key + 1)} disabled={loading} aria-label="รีเฟรชรายชื่อ" title="รีเฟรชรายชื่อ" className={`${inputClass} flex w-10 items-center justify-center px-0 text-sky-600 disabled:opacity-50`}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>
      </div>

      <div className="grid min-w-0 gap-6 pt-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-7">
        <section aria-label="รายชื่อผู้ใช้งาน" aria-busy={loading} className="order-2 min-w-0 lg:order-1">
          <div className="mb-3 flex items-center justify-between text-xs text-slate-500"><span role="status">พบ {directory?.total.toLocaleString() ?? 0} คน</span>{loading && <Loader2 className="h-4 w-4 animate-spin" aria-label="กำลังโหลด" />}</div>
          {error ? <div role="alert" className="border-y border-rose-200 py-8 text-center text-sm text-rose-600">{error}<button type="button" onClick={() => setRefreshKey((key) => key + 1)} className="mx-auto mt-3 flex items-center gap-2 text-xs font-semibold"><RefreshCw className="h-4 w-4" />ลองใหม่</button></div> : (
            <ul className="divide-y divide-slate-200 border-y border-slate-200 dark:divide-white/10 dark:border-white/10">
              {directory?.users.map((employee) => {
                const chosen = selected?.staffId === employee.staffId;
                const label = employee.permissions.admin ? "Admin" : employee.permissions.edit ? "Edit" : employee.permissions.view ? "View" : employee.permissions.access ? "Access" : "ปิดสิทธิ์";
                return <li key={employee.staffId}>
                  <button type="button" aria-pressed={chosen} disabled={saving} onClick={() => selectEmployee(employee)} className={`flex w-full min-w-0 items-center gap-3 px-3 py-3 text-left transition-colors disabled:cursor-wait ${chosen ? "bg-sky-50 ring-1 ring-inset ring-sky-200 dark:bg-sky-500/10 dark:ring-sky-500/30" : "hover:bg-white dark:hover:bg-white/5"}`}>
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${employee.permissions.admin ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" : "bg-slate-100 text-slate-500 dark:bg-white/5"}`}>{employee.permissions.admin ? <ShieldCheck className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400">{employee.staffId}</span><span className={`text-[10px] font-semibold ${employee.permissions.admin ? "text-emerald-600 dark:text-emerald-400" : employee.permissions.access ? "text-slate-500" : "text-rose-500"}`}>{label}</span>{employee.staffId === user?.staffId && <span className="text-[10px] text-slate-400">คุณ</span>}</span>
                      <span className="mt-0.5 block truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100" title={employee.name}>{employee.name}</span>
                      <span className="block truncate text-[11px] text-slate-500" title={[employee.position, employee.department].filter(Boolean).join(" / ")}>{employee.position || employee.department || "-"}</span>
                      <span className={`mt-1 inline-flex items-center gap-1 text-[10px] ${employee.linked ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}><Link2 className="h-3 w-3" />{employee.linked ? "ผูก LINE แล้ว" : "ยังไม่ผูก LINE"}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                  </button>
                </li>;
              })}
            </ul>
          )}
          {!loading && !error && !directory?.users.length && <p className="py-14 text-center text-sm text-slate-500">ไม่พบพนักงานตามเงื่อนไข</p>}
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
            <span>หน้า {directory?.page ?? 1} / {directory?.totalPages ?? 1}</span>
            <div className="flex gap-2">
              <button type="button" title="หน้าก่อนหน้า" aria-label="หน้าก่อนหน้า" disabled={loading || !directory || directory.page <= 1} onClick={() => setPage((directory?.page || 1) - 1)} className={`${inputClass} flex w-9 items-center justify-center px-0 disabled:opacity-30`}><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" title="หน้าถัดไป" aria-label="หน้าถัดไป" disabled={loading || !directory || directory.page >= directory.totalPages} onClick={() => setPage((directory?.page || 1) + 1)} className={`${inputClass} flex w-9 items-center justify-center px-0 disabled:opacity-30`}><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        </section>

        <aside ref={editorRef} aria-label="กำหนดสิทธิ์พนักงาน" className={`order-1 min-w-0 scroll-mt-4 lg:order-2 lg:border-l lg:border-slate-200 lg:pl-7 lg:dark:border-white/10 ${selected ? "" : "hidden lg:block"}`}>
          {selected ? <div className="lg:sticky lg:top-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="text-xs font-semibold text-sky-600">ID {selected.staffId}</p><h2 className="mt-1 break-words text-base font-semibold text-slate-900 dark:text-white">{selected.name}</h2><p className="mt-1 text-xs text-slate-500">{selected.nameTh}</p></div>
              <button type="button" disabled={saving} onClick={() => selectEmployee(null)} aria-label="ปิดการกำหนดสิทธิ์" title="ปิดการกำหนดสิทธิ์" className="flex h-8 w-8 shrink-0 items-center justify-center text-slate-400 hover:text-slate-900 disabled:opacity-40 dark:hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <dl className="mb-5 space-y-2 text-xs"><div><dt className="text-slate-400">ตำแหน่ง</dt><dd className="mt-0.5 break-words text-slate-700 dark:text-slate-300">{selected.position || "-"}</dd></div><div><dt className="text-slate-400">ฝ่าย</dt><dd className="mt-0.5 break-words text-slate-700 dark:text-slate-300">{selected.department || "-"}</dd></div><div><dt className="sr-only">สถานะ</dt><dd className="flex flex-wrap gap-3"><span className="text-slate-500">{selected.status}</span><span className={selected.linked ? "text-emerald-600" : "text-amber-600"}>{selected.linked ? "ผูก LINE แล้ว" : "ยังไม่ผูก LINE"}</span></dd></div></dl>
            <PermissionPanel key={selected.staffId} staffId={selected.staffId} canAdmin onSaved={handleSaved} onDirtyChange={setDirty} onSavingChange={setSaving} />
          </div> : <div className="py-20 text-center text-slate-400"><ShieldCheck className="mx-auto h-8 w-8" /><p className="mt-3 text-sm">เลือกพนักงาน</p></div>}
        </aside>
      </div>
    </div>
  );
}
