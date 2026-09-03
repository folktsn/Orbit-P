"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, RefreshCw, Save, ShieldCheck, Undo2 } from "lucide-react";
import {
  DEFAULT_PERMISSIONS,
  PERMISSION_DEFINITIONS,
  normalizePermissions,
  type PermissionKey,
  type PermissionSet,
} from "@/lib/permissions";

type PermissionResponse = {
  permissions: PermissionSet;
  isExplicit?: boolean;
  updatedAt?: string | null;
  updatedBy?: { id: string; name: string } | null;
  error?: string;
};

type PermissionPanelProps = {
  staffId: string;
  canAdmin: boolean;
  onSaved?: (staffId: string, permissions: PermissionSet) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onSavingChange?: (saving: boolean) => void;
};

export function PermissionPanel({ staffId, canAdmin, onSaved, onDirtyChange, onSavingChange }: PermissionPanelProps) {
  const [permissions, setPermissions] = useState<PermissionSet>(DEFAULT_PERMISSIONS);
  const [savedPermissions, setSavedPermissions] = useState<PermissionSet>(DEFAULT_PERMISSIONS);
  const [metadata, setMetadata] = useState<Pick<PermissionResponse, "isExplicit" | "updatedAt" | "updatedBy">>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const dirty = loaded && JSON.stringify(permissions) !== JSON.stringify(savedPermissions);

  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/permissions?staffId=${encodeURIComponent(staffId)}`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as PermissionResponse;
        if (!response.ok) throw new Error(result.error || "ไม่สามารถโหลดสิทธิ์ได้");
        return result;
      })
      .then((result) => {
        if (cancelled) return;
        const normalized = normalizePermissions(result.permissions);
        setPermissions(normalized);
        setSavedPermissions(normalized);
        setMetadata({ isExplicit: result.isExplicit, updatedAt: result.updatedAt, updatedBy: result.updatedBy });
        setLoaded(true);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "ไม่สามารถโหลดสิทธิ์ได้");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [staffId, retryKey]);

  const togglePermission = (key: PermissionKey) => {
    if (!canAdmin || !loaded || saving) return;
    setSaved(false);
    setError("");
    setPermissions((current) => {
      const next = { ...current, [key]: !current[key] };
      if (key === "access" && !next.access) return { access: false, view: false, edit: false, admin: false };
      if (key === "view" && !next.view) return { ...next, edit: false, admin: false };
      if (key === "edit" && !next.edit) return { ...next, admin: false };
      return normalizePermissions(next);
    });
  };

  const savePermissions = async () => {
    if (!canAdmin || !loaded || !dirty || saving) return;
    setSaving(true);
    onSavingChange?.(true);
    setSaved(false);
    setError("");
    try {
      const response = await fetch("/api/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, permissions }),
      });
      const result = await response.json() as PermissionResponse;
      if (!response.ok) throw new Error(result.error || "ไม่สามารถบันทึกสิทธิ์ได้");
      const normalized = normalizePermissions(result.permissions);
      setPermissions(normalized);
      setSavedPermissions(normalized);
      setMetadata({ isExplicit: true, updatedAt: result.updatedAt, updatedBy: result.updatedBy });
      setSaved(true);
      onSaved?.(staffId, normalized);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "ไม่สามารถบันทึกสิทธิ์ได้");
    } finally {
      setSaving(false);
      onSavingChange?.(false);
    }
  };

  return (
    <section className="border-t border-slate-200 pt-4 dark:border-white/10">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 rounded-md bg-sky-50 p-1.5 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">Permission</h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">กำหนดสิทธิ์การใช้งานสำหรับ ID {staffId}</p>
          </div>
        </div>
        {!canAdmin && (
          <span className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-500 dark:border-white/10 dark:text-slate-400">
            ดูได้เท่านั้น
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex h-24 items-center justify-center text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /></div>
      ) : loaded ? (
        <div className="space-y-2">
          {PERMISSION_DEFINITIONS.map((definition) => {
            const enabled = permissions[definition.key];
            return (
              <button
                key={definition.key}
                type="button"
                role="checkbox"
                aria-checked={enabled}
                aria-label={definition.label}
                onClick={() => togglePermission(definition.key)}
                disabled={!canAdmin || saving}
                className="flex w-full items-center gap-3 border-b border-slate-100 px-1 py-2.5 text-left last:border-0 disabled:cursor-default dark:border-white/5"
              >
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${enabled ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 text-transparent dark:border-white/20"}`}>
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-slate-800 dark:text-slate-100">{definition.label}</span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">{definition.description}</span>
                </span>
                <span className={`text-[10px] font-semibold ${enabled ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>
                  {enabled ? "อนุญาต" : "ไม่อนุญาต"}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {error && <p role="alert" className="mt-3 text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>}
      {!loading && !loaded && (
        <button type="button" onClick={() => { setLoading(true); setError(""); setRetryKey((key) => key + 1); }} className="mt-3 flex items-center gap-2 text-xs font-semibold text-sky-600">
          <RefreshCw className="h-4 w-4" />ลองใหม่
        </button>
      )}
      {saved && <p role="status" className="mt-3 text-xs text-emerald-600 dark:text-emerald-400">บันทึกสิทธิ์แล้ว</p>}

      {!loading && loaded && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-white/5">
          <p className="min-w-0 text-[10px] text-slate-400">
            {metadata.updatedBy
              ? `แก้ไขล่าสุดโดย ${metadata.updatedBy.name}`
              : metadata.isExplicit ? "กำหนดสิทธิ์เฉพาะบุคคล" : "ใช้สิทธิ์เริ่มต้น: เข้าถึงและดูข้อมูลได้"}
            {metadata.updatedAt && <time dateTime={metadata.updatedAt} className="mt-0.5 block">{new Date(metadata.updatedAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}</time>}
          </p>
          {canAdmin && (
            <div className="ml-auto flex items-center gap-2">
            {dirty && <button type="button" title="ยกเลิกการเปลี่ยนแปลง" aria-label="ยกเลิกการเปลี่ยนแปลง" disabled={saving} onClick={() => { setPermissions(savedPermissions); setError(""); }} className="flex h-8 w-8 items-center justify-center text-slate-500 disabled:opacity-40"><Undo2 className="h-4 w-4" /></button>}
            <button
              type="button"
              onClick={savePermissions}
              disabled={!dirty || saving}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-slate-900 px-3 text-xs font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-slate-100"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {saved ? "บันทึกแล้ว" : "บันทึก"}
            </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
