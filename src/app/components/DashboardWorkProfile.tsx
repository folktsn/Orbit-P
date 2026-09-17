"use client";

import { useEffect, useState } from "react";
import { WORK_PROFILE_FIELDS, type EmployeeWorkProfile } from "@/lib/employee-work-profile";
import styles from "../dashboard.module.css";

type ProfileState = { status: "loading" | "ready" | "error"; profile: EmployeeWorkProfile | null };

export function DashboardWorkProfile() {
  const [result, setResult] = useState<ProfileState>({ status: "loading", profile: null });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let controller: AbortController | undefined;
    const load = async () => {
      controller?.abort();
      const current = new AbortController();
      controller = current;
      try {
        const response = await fetch("/api/auth/work-profile", { cache: "no-store", signal: current.signal });
        if (!response.ok) throw new Error("Work profile unavailable");
        const data = await response.json() as { profile: EmployeeWorkProfile | null };
        if (!current.signal.aborted) setResult({ status: "ready", profile: data.profile });
      } catch {
        if (!current.signal.aborted) setResult({ status: "error", profile: null });
      }
    };
    void load();
    window.addEventListener("focus", load);
    return () => { controller?.abort(); window.removeEventListener("focus", load); };
  }, [revision]);

  return (
    <div className={styles.workProfile} aria-label="Your work profile" aria-busy={result.status === "loading"}>
      <dl>
        {WORK_PROFILE_FIELDS.map(({ key, label }) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>{result.status === "loading" ? "Loading…" : result.status === "error" ? "Unavailable" : result.profile?.[key] || "Not specified"}</dd>
          </div>
        ))}
      </dl>
      {result.status === "error" && <button className={styles.profileRetry} onClick={() => { setResult({ status: "loading", profile: null }); setRevision((value) => value + 1); }}>Retry profile</button>}
    </div>
  );
}
