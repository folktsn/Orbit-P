export type DepartmentSummary = { department: string; departmentCode: string; current: number };
export type WorkforceSummary = { total: number; departments: DepartmentSummary[] };
export type RecruitmentSummary = { total: number; stages: { label: string; count: number }[] };

export function summarizeWorkforce(value: unknown): WorkforceSummary {
  const data = value as { departments?: DepartmentSummary[] } | null;
  if (!Array.isArray(data?.departments)) throw new Error("Invalid workforce response");
  const departments = data.departments.map((item) => {
    if (typeof item.department !== "string" || !Number.isFinite(item.current) || item.current < 0) throw new Error("Invalid department count");
    return { department: item.department, departmentCode: item.departmentCode || "", current: item.current };
  }).sort((a, b) => b.current - a.current);
  return { total: departments.reduce((sum, item) => sum + item.current, 0), departments };
}

export function summarizeRecruitment(value: unknown): RecruitmentSummary {
  const data = value as { success?: boolean; candidates?: { status: string }[] } | null;
  if (!data?.success || !Array.isArray(data.candidates)) throw new Error("Invalid recruitment response");
  const candidates = data.candidates;
  const labels = ["สมัครแล้ว", "คัดกรอง", "สัมภาษณ์", "จ้างงาน"];
  return { total: candidates.length, stages: labels.map((label) => ({ label, count: candidates.filter((candidate) => candidate.status === label).length })) };
}

export function summarizeProbation(value: unknown): number {
  const data = value as { items?: unknown[] } | null;
  if (!Array.isArray(data?.items)) throw new Error("Invalid probation response");
  return data.items.length;
}
