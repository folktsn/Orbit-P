export const WORK_PROFILE_FIELDS = [
  { key: "position", label: "Position" },
  { key: "unit", label: "Unit" },
  { key: "section", label: "Section" },
  { key: "division", label: "Division" },
  { key: "department", label: "Department" },
] as const;

export type EmployeeWorkProfile = Record<typeof WORK_PROFILE_FIELDS[number]["key"], string | null>;

export const WORK_PROFILE_SOURCE_FIELDS = WORK_PROFILE_FIELDS.flatMap(({ key }) => [`${key}_en`, key]);

function englishText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || /^(?:[-–—]|null|undefined|n\/?a|none)$/i.test(text)) return null;
  // Legacy unqualified fields may contain Thai; do not invent translations.
  if (/[\u0e00-\u0e7f]/.test(text) || !/[a-z]/i.test(text)) return null;
  return text;
}

export function toEmployeeWorkProfile(employee: Record<string, unknown>): EmployeeWorkProfile {
  return Object.fromEntries(WORK_PROFILE_FIELDS.map(({ key }) => [
    key, englishText(employee[`${key}_en`]) ?? englishText(employee[key]),
  ])) as EmployeeWorkProfile;
}
