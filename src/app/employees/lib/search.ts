import { getDepartureDate, parseEmployeeDate, type DepartureRecord } from "./resignation";

type SearchRecord = DepartureRecord & {
  name?: string;
  nameEn?: string;
  title?: string;
  department?: string;
  division?: string;
  section?: string;
  unit?: string;
  station?: string;
  phone?: string;
  idCard?: string;
  contractStart?: string;
};

type SearchFilters = {
  searchQuery?: string;
  departmentFilter?: string;
  divisionFilter?: string;
  sectionFilter?: string;
  unitFilter?: string;
  stationFilter?: string;
  startDateFilter?: string;
  endDateFilter?: string;
  dateField?: "start" | "departure";
};

type GroupField = "department" | "division" | "section" | "unit" | "station";
export type EmployeeFilterRecord = Pick<SearchRecord, GroupField>;
const optionCollator = new Intl.Collator("th", { numeric: true, sensitivity: "base" });

export function normalizeSearchText(value: unknown): string {
  const text = String(value ?? "").normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  return ["-", "null", "undefined"].includes(text) ? "" : text;
}

function languageParts(value: unknown) {
  const text = normalizeSearchText(value);
  return [text, ...text.split(/\s*\/\s*/)].filter(Boolean);
}

export function matchesStation(value: unknown, filter: unknown) {
  const key = (part: string) => part.replace(/[\s()[\]._-]/g, "");
  const selected = languageParts(filter).map(key);
  return !selected.length || languageParts(value).some((part) => selected.includes(key(part)));
}

export function matchesOrganization(value: unknown, filter: unknown) {
  const selected = normalizeSearchText(filter);
  if (!selected) return true;
  // Organization selectors append codes; compare complete names, not substrings.
  const withoutCode = (part: string) => part.replace(/\s+\([^()]+\)$/, "").trim();
  const code = (part: string) => part.match(/\s+\(([^()]+)\)$/)?.[1];
  return languageParts(value).some((part) => languageParts(selected).some((option) =>
    part === option || (withoutCode(part) === withoutCode(option) && (!code(part) || !code(option) || code(part) === code(option)))));
}

export function getEmployeeFilterOptions(
  records: EmployeeFilterRecord[],
  filters: Pick<SearchFilters, "departmentFilter" | "divisionFilter" | "sectionFilter"> = {},
  preferredLabels: Partial<Record<GroupField, string[]>> = {},
) {
  const optionsFor = (field: GroupField, rows: EmployeeFilterRecord[]) => {
    const values = new Map<string, string>();
    const seen = new Set<string>();
    const matches = field === "station" ? matchesStation : matchesOrganization;
    for (const row of rows) {
      const raw = String(row[field] ?? "").replace(/\s+/g, " ").trim();
      const normalized = normalizeSearchText(raw);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      // Master data may supply labels, but only employee records supply groups.
      const labels = (preferredLabels[field] ?? []).filter((label) => normalizeSearchText(label) && matches(raw, label));
      const label = labels.length === 1 ? labels[0] : raw;
      const key = field === "station" ? normalizeSearchText(label).replace(/[\s()[\]._-]/g, "") : normalizeSearchText(label);
      if (!values.has(key)) values.set(key, label);
    }
    return [...values.values()].sort(optionCollator.compare);
  };
  const divisionRows = records.filter((row) => matchesOrganization(row.department, filters.departmentFilter));
  const sectionRows = divisionRows.filter((row) => matchesOrganization(row.division, filters.divisionFilter));
  const unitRows = sectionRows.filter((row) => matchesOrganization(row.section, filters.sectionFilter));
  return {
    departments: optionsFor("department", records),
    divisions: optionsFor("division", divisionRows),
    sections: optionsFor("section", sectionRows),
    units: optionsFor("unit", unitRows),
    stations: optionsFor("station", records),
  };
}

type SearchText = { fields: string[]; numbers: string[] };

function prepareSearchText(employee: SearchRecord): SearchText {
  return {
    fields: [employee.id, employee.name, employee.nameEn, employee.title,
      employee.department, employee.division, employee.section, employee.unit, employee.station].map(normalizeSearchText),
    numbers: [employee.id, employee.phone, employee.idCard].map((value) => normalizeSearchText(value).replace(/\D/g, "")),
  };
}

// Keep normalized text for this data snapshot, not for a user session or across updates.
export function createEmployeeSearch<T extends SearchRecord>(records: T[]) {
  const textCache = new Map<T, SearchText>();
  return (filters: SearchFilters) => filterRecords(records, filters, (employee) => {
    let text = textCache.get(employee);
    if (!text) {
      text = prepareSearchText(employee);
      textCache.set(employee, text);
    }
    return text;
  });
}

export function filterEmployeeRecords<T extends SearchRecord>(records: T[], filters: SearchFilters): T[] {
  return filterRecords(records, filters, prepareSearchText);
}

function filterRecords<T extends SearchRecord>(records: T[], filters: SearchFilters, searchText: (employee: T) => SearchText): T[] {
  const query = normalizeSearchText(filters.searchQuery).replace(/^@/, "");
  const terms = query.split(" ").filter(Boolean);
  const numericQuery = /^[\d\s()+.-]+$/.test(query) ? query.replace(/\D/g, "") : "";
  const start = parseEmployeeDate(filters.startDateFilter);
  const end = parseEmployeeDate(filters.endDateFilter);
  const hasDateFilter = Boolean(filters.startDateFilter || filters.endDateFilter);
  if ((filters.startDateFilter && !start) || (filters.endDateFilter && !end) || (start && end && start > end)) return [];

  const groupFilters = ([
    ["department", filters.departmentFilter], ["division", filters.divisionFilter],
    ["section", filters.sectionFilter], ["unit", filters.unitFilter],
  ] as const).filter(([, value]) => normalizeSearchText(value));
  const stationFilter = normalizeSearchText(filters.stationFilter);

  return records.filter((employee) => {
    if (groupFilters.some(([field, value]) => !matchesOrganization(employee[field], value))
      || (stationFilter && !matchesStation(employee.station, stationFilter))) return false;

    if (hasDateFilter) {
      const date = parseEmployeeDate(filters.dateField === "departure" ? getDepartureDate(employee) : employee.contractStart);
      if (!date || (start && date < start) || (end && date > end)) return false;
    }
    if (!query) return true;

    if (numericQuery) {
      return searchText(employee).numbers.some((value) => value.includes(numericQuery));
    }
    const { fields } = searchText(employee);
    return terms.every((term) => fields.some((field) => field.includes(term)) || matchesStation(employee.station, term));
  });
}
