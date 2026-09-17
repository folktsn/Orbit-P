"use client";

import { useCallback, useEffect, useState } from "react";
import { summarizeProbation, summarizeRecruitment, summarizeWorkforce, type RecruitmentSummary, type WorkforceSummary } from "./dashboard-data";

export type SummaryResult<T> = { status: "loading" | "ready" | "error" | "restricted"; data?: T };
type DashboardSummary = {
  workforce: SummaryResult<WorkforceSummary>;
  recruitment: SummaryResult<RecruitmentSummary>;
  probation: SummaryResult<number>;
  updatedAt: string | null;
};

async function readSummary<T>(url: string, allowed: boolean, parse: (value: unknown) => T, signal: AbortSignal): Promise<SummaryResult<T>> {
  if (!allowed) return { status: "restricted" };
  try {
    const response = await fetch(url, { cache: "no-store", signal });
    if (response.status === 403) return { status: "restricted" };
    if (!response.ok) throw new Error("Summary unavailable");
    return { status: "ready", data: parse(await response.json()) };
  } catch { return { status: "error" }; }
}

export function useDashboardSummary(manpower: boolean, recruitment: boolean, probation: boolean) {
  const [revision, setRevision] = useState(0);
  const [summary, setSummary] = useState<DashboardSummary>({
    workforce: { status: "loading" }, recruitment: { status: "loading" }, probation: { status: "loading" }, updatedAt: null,
  });
  const [refreshing, setRefreshing] = useState(true);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    async function load() {
      setRefreshing(true);
      const [workforceResult, recruitmentResult, probationResult] = await Promise.all([
        readSummary("/api/manpower/current?view=departments", manpower, summarizeWorkforce, signal),
        readSummary("/api/ats", recruitment, summarizeRecruitment, signal),
        readSummary("/api/probation", probation, summarizeProbation, signal),
      ]);
      if (signal.aborted) return;
      setSummary({ workforce: workforceResult, recruitment: recruitmentResult, probation: probationResult, updatedAt: new Date().toISOString() });
      setRefreshing(false);
    }
    void load();
    return () => controller.abort();
  }, [manpower, recruitment, probation, revision]);

  // Hide data as soon as permission changes, even during an in-flight request.
  return {
    ...summary,
    workforce: manpower ? summary.workforce : { status: "restricted" as const },
    recruitment: recruitment ? summary.recruitment : { status: "restricted" as const },
    probation: probation ? summary.probation : { status: "restricted" as const },
    refreshing, refresh,
  };
}
