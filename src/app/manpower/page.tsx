"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  BriefcaseBusiness,
  CheckCircle2,
  Download,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type OrganizationRecord = {
  id?: string;
  department_en?: string;
  department_th?: string;
  department_code?: string;
  division_en?: string;
  division_th?: string;
  division_code?: string;
  section_en?: string;
  section_th?: string;
  section_code?: string;
  unit_en?: string;
  unit_th?: string;
  unit_code?: string;
  position_en?: string;
  position_th?: string;
  position_level?: string;
  station?: string;
  active_count?: number;
};

type HeadcountStatus = "Budget Pending" | "Vacancy" | "Over Headcount" | "Full";

type HeadcountRow = {
  key: string;
  company: string;
  department: string;
  departmentCode: string;
  division: string;
  divisionCode: string;
  section: string;
  sectionCode: string;
  unit: string;
  unitCode: string;
  station: string;
  countKey: string;
  position: string;
  employmentType: string;
  current: number;
  approved: number | null;
  vacancy: number;
  over: number;
  status: HeadcountStatus;
};

type DepartmentGroup = {
  department: string;
  departmentCode: string;
  approved: number;
  current: number;
  vacancy: number;
  over: number;
  budgetPending: number;
  rows: HeadcountRow[];
};

type DepartmentSummary = {
  department: string;
  departmentCode: string;
  current: number;
  positions: number;
};

type CurrentDepartmentSummary = {
  department: string;
  departmentCode: string;
  current: number;
};

type CurrentCountResponse = {
  today: string;
  department?: string;
  total: number;
  rows: Array<{ key: string; current: number }>;
};

type DivisionSectionGroup = {
  key: string;
  division: string;
  divisionCode: string;
  section: string;
  sectionCode: string;
  approved: number;
  current: number;
  vacancy: number;
  over: number;
  budgetPending: number;
  rows: HeadcountRow[];
};

type DivisionGroup = {
  key: string;
  division: string;
  divisionCode: string;
  approved: number;
  current: number;
  vacancy: number;
  over: number;
  budgetPending: number;
  sections: DivisionSectionGroup[];
};

const BUDGET_STORAGE_KEY = "s-recruit-manpower-budget-v1";
const COMPANY_NAME = "S Recruit";
const EXCLUDED_MANPOWER_ROW_TERMS = new Set(["INTERNSHIP"]);
const EXCLUDED_MANPOWER_DEPARTMENTS = new Set(["INTERNSHIP", "EXCLUSIVE", "HDQ", "UNA", "พิเศษ"]);

function cleanValue(value: unknown, fallback = "-") {
  const text = String(value ?? "").trim();
  if (!text || text === "-" || text.toLowerCase() === "null" || text.toLowerCase() === "undefined") return fallback;
  return text;
}

function pickValue(...values: unknown[]) {
  for (const value of values) {
    const text = cleanValue(value, "");
    if (text) return text;
  }
  return "-";
}

function classifyRow(current: number, approved: number | null): HeadcountStatus {
  if (approved === null) return "Budget Pending";
  if (approved > current) return "Vacancy";
  if (current > approved) return "Over Headcount";
  return "Full";
}

function computeVacancy(current: number, approved: number | null) {
  return approved === null ? 0 : Math.max(approved - current, 0);
}

function computeOver(current: number, approved: number | null) {
  return approved === null ? 0 : Math.max(current - approved, 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function buildRowKey(parts: string[]) {
  return parts.map((part) => part.trim().toLowerCase()).join("||");
}

function buildCurrentCountKey(parts: string[]) {
  return parts.map((part) => cleanValue(part, "").toLowerCase().replace(/\s+/g, " ")).join("||");
}

function currentCountKeyWithoutStation(key: string) {
  const parts = key.split("||");
  if (parts.length < 7) return key;
  parts[5] = "";
  return parts.join("||");
}

function toDisplayCase(value: string) {
  const text = cleanValue(value, "");
  if (!text || /[^\u0000-\u007F]/.test(text)) return text;

  return text
    .split(/(\s+|[-/&()])/)
    .map((part) => {
      if (!part || /^\s+$/.test(part) || /^[-/&()]$/.test(part)) return part;
      if (/^[a-z]{1,4}$/i.test(part) && part === part.toUpperCase()) return part;
      if (/^[a-z]{1,4}$/i.test(part) && ["bg", "bh", "bi", "be", "bf", "bd", "bl", "bs", "br", "bm", "bt", "hc", "hm", "ho", "ge"].includes(part.toLowerCase())) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join("");
}

function formatStationCode(value: string) {
  const text = cleanValue(value, "");
  if (!text) return "";
  return text.replace(/\s+/g, "").toUpperCase();
}

function parseCurrentCountKey(key: string) {
  const [departmentCode = "", department = "Unassigned Department", division = "Unassigned Division", section = "Unassigned Section", unit = "Unassigned Unit", station = "", position = "Unassigned Position"] = key.split("||");
  return {
    departmentCode: toDisplayCase(departmentCode),
    department: toDisplayCase(department),
    division: toDisplayCase(division),
    section: toDisplayCase(section),
    unit: toDisplayCase(unit),
    station: formatStationCode(station),
    position: toDisplayCase(position),
  };
}

function positionRank(position: string) {
  const text = cleanValue(position, "").toLowerCase();
  const ranks: Array<[RegExp, number]> = [
    [/director|ผู้อำนวยการ/, 10],
    [/vice president|vp|รองประธาน/, 20],
    [/manager|ผู้จัดการ/, 30],
    [/supervisor|หัวหน้างาน|หัวหน้า/, 40],
    [/leader|lead|ผู้ช่วยหัวหน้า/, 50],
    [/officer|เจ้าหน้าที่/, 60],
    [/agent|พนักงานบริการ|พนักงาน/, 70],
    [/staff|operator|attendant|loader|cleaner|driver|mechanic|ช่าง|พนักงาน/, 80],
  ];

  return ranks.find(([pattern]) => pattern.test(text))?.[1] ?? 90;
}

function compareHeadcountRows(a: HeadcountRow, b: HeadcountRow) {
  return (
    positionRank(a.position) - positionRank(b.position) ||
    a.position.localeCompare(b.position) ||
    a.division.localeCompare(b.division) ||
    a.section.localeCompare(b.section) ||
    a.employmentType.localeCompare(b.employmentType)
  );
}

function isHumanResourcesDepartment(department: string, departmentCode = "") {
  const text = (departmentCode + " " + department).toLowerCase();
  return text.includes("bh") || text.includes("human resources");
}

function humanResourcesOrgRank(group: DivisionSectionGroup) {
  const division = group.division.toLowerCase();
  const section = group.section.toLowerCase();
  const topPosition = group.rows[0]?.position.toLowerCase() || "";

  if (topPosition.includes("director")) return 10;
  if (division.includes("corporate human resources")) return section.includes("unassigned") ? 100 : 120;
  if (division.includes("human resources management")) {
    if (section.includes("salary") || section.includes("compensation")) return 210;
    if (section.includes("employee relation") || section.includes("reations")) return 220;
    if (section.includes("information system")) return 230;
    if (section.includes("rostering") || section.includes("time management")) return 240;
    return 200;
  }
  if (division.includes("operations") || division.includes("support")) {
    if (section.includes("recruitment") || section.includes("employment")) return 310;
    if (section.includes("educational") || section.includes("education")) return 320;
    if (section.includes("bkk coordination") || section.includes("coordination and support")) return 330;
    return 300;
  }

  return 900 + positionRank(group.rows[0]?.position || "");
}

function compareDivisionSectionGroups(department: DepartmentGroup, a: DivisionSectionGroup, b: DivisionSectionGroup) {
  if (isHumanResourcesDepartment(department.department, department.departmentCode)) {
    return humanResourcesOrgRank(a) - humanResourcesOrgRank(b) || a.division.localeCompare(b.division) || a.section.localeCompare(b.section);
  }

  const topA = a.rows[0];
  const topB = b.rows[0];
  return (
    (topA ? positionRank(topA.position) : 90) - (topB ? positionRank(topB.position) : 90) ||
    a.division.localeCompare(b.division) ||
    a.section.localeCompare(b.section)
  );
}

function makeDepartmentAbbreviation(name: string) {
  const codeMatch = name.match(/\(([^)]+)\)$/);
  if (codeMatch?.[1]) return codeMatch[1].trim().toUpperCase();

  const words = name
    .replace(/department/gi, "")
    .replace(/[^A-Za-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length >= 2) return words.map((word) => word[0]).join("").slice(0, 3).toUpperCase();
  return name.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase() || "DEP";
}

function departmentSheetLabel(department: Pick<DepartmentGroup, "department" | "departmentCode">) {
  return cleanValue(department.departmentCode, "") || makeDepartmentAbbreviation(department.department);
}

function departmentKey(department: Pick<DepartmentGroup, "department" | "departmentCode">) {
  return cleanValue(department.departmentCode, "") || department.department;
}

function formatNameWithCode(name: string, code?: string) {
  const cleanName = cleanValue(name);
  const cleanCode = cleanValue(code, "");
  if (!cleanCode || cleanCode === cleanName) return cleanName;
  return cleanName + " (" + cleanCode + ")";
}

function isUnassignedName(value: string) {
  const normalized = cleanValue(value, "").toLowerCase();
  return !normalized || normalized === "unassigned section" || normalized === "unassigned division" || normalized === "unassigned" || normalized === "-";
}

function isExcludedManpowerDepartment(department: string, departmentCode: string) {
  const candidates = [departmentCode, department, makeDepartmentAbbreviation(department)]
    .map((value) => cleanValue(value, "").toUpperCase())
    .filter(Boolean);

  return candidates.some((value) =>
    Array.from(EXCLUDED_MANPOWER_DEPARTMENTS).some((excluded) => value === excluded || value.includes(excluded))
  );
}

function isExcludedManpowerRow(position: string, employmentType = "") {
  const candidates = [position, employmentType]
    .map((value) => cleanValue(value, "").toUpperCase())
    .filter(Boolean);

  return candidates.some((value) =>
    Array.from(EXCLUDED_MANPOWER_ROW_TERMS).some((excluded) => value === excluded || value.includes(excluded))
  );
}

function toCsvCell(value: string | number | null) {
  const text = value === null ? "" : String(value);
  return '"' + text.replace(/"/g, '""') + '"';
}

function normalizeBudgetMap(value: unknown): Record<string, number | null> {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const normalized: Record<string, number | null> = {};

  Object.entries(source).forEach(([key, budget]) => {
    const trimmedKey = key.trim();
    if (!trimmedKey) return;
    if (budget === null || budget === "") {
      normalized[trimmedKey] = null;
      return;
    }
    const numeric = Number(budget);
    normalized[trimmedKey] = Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : null;
  });

  return normalized;
}

function loadLocalBudgetCache() {
  try {
    return normalizeBudgetMap(window.localStorage.getItem(BUDGET_STORAGE_KEY) ? JSON.parse(window.localStorage.getItem(BUDGET_STORAGE_KEY) || "{}") : {});
  } catch (err) {
    console.error("Error loading local manpower budget cache", err);
    return {};
  }
}

function saveLocalBudgetCache(budgets: Record<string, number | null>) {
  try {
    window.localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(budgets));
  } catch (err) {
    console.error("Error saving local manpower budget cache", err);
  }
}

async function saveBudgetsToServer(budgets: Record<string, number | null>) {
  const response = await fetch("/api/manpower/budgets", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ budgets }),
  });

  if (!response.ok) throw new Error("Failed to save manpower budget: " + response.status);
}

export default function ManpowerMvpPage() {
  const [departmentSheets, setDepartmentSheets] = useState<DepartmentSummary[]>([]);
  const [orgData, setOrgData] = useState<OrganizationRecord[]>([]);
  const [currentCounts, setCurrentCounts] = useState<Record<string, number>>({});
  const [budgets, setBudgets] = useState<Record<string, number | null>>({});
  const [activeDepartment, setActiveDepartment] = useState("");
  const [loadedDepartmentKey, setLoadedDepartmentKey] = useState("");
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDepartmentLoading, setIsDepartmentLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  const loadBudgets = async () => {
    const response = await fetch("/api/manpower/budgets", { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to load manpower budget: " + response.status);

    const data = await response.json();
    const serverBudgets = normalizeBudgetMap(data?.budgets);
    const localBudgets = loadLocalBudgetCache();
    const mergedBudgets = { ...localBudgets, ...serverBudgets };
    const hasLocalOnlyBudgets = Object.keys(localBudgets).some((key) => !(key in serverBudgets));

    if (hasLocalOnlyBudgets) {
      await saveBudgetsToServer(mergedBudgets);
    }

    saveLocalBudgetCache(mergedBudgets);
    setBudgets(mergedBudgets);
    return mergedBudgets;
  };

  const fetchDepartmentSheets = async () => {
    const [orgResponse, currentResponse] = await Promise.all([
      fetch("/api/organization?view=departments", { cache: "no-store" }),
      fetch("/api/manpower/current?view=departments", { cache: "no-store" }),
    ]);

    if (!orgResponse.ok) throw new Error("Failed to load departments: " + orgResponse.status);
    if (!currentResponse.ok) throw new Error("Failed to load current headcount: " + currentResponse.status);

    const orgData = await orgResponse.json();
    const currentData = await currentResponse.json();
    const currentMap = new Map<string, number>();
    const currentDepartments: CurrentDepartmentSummary[] = Array.isArray(currentData?.departments) ? currentData.departments : [];

    currentDepartments.forEach((department) => {
      currentMap.set(departmentKey(department), Number(department.current) || 0);
    });

    const sheets = Array.isArray(orgData)
      ? orgData
          .filter((department) => !isExcludedManpowerDepartment(department.department, department.departmentCode))
          .map((department) => ({
            ...department,
            current: currentMap.get(departmentKey(department)) ?? 0,
          }))
      : [];

    setDepartmentSheets(sheets);
    return sheets;
  };

  const loadDepartmentDetail = async (department: string) => {
    const [orgResponse, currentResponse] = await Promise.all([
      fetch("/api/organization?department=" + encodeURIComponent(department), { cache: "no-store" }),
      fetch("/api/manpower/current?department=" + encodeURIComponent(department), { cache: "no-store" }),
    ]);

    if (!orgResponse.ok) throw new Error("Failed to load organization: " + orgResponse.status);
    if (!currentResponse.ok) throw new Error("Failed to load current headcount: " + currentResponse.status);

    const data = await orgResponse.json();
    const currentData: CurrentCountResponse = await currentResponse.json();
    const counts = Object.fromEntries((currentData.rows || []).map((row) => [row.key, Number(row.current) || 0]));

    return { organization: Array.isArray(data) ? data : [], counts };
  };

  const fetchManpowerData = async (manualRefresh = false) => {
    if (manualRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      setError("");
      const [sheets] = await Promise.all([fetchDepartmentSheets(), loadBudgets()]);
      const selectedKey = activeDepartment || (sheets[0] ? departmentKey(sheets[0]) : "");
      if (selectedKey) {
        if (!activeDepartment) setActiveDepartment(selectedKey);
        const detail = await loadDepartmentDetail(selectedKey);
        setOrgData(detail.organization);
        setCurrentCounts(detail.counts);
        setLoadedDepartmentKey(selectedKey);
      } else {
        setOrgData([]);
        setCurrentCounts({});
        setLoadedDepartmentKey("");
      }
      setLastUpdated(new Date().toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }));
    } catch (err: any) {
      console.error("Error loading manpower organization", err);
      setError(err?.message || "Failed to load organization data");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchManpowerData(false);
  }, []);

  useEffect(() => {
    if (!activeDepartment || isLoading || activeDepartment === loadedDepartmentKey) return;

    let cancelled = false;
    setIsDepartmentLoading(true);
    setError("");

    loadDepartmentDetail(activeDepartment)
      .then((detail) => {
        if (cancelled) return;
        setOrgData(detail.organization);
        setCurrentCounts(detail.counts);
        setLoadedDepartmentKey(activeDepartment);
        setLastUpdated(new Date().toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }));
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Error loading selected manpower department", err);
        setError(err?.message || "Failed to Load Selected Department");
      })
      .finally(() => {
        if (!cancelled) setIsDepartmentLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeDepartment, isLoading, loadedDepartmentKey]);

  const rows = useMemo<HeadcountRow[]>(() => {
    const grouped = new Map<string, { sample: HeadcountRow; current: number }>();
    const assignedCurrentKeys = new Set<string>();
    const currentKeysByStructure = new Set(
      Object.entries(currentCounts)
        .filter(([, current]) => current > 0)
        .map(([key]) => currentCountKeyWithoutStation(key))
    );

    orgData.forEach((item) => {
      const department = pickValue(item.department_en, item.department_th, "Unassigned Department");
      const departmentCode = pickValue(item.department_code, "");
      if (isExcludedManpowerDepartment(department, departmentCode)) return;

      const division = pickValue(item.division_en, item.division_th, "Unassigned Division");
      const divisionCode = pickValue(item.division_code, "");
      const section = pickValue(item.section_en, item.section_th, "Unassigned Section");
      const sectionCode = pickValue(item.section_code, "");
      const unit = pickValue(item.unit_en, item.unit_th, "Unassigned Unit");
      const unitCode = pickValue(item.unit_code, "");
      const station = pickValue(item.station, "");
      const position = pickValue(item.position_en, item.position_th, "Unassigned Position");
      const employmentType = "Normal";
      if (isExcludedManpowerRow(position, employmentType)) return;
      const countKey = buildCurrentCountKey([departmentCode, department, division, section, unit, station, position]);
      const stationValue = cleanValue(station, "");
      if (!stationValue && currentCounts[countKey] === undefined && currentKeysByStructure.has(currentCountKeyWithoutStation(countKey))) return;

      const key = buildRowKey([COMPANY_NAME, department, departmentCode, division, divisionCode, section, sectionCode, unit, unitCode, station, position, employmentType]);
      const current = assignedCurrentKeys.has(countKey) ? 0 : currentCounts[countKey] ?? 0;
      if (currentCounts[countKey] !== undefined) assignedCurrentKeys.add(countKey);
      const existing = grouped.get(key);

      if (existing) {
        existing.current += current;
        return;
      }

      grouped.set(key, {
        current,
        sample: {
          key,
          company: COMPANY_NAME,
          department,
          departmentCode,
          division,
          divisionCode,
          section,
          sectionCode,
          unit,
          unitCode,
          station,
          countKey,
          position,
          employmentType,
          current: 0,
          approved: null,
          vacancy: 0,
          over: 0,
          status: "Budget Pending",
        },
      });
    });

    Object.entries(currentCounts).forEach(([countKey, current]) => {
      if (assignedCurrentKeys.has(countKey) || current <= 0) return;
      const parsed = parseCurrentCountKey(countKey);
      if (isExcludedManpowerDepartment(parsed.department, parsed.departmentCode)) return;

      const employmentType = "Normal";
      if (isExcludedManpowerRow(parsed.position, employmentType)) return;
      const key = buildRowKey([COMPANY_NAME, parsed.department, parsed.departmentCode, parsed.division, "", parsed.section, "", parsed.unit, "", parsed.station, parsed.position, employmentType, "current-only"]);
      if (grouped.has(key)) return;

      grouped.set(key, {
        current,
        sample: {
          key,
          company: COMPANY_NAME,
          department: parsed.department,
          departmentCode: parsed.departmentCode,
          division: parsed.division,
          divisionCode: "",
          section: parsed.section,
          sectionCode: "",
          unit: parsed.unit,
          unitCode: "",
          station: parsed.station,
          countKey,
          position: parsed.position,
          employmentType,
          current: 0,
          approved: null,
          vacancy: 0,
          over: 0,
          status: "Budget Pending",
        },
      });
    });

    return Array.from(grouped.values())
      .map(({ sample, current }) => {
        const approved = budgets[sample.key] ?? null;
        return {
          ...sample,
          current,
          approved,
          vacancy: computeVacancy(current, approved),
          over: computeOver(current, approved),
          status: classifyRow(current, approved),
        };
      })
      .sort((a, b) => a.department.localeCompare(b.department) || compareHeadcountRows(a, b));
  }, [orgData, budgets, currentCounts]);

  const filteredRows = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return rows;
    return rows.filter((row) => [row.department, row.departmentCode, row.division, row.divisionCode, row.section, row.sectionCode, row.position, row.employmentType, row.station].some((value) => value.toLowerCase().includes(text)));
  }, [rows, query]);

  const loadedDepartment = useMemo<DepartmentGroup | null>(() => {
    if (!filteredRows.length) return null;
    return filteredRows.reduce<DepartmentGroup | null>((group, row) => {
      const next = group || {
        department: row.department,
        departmentCode: row.departmentCode,
        approved: 0,
        current: 0,
        vacancy: 0,
        over: 0,
        budgetPending: 0,
        rows: [],
      };
      next.current += row.current;
      next.approved += row.approved ?? 0;
      next.vacancy += row.vacancy;
      next.over += row.over;
      if (row.approved === null) next.budgetPending += 1;
      next.rows.push(row);
      return next;
    }, null);
  }, [filteredRows]);

  const departmentGroups = useMemo<DepartmentGroup[]>(() => {
    return departmentSheets.map((sheet) => {
      if (loadedDepartment && departmentKey(loadedDepartment) === departmentKey(sheet)) return loadedDepartment;
      return {
        department: sheet.department,
        departmentCode: sheet.departmentCode,
        approved: 0,
        current: sheet.current,
        vacancy: 0,
        over: 0,
        budgetPending: sheet.positions,
        rows: [],
      };
    });
  }, [departmentSheets, loadedDepartment]);

  const metrics = useMemo(() => {
    const approved = rows.reduce((sum, row) => sum + (row.approved ?? 0), 0);
    const current = departmentSheets.reduce((sum, department) => sum + department.current, 0);
    const vacancy = rows.reduce((sum, row) => sum + row.vacancy, 0);
    const over = rows.reduce((sum, row) => sum + row.over, 0);
    const pending = departmentSheets.reduce((sum, department) => sum + department.positions, 0);
    return { approved, current, vacancy, over, pending };
  }, [rows, departmentSheets]);

  const setBudget = (rowKey: string, value: string) => {
    setBudgets((previous) => {
      const next = { ...previous };
      if (value.trim() === "") next[rowKey] = null;
      else next[rowKey] = Math.max(Number(value) || 0, 0);
      saveLocalBudgetCache(next);
      saveBudgetsToServer(next).catch((err) => {
        console.error("Error saving manpower budget", err);
        setError(err?.message || "Failed to save manpower budget");
      });
      return next;
    });
  };

  const selectedDepartment = useMemo(() => {
    const activeSummary = departmentGroups.find((department) => departmentKey(department) === activeDepartment) || departmentGroups[0] || null;
    if (loadedDepartment && loadedDepartmentKey === activeDepartment) return loadedDepartment;
    return activeSummary;
  }, [departmentGroups, loadedDepartment, activeDepartment, loadedDepartmentKey]);

  useEffect(() => {
    if (!departmentGroups.length) {
      setActiveDepartment("");
      return;
    }

    if (!departmentGroups.some((department) => departmentKey(department) === activeDepartment)) {
      setActiveDepartment(departmentKey(departmentGroups[0]));
    }
  }, [departmentGroups, activeDepartment]);

  const exportCsv = () => {
    const header = ["Company", "Department Code", "Department", "Division Code", "Division", "Section Code", "Section", "Position", "Employment Type", "Station", "Approved Headcount", "Current Headcount", "Vacancy", "Over Headcount", "Status"];
    const lines = [header, ...rows.map((row) => [row.company, row.departmentCode, row.department, row.divisionCode, row.division, row.sectionCode, row.section, row.position, row.employmentType, formatStationCode(row.station), row.approved, row.current, row.vacancy, row.over, row.status])];
    const csv = lines.map((line) => line.map(toCsvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "manpower-headcount-mvp.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-90px)] items-center justify-center bg-slate-50 text-slate-600 dark:bg-[#050505] dark:text-slate-300">
        <RefreshCw className="mr-3 h-5 w-5 animate-spin text-sky-500" />
        Loading Department Sheets...
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-80px)] bg-[#f4f7fb] px-4 py-5 text-slate-950 dark:bg-[#050505] dark:text-white sm:px-6 lg:px-8 2xl:px-10">
      <div className="mx-auto w-full max-w-none space-y-4">
        <motion.section initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm shadow-slate-200/70 backdrop-blur dark:border-white/10 dark:bg-white/5 dark:shadow-none">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-sky-600 dark:text-sky-400">
              <BriefcaseBusiness className="h-4 w-4" />
              Manpower
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white">Headcount Budget Control</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
              Department Sheets load first. Current Headcount is counted from employees still working as of today.
            </p>
            <p className="mt-1 text-xs font-medium text-slate-400 dark:text-slate-500">Last Refreshed: {lastUpdated || "-"}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fetchManpowerData(true)}
              disabled={isRefreshing}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800 disabled:opacity-70 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              Refresh
            </button>
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:border-sky-300 hover:text-sky-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            >
              <Download className="h-4 w-4" />
              CSV
            </button>
          </div>
          </div>
        </motion.section>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </div>
        )}

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          <KpiCard icon={ShieldCheck} label="Approved Budget" value={formatNumber(metrics.approved)} tone="blue" sub={`${metrics.pending} Positions Pending`} />
          <KpiCard icon={Users} label="Current Headcount" value={formatNumber(metrics.current)} tone="emerald" sub={`${rows.length} Position Groups`} />
          <KpiCard icon={AlertTriangle} label="Vacancy" value={formatNumber(metrics.vacancy)} tone="orange" />
          <KpiCard icon={BriefcaseBusiness} label="Over" value={formatNumber(metrics.over)} tone="red" />
          <KpiCard icon={CheckCircle2} label="Departments" value={formatNumber(departmentGroups.length)} tone="slate" />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm shadow-slate-200/70 dark:border-white/10 dark:bg-white/5 dark:shadow-none">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-950 dark:text-white">Department Sheets</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Select a Department Sheet to load its Divisions, Sections, and Positions.</p>
            </div>
            <label className="relative block w-full lg:w-96">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search Department, Division, Section, Position..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-10 pr-10 text-sm font-medium outline-none transition focus:border-sky-300 focus:bg-white focus:ring-2 focus:ring-sky-100 dark:border-white/10 dark:bg-[#121212] dark:text-slate-200 dark:focus:ring-sky-500/20"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white/90 p-2 shadow-sm shadow-slate-200/70 dark:border-white/10 dark:bg-white/5 dark:shadow-none">
          <div className="flex gap-2 overflow-x-auto rounded-xl bg-slate-100/70 p-1 dark:bg-black/20">
            {departmentGroups.map((department) => (
              <button
                key={departmentKey(department)}
                type="button"
                onClick={() => {
                  const nextDepartment = departmentKey(department);
                  if (nextDepartment !== activeDepartment) setActiveDepartment(nextDepartment);
                }}
                disabled={isDepartmentLoading && activeDepartment === departmentKey(department)}
                className={cn(
                  "flex min-w-[74px] items-center justify-center rounded-lg px-3 py-2 text-center transition",
                  selectedDepartment && departmentKey(selectedDepartment) === departmentKey(department)
                    ? "bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950"
                    : "text-slate-500 hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                )}
                title={`${department.department} - Current ${formatNumber(department.current)} / ${department.rows.length} Positions`}
              >
                <span className="text-sm font-black tracking-wide">{departmentSheetLabel(department)}</span>
              </button>
            ))}
          </div>
        </section>

        {isDepartmentLoading && (
          <div className="flex items-center gap-2 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm font-bold text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading Selected Department...
          </div>
        )}

        {selectedDepartment ? (
          <DepartmentSheetPanel department={selectedDepartment} onBudgetChange={setBudget} isLoading={isDepartmentLoading} />
        ) : (
          <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-semibold text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
            No Department Sheet Found.
          </section>
        )}
      </div>
    </main>
  );
}

function KpiCard({ icon: Icon, label, value, sub, tone }: { icon: any; label: string; value: string; sub?: string; tone: "blue" | "emerald" | "orange" | "red" | "slate" }) {
  const tones = {
    blue: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    orange: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    red: "bg-red-500/10 text-red-600 dark:text-red-400",
    slate: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm shadow-slate-200/70 transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:shadow-none">
      <div className="flex items-center gap-3">
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
          <p className="text-3xl font-black tracking-tight text-slate-950 dark:text-white">{value}</p>
          {sub && <p className="text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function groupRowsByDivisionSection(rows: HeadcountRow[], department: DepartmentGroup): DivisionSectionGroup[] {
  const map = new Map<string, DivisionSectionGroup>();

  rows.forEach((row) => {
    const key = buildRowKey([row.division, row.divisionCode, row.section, row.sectionCode]);
    const group = map.get(key) || {
      key,
      division: row.division,
      divisionCode: row.divisionCode,
      section: row.section,
      sectionCode: row.sectionCode,
      approved: 0,
      current: 0,
      vacancy: 0,
      over: 0,
      budgetPending: 0,
      rows: [],
    };

    group.current += row.current;
    group.approved += row.approved ?? 0;
    group.vacancy += row.vacancy;
    group.over += row.over;
    if (row.approved === null) group.budgetPending += 1;
    group.rows.push(row);
    map.set(key, group);
  });

  return Array.from(map.values())
    .map((group) => ({ ...group, rows: [...group.rows].sort(compareHeadcountRows) }))
    .sort((a, b) => compareDivisionSectionGroups(department, a, b));
}

function groupSectionsByDivision(sectionGroups: DivisionSectionGroup[], department: DepartmentGroup): DivisionGroup[] {
  const map = new Map<string, DivisionGroup>();

  sectionGroups.forEach((section) => {
    const key = buildRowKey([section.division, section.divisionCode]);
    const group = map.get(key) || {
      key,
      division: section.division,
      divisionCode: section.divisionCode,
      approved: 0,
      current: 0,
      vacancy: 0,
      over: 0,
      budgetPending: 0,
      sections: [],
    };

    group.approved += section.approved;
    group.current += section.current;
    group.vacancy += section.vacancy;
    group.over += section.over;
    group.budgetPending += section.budgetPending;
    group.sections.push(section);
    map.set(key, group);
  });

  return Array.from(map.values())
    .map((group) => ({ ...group, sections: [...group.sections].sort((a, b) => compareDivisionSectionGroups(department, a, b)) }))
    .sort((a, b) => compareDivisionSectionGroups(department, a.sections[0], b.sections[0]));
}

function DepartmentSheetPanel({ department, onBudgetChange, isLoading = false }: { department: DepartmentGroup; onBudgetChange: (key: string, value: string) => void; isLoading?: boolean }) {
  const utilization = department.approved ? Math.min((department.current / department.approved) * 100, 140) : 0;
  const sectionGroups = groupRowsByDivisionSection(department.rows, department);
  const divisionGroups = groupSectionsByDivision(sectionGroups, department);
  const visibleSectionCount = sectionGroups.filter((group) => !isUnassignedName(group.section)).length;
  const panelDepartmentKey = departmentKey(department);
  const [expandedDivisionKeys, setExpandedDivisionKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    setExpandedDivisionKeys(new Set(divisionGroups[0]?.key ? [divisionGroups[0].key] : []));
  }, [panelDepartmentKey, divisionGroups.length]);

  function toggleDivision(key: string) {
    setExpandedDivisionKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <article className={cn("overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-sm shadow-slate-200/70 transition-opacity dark:border-white/10 dark:bg-white/5 dark:shadow-none", isLoading && "opacity-60")}>
      <div className="flex w-full flex-col gap-3 border-b border-slate-100 p-5 text-left xl:flex-row xl:items-start xl:justify-between dark:border-white/10">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide text-sky-600 dark:text-sky-400">Selected Department</p>
          <h3 className="mt-1 text-2xl font-black leading-tight text-slate-950 dark:text-white">{formatNameWithCode(department.department, department.departmentCode)}</h3>
          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{divisionGroups.length} Divisions / {visibleSectionCount} Sections / {department.rows.length} Positions / {department.budgetPending} Budget Pending</p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 text-center sm:grid-cols-4 xl:w-auto xl:shrink-0">
          <MiniCount label="Budget" value={department.approved} />
          <MiniCount label="Current" value={department.current} />
          <MiniCount label="Vacancy" value={department.vacancy} tone="orange" />
          <MiniCount label="Over" value={department.over} tone="red" />
        </div>
      </div>

      <div className="px-5 py-3">
        <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
          <div className={cn("h-full rounded-full", department.over > 0 ? "bg-red-500" : "bg-emerald-500")} style={{ width: `${utilization}%` }} />
        </div>
      </div>

      <div className="space-y-5 px-5 pb-5">
        {divisionGroups.map((division) => {
          const isExpanded = expandedDivisionKeys.has(division.key);
          const isDepartmentLevel = isUnassignedName(division.division);
          const sectionCount = division.sections.filter((section) => !isUnassignedName(section.section)).length;
          const positionCount = division.sections.reduce((total, section) => total + section.rows.length, 0);
          const groupLabel = isDepartmentLevel ? "Department" : "Division";
          const groupName = isDepartmentLevel ? formatNameWithCode(department.department, department.departmentCode) : formatNameWithCode(division.division, division.divisionCode);
          const groupSummary = isDepartmentLevel ? `Department-Level Positions / ${positionCount} Positions` : `${sectionCount} Sections / ${positionCount} Positions`;

          return (
            <section key={division.key} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/60 dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
              <button
                type="button"
                onClick={() => toggleDivision(division.key)}
                className="flex w-full flex-col gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3 text-left transition hover:bg-sky-50/80 lg:flex-row lg:items-center lg:justify-between dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className={cn("mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-black transition", isExpanded ? "border-sky-300 bg-sky-100 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-300" : "border-slate-200 bg-white text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300")}>{isExpanded ? "-" : "+"}</span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-wide text-sky-600 dark:text-sky-400">{groupLabel}</p>
                    <h4 className="mt-0.5 text-base font-black text-slate-950 dark:text-white">{groupName}</h4>
                    <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">{groupSummary}</p>
                  </div>
                </div>
                <div className="grid w-full grid-cols-4 gap-2 text-center lg:w-auto lg:min-w-[360px]">
                  <MiniCount label="Budget" value={division.approved} />
                  <MiniCount label="Current" value={division.current} />
                  <MiniCount label="Vacancy" value={division.vacancy} tone="orange" />
                  <MiniCount label="Over" value={division.over} tone="red" />
                </div>
              </button>

              {isExpanded && (
                <div className="divide-y divide-slate-100 dark:divide-white/10">
                  {division.sections.map((section) => {
                    const isDivisionOnly = isUnassignedName(section.section);

                    return (
                      <div key={section.key} className="bg-white dark:bg-transparent">
                        {!isDivisionOnly && (
                          <div className="flex flex-col gap-3 bg-slate-50/60 px-4 py-3 lg:flex-row lg:items-center lg:justify-between dark:bg-white/[0.025]">
                            <div className="min-w-0">
                              <p className="text-[11px] font-black uppercase tracking-wide text-sky-600 dark:text-sky-400">Section</p>
                              <h5 className="mt-0.5 text-sm font-black text-slate-900 dark:text-slate-100">{formatNameWithCode(section.section, section.sectionCode)}</h5>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-center lg:w-auto lg:min-w-[320px]">
                              <MiniCount label="Budget" value={section.approved} />
                              <MiniCount label="Current" value={section.current} />
                              <MiniCount label="Vacancy" value={section.vacancy} tone="orange" />
                              <MiniCount label="Over" value={section.over} tone="red" />
                            </div>
                          </div>
                        )}

                        <div className="overflow-x-auto">
                          <div className="grid min-w-[780px] grid-cols-[minmax(260px,1fr)_96px_86px_86px_86px_126px] gap-2 border-b border-slate-100 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-wide text-slate-500 dark:border-white/10 dark:bg-transparent dark:text-slate-400">
                            <span>Position / Employment Type / Station</span>
                            <span className="text-right">Budget</span>
                            <span className="text-right">Current</span>
                            <span className="text-right">Vacancy</span>
                            <span className="text-right">Over</span>
                            <span>Status</span>
                          </div>
                          <div className="divide-y divide-slate-100 dark:divide-white/10">
                            {section.rows.map((row) => (
                              <PositionRow key={row.key} row={row} onBudgetChange={onBudgetChange} />
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </article>
  );
}

function PositionRow({ row, onBudgetChange }: { row: HeadcountRow; onBudgetChange: (key: string, value: string) => void }) {
  return (
    <div className="grid min-w-[780px] grid-cols-[minmax(260px,1fr)_96px_86px_86px_86px_126px] items-center gap-2 px-5 py-3 text-sm transition hover:bg-sky-50/60 dark:hover:bg-white/5">
      <div className="min-w-0">
        <p className="font-bold leading-tight text-slate-900 dark:text-slate-100">{row.position}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs leading-snug">
          <span className="text-slate-500 dark:text-slate-400">{row.employmentType}</span>
          {cleanValue(row.station, "") && (
            <span className="inline-flex items-center rounded-md border border-sky-100 bg-sky-50 px-2 py-0.5 text-[11px] font-black text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300">
              Station: {formatStationCode(row.station)}
            </span>
          )}
        </div>
      </div>
      <input
        type="number"
        min={0}
        value={row.approved ?? ""}
        onChange={(event) => onBudgetChange(row.key, event.target.value)}
        placeholder="-"
        className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-2 text-right font-bold outline-none transition focus:border-sky-300 focus:bg-white focus:ring-2 focus:ring-sky-100 dark:border-white/10 dark:bg-[#121212] dark:text-slate-100 dark:focus:ring-sky-500/20"
      />
      <span className="text-right font-black">{row.current}</span>
      <span className="text-right font-black text-orange-500">{row.vacancy}</span>
      <span className="text-right font-black text-red-500">{row.over}</span>
      <StatusPill status={row.status} />
    </div>
  );
}

function MiniCount({ label, value, tone = "slate" }: { label: string; value: number; tone?: "slate" | "orange" | "red" }) {
  const color = tone === "orange" ? "text-orange-500" : tone === "red" ? "text-red-500" : "text-slate-900 dark:text-slate-100";
  return (
    <div className="min-w-[74px] rounded-xl bg-slate-50 px-3 py-2 dark:bg-white/5">
      <p className="text-[10px] font-bold uppercase text-slate-400">{label}</p>
      <p className={cn("text-lg font-black", color)}>{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: HeadcountStatus }) {
  const styles = {
    "Budget Pending": "border-slate-200 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300",
    Vacancy: "border-orange-200 bg-orange-50 text-orange-600 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300",
    "Over Headcount": "border-red-200 bg-red-50 text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300",
    Full: "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300",
  };

  return <span className={cn("inline-flex h-7 items-center justify-center rounded-full border px-3 text-[11px] font-black", styles[status])}>{status}</span>;
}



