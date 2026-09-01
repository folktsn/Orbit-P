import { NextRequest, NextResponse } from "next/server";
import { ScanCommand, type ScanCommandInput } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/dynamodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RawRecord = Record<string, unknown>;
type Severity = "critical" | "warning" | "info";
type Category = "duplicate" | "missing" | "date" | "organization";

type EmployeeReference = {
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

type QualityIssue = {
  id: string;
  severity: Severity;
  category: Category;
  title: string;
  description: string;
  fields: string[];
  employee: EmployeeReference;
  relatedEmployeeIds?: string[];
};

const EMPLOYEE_FIELDS = [
  "emp_code", "staff_id", "employeeId", "id",
  "name_th", "name_en", "name", "first_name_th", "last_name_th", "first_name_en", "last_name_en",
  "status", "resign_status", "emp_type",
  "position_th", "position_en", "position", "title",
  "department_th", "department_en", "department", "department_code", "dept_code",
  "division_th", "division_en", "division", "division_code", "div_code",
  "section_th", "section_en", "section", "section_code", "sec_code",
  "unit_th", "unit_en", "unit", "unit_code",
  "station_th", "station_en", "station", "work_location",
  "birth_date", "age", "id_card", "phone", "email", "address",
  "emergency_contact", "emergency_contact_name", "emergency_contact_relation", "emergency_contact_phone",
  "emergency_name", "emergency_relation", "emergency_phone",
  "contact_person", "contact_relation", "contact_phone",
  "start_date", "hire_date", "contractStart",
  "probation_end_date", "probation_end",
  "resign_date", "last_working_date", "last_work_date", "separation_date",
] as const;

const ORGANIZATION_FIELDS = [
  "department_en", "department_th", "department_code",
  "division_en", "division_th", "division_code",
  "section_en", "section_th", "section_code",
  "position_en", "position_th",
] as const;

const CACHE_TTL_MS = 5 * 60_000;
const QUALITY_CACHE_KEY = "__s_recruit_data_quality_cache__";

type QualityCache = {
  value: unknown;
  expiresAt: number;
};

const globalWithQualityCache = globalThis as typeof globalThis & {
  [QUALITY_CACHE_KEY]?: QualityCache;
};

function clean(value: unknown) {
  const text = String(value ?? "").normalize("NFKC").trim();
  const normalized = text.toLowerCase();
  if (!text || text === "-" || normalized === "null" || normalized === "undefined" || normalized === "n/a") return "";
  return text.replace(/\s+/g, " ");
}

function pick(item: RawRecord, ...fields: string[]) {
  for (const field of fields) {
    const value = clean(item[field]);
    if (value) return value;
  }
  return "";
}

function normalize(value: unknown) {
  return clean(value)
    .toLowerCase()
    .replace(/[()[\]{}.,_/\\\-–—]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(value: unknown) {
  return normalize(value)
    .replace(/^(mr|mrs|miss|ms|dr|นาย|นางสาว|นาง|น\.ส\.|ดร)\.?\s+/i, "")
    .replace(/\s+/g, "")
    .trim();
}

function employeeId(item: RawRecord) {
  return pick(item, "emp_code", "staff_id", "employeeId", "id") || "UNKNOWN";
}

function fullName(item: RawRecord, language: "th" | "en") {
  const explicit = language === "th" ? pick(item, "name_th") : pick(item, "name_en", "name");
  if (explicit) return explicit;
  const firstName = pick(item, language === "th" ? "first_name_th" : "first_name_en");
  const lastName = pick(item, language === "th" ? "last_name_th" : "last_name_en");
  return [firstName, lastName].filter(Boolean).join(" ");
}

function employeeReference(item: RawRecord): EmployeeReference {
  return {
    id: employeeId(item),
    nameTh: fullName(item, "th"),
    nameEn: fullName(item, "en"),
    status: pick(item, "status", "resign_status"),
    position: pick(item, "position_en", "position_th", "position", "title"),
    department: pick(item, "department_en", "department_th", "department"),
    division: pick(item, "division_en", "division_th", "division"),
    section: pick(item, "section_en", "section_th", "section"),
    station: pick(item, "station", "station_en", "station_th", "work_location"),
  };
}

function buildProjection(fields: readonly string[]) {
  const ExpressionAttributeNames: Record<string, string> = {};
  const ProjectionExpression = fields.map((field, index) => {
    const key = `#f${index}`;
    ExpressionAttributeNames[key] = field;
    return key;
  }).join(", ");
  return { ProjectionExpression, ExpressionAttributeNames };
}

async function scanTable(tableName: string, fields: readonly string[]) {
  const items: RawRecord[] = [];
  let ExclusiveStartKey: ScanCommandInput["ExclusiveStartKey"];
  const projection = buildProjection(fields);

  do {
    const response = await docClient.send(new ScanCommand({
      TableName: tableName,
      ExclusiveStartKey,
      ...projection,
    }));
    items.push(...((response.Items ?? []) as RawRecord[]));
    ExclusiveStartKey = response.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  return items;
}

function parseDateOnly(value: unknown): string | null {
  const text = clean(value);
  if (!text) return null;

  let year: number;
  let month: number;
  let day: number;
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const slash = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  const compact = text.match(/^(\d{4})(\d{2})(\d{2})$/);

  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else if (slash) {
    day = Number(slash[1]);
    month = Number(slash[2]);
    year = Number(slash[3]);
  } else if (compact) {
    year = Number(compact[1]);
    month = Number(compact[2]);
    day = Number(compact[3]);
  } else {
    return null;
  }

  if (year > 2400) year -= 543;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function bangkokToday() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function isSeparatedStatus(status: string) {
  return status.includes("resign") || status.includes("ลาออก") || status.includes("terminate") || status.includes("retire");
}

function separationDate(item: RawRecord, status: string) {
  const resignDate = parseDateOnly(item.resign_date);
  const lastWorkDate = parseDateOnly(pick(item, "last_working_date", "last_work_date", "separation_date"));
  return isSeparatedStatus(status) ? resignDate || lastWorkDate : lastWorkDate || resignDate;
}

function isCurrentlyWorking(item: RawRecord, today: string) {
  const status = normalize(pick(item, "status", "resign_status"));
  const effectiveDate = separationDate(item, status);
  if (effectiveDate) return effectiveDate > today;
  if (isSeparatedStatus(status)) return false;
  return status === "active";
}

function makeIssue(
  item: RawRecord,
  severity: Severity,
  category: Category,
  code: string,
  title: string,
  description: string,
  fields: string[],
  relatedEmployeeIds?: string[],
): QualityIssue {
  const id = employeeId(item);
  return {
    id: `${category}:${code}:${id}:${relatedEmployeeIds?.join("-") || "single"}`,
    severity,
    category,
    title,
    description,
    fields,
    employee: employeeReference(item),
    ...(relatedEmployeeIds?.length ? { relatedEmployeeIds } : {}),
  };
}

function organizationIndexes(items: RawRecord[]) {
  const departments = new Set<string>();
  const positionsByDepartment = new Set<string>();

  for (const item of items) {
    const departmentTokens = [item.department_code, item.department_en, item.department_th].map(normalize).filter(Boolean);
    const positionTokens = [item.position_en, item.position_th].map(normalize).filter(Boolean);
    departmentTokens.forEach((department) => {
      departments.add(department);
      positionTokens.forEach((position) => positionsByDepartment.add(`${department}||${position}`));
    });
  }

  return { departments, positionsByDepartment };
}

function analyze(employees: RawRecord[], organization: RawRecord[]) {
  const today = bangkokToday();
  const currentEmployees = employees.filter((item) => isCurrentlyWorking(item, today));
  const currentIds = new Set(currentEmployees.map(employeeId));
  const issues: QualityIssue[] = [];
  const org = organizationIndexes(organization);

  for (const item of currentEmployees) {
    const id = employeeId(item);
    const nameTh = fullName(item, "th");
    const nameEn = fullName(item, "en");
    const birthRaw = pick(item, "birth_date");
    const birthDate = parseDateOnly(birthRaw);
    const startRaw = pick(item, "start_date", "hire_date", "contractStart");
    const startDate = parseDateOnly(startRaw);
    const probationRaw = pick(item, "probation_end_date", "probation_end");
    const probationDate = parseDateOnly(probationRaw);
    const status = normalize(pick(item, "status", "resign_status"));
    const endDate = separationDate(item, status);
    const position = pick(item, "position_en", "position_th", "position", "title");
    const departmentTokens = [item.department_code, item.dept_code, item.department_en, item.department_th, item.department]
      .map(normalize)
      .filter(Boolean);
    const positionTokens = [item.position_en, item.position_th, item.position, item.title].map(normalize).filter(Boolean);

    if (id === "UNKNOWN") {
      issues.push(makeIssue(item, "critical", "missing", "employee-id", "ไม่พบรหัสพนักงาน", "รายการนี้ไม่มีรหัสพนักงานที่ใช้อ้างอิง", ["emp_code", "staff_id"]));
    }
    if (!nameTh && !nameEn) {
      issues.push(makeIssue(item, "critical", "missing", "name", "ไม่พบชื่อพนักงาน", "ไม่มีทั้งชื่อภาษาไทยและภาษาอังกฤษ", ["name_th", "name_en"]));
    } else if (!nameTh || !nameEn) {
      issues.push(makeIssue(item, "warning", "missing", "name-language", "ชื่อพนักงานไม่ครบสองภาษา", !nameTh ? "ไม่พบชื่อภาษาไทย" : "ไม่พบชื่อภาษาอังกฤษ", [!nameTh ? "name_th" : "name_en"]));
    }
    if (!birthRaw) {
      issues.push(makeIssue(item, "warning", "missing", "birth-date", "ไม่พบวันเกิด", "ไม่สามารถคำนวณอายุและแผนเกษียณได้", ["birth_date"]));
    } else if (!birthDate) {
      issues.push(makeIssue(item, "critical", "date", "invalid-birth-date", "รูปแบบวันเกิดไม่ถูกต้อง", `ค่าปัจจุบัน: ${birthRaw}`, ["birth_date"]));
    } else {
      const birthYear = Number(birthDate.slice(0, 4));
      const currentYear = Number(today.slice(0, 4));
      const age = currentYear - birthYear;
      if (birthDate > today || age < 15 || age > 100) {
        issues.push(makeIssue(item, "critical", "date", "birth-date-range", "วันเกิดอยู่นอกช่วงที่สมเหตุสมผล", `วันเกิด ${birthDate} ทำให้อายุโดยประมาณ ${age} ปี`, ["birth_date"]));
      }
    }
    if (!position) {
      issues.push(makeIssue(item, "critical", "missing", "position", "ไม่พบตำแหน่งงาน", "พนักงานปัจจุบันต้องมีตำแหน่งงาน", ["position_en", "position_th"]));
    }
    if (!departmentTokens.length) {
      issues.push(makeIssue(item, "warning", "missing", "department", "ไม่พบฝ่ายของพนักงาน", "ไม่สามารถจัดพนักงานเข้าผังองค์กรและ Manpower ได้", ["department_en", "department_code"]));
    }
    if (!pick(item, "station", "station_en", "station_th", "work_location")) {
      issues.push(makeIssue(item, "info", "missing", "station", "ไม่พบ Station", "ควรระบุสถานที่ปฏิบัติงานเพื่อใช้ค้นหาและรายงาน", ["station"]));
    }
    if (!pick(item, "phone")) {
      issues.push(makeIssue(item, "info", "missing", "phone", "ไม่พบเบอร์โทรศัพท์", "ข้อมูลติดต่อของพนักงานยังไม่ครบ", ["phone"]));
    }
    if (!pick(item, "emergency_contact", "emergency_contact_name", "emergency_name", "contact_person")
      && !pick(item, "emergency_contact_phone", "emergency_phone", "contact_phone")) {
      issues.push(makeIssue(item, "info", "missing", "emergency", "ไม่พบผู้ติดต่อฉุกเฉิน", "ยังไม่มีชื่อหรือเบอร์โทรศัพท์ผู้ติดต่อฉุกเฉิน", ["emergency_contact_name", "emergency_contact_phone"]));
    }
    if (startRaw && !startDate) {
      issues.push(makeIssue(item, "critical", "date", "invalid-start-date", "รูปแบบวันเริ่มงานไม่ถูกต้อง", `ค่าปัจจุบัน: ${startRaw}`, ["start_date"]));
    }
    if (probationRaw && !probationDate) {
      issues.push(makeIssue(item, "warning", "date", "invalid-probation-date", "รูปแบบวันสิ้นสุดทดลองงานไม่ถูกต้อง", `ค่าปัจจุบัน: ${probationRaw}`, ["probation_end_date"]));
    }
    if (startDate && probationDate && probationDate < startDate) {
      issues.push(makeIssue(item, "critical", "date", "probation-before-start", "วันสิ้นสุดทดลองงานอยู่ก่อนวันเริ่มงาน", `${probationDate} อยู่ก่อน ${startDate}`, ["start_date", "probation_end_date"]));
    }
    if (startDate && endDate && endDate < startDate) {
      issues.push(makeIssue(item, "critical", "date", "separation-before-start", "วันสิ้นสุดการทำงานอยู่ก่อนวันเริ่มงาน", `${endDate} อยู่ก่อน ${startDate}`, ["start_date", "last_working_date"]));
    }

    if (departmentTokens.length) {
      const departmentExists = departmentTokens.some((token) => org.departments.has(token));
      if (!departmentExists) {
        issues.push(makeIssue(item, "warning", "organization", "department-not-found", "ไม่พบฝ่ายนี้ในผังองค์กร", `ฝ่าย ${employeeReference(item).department || "-"} ไม่มีรายการที่ตรงกันใน PA_OrgStructure`, ["department_en", "department_code"]));
      } else if (positionTokens.length) {
        const positionExists = departmentTokens.some((department) => positionTokens.some((positionToken) => org.positionsByDepartment.has(`${department}||${positionToken}`)));
        if (!positionExists) {
          issues.push(makeIssue(item, "warning", "organization", "position-not-found", "ไม่พบตำแหน่งนี้ในฝ่ายตามผังองค์กร", `${position} ยังไม่มีรายการที่ตรงกันภายในฝ่ายนี้`, ["position_en", "department_en"]));
        }
      }
    }
  }

  const identityGroups = new Map<string, RawRecord[]>();
  const personGroups = new Map<string, RawRecord[]>();
  for (const item of currentEmployees) {
    const identity = clean(item.id_card).replace(/\D/g, "");
    if (identity.length >= 10) identityGroups.set(identity, [...(identityGroups.get(identity) ?? []), item]);
    const name = normalizeName(fullName(item, "th") || fullName(item, "en"));
    const birth = parseDateOnly(item.birth_date);
    if (name && birth) personGroups.set(`${name}||${birth}`, [...(personGroups.get(`${name}||${birth}`) ?? []), item]);
  }

  const duplicateIdentityIds = new Set<string>();
  for (const group of identityGroups.values()) {
    if (group.length < 2) continue;
    const ids = group.map(employeeId);
    ids.forEach((id) => duplicateIdentityIds.add(id));
    for (const item of group) {
      issues.push(makeIssue(item, "critical", "duplicate", "id-card", "เลขบัตรประชาชนซ้ำ", `พบเลขบัตรเดียวกันในรหัส ${ids.join(", ")}`, ["id_card"], ids.filter((id) => id !== employeeId(item))));
    }
  }

  for (const group of personGroups.values()) {
    if (group.length < 2) continue;
    const ids = group.map(employeeId);
    if (ids.every((id) => duplicateIdentityIds.has(id))) continue;
    for (const item of group) {
      issues.push(makeIssue(item, "warning", "duplicate", "name-birth", "ชื่อและวันเกิดซ้ำ", `พบข้อมูลบุคคลเดียวกันในรหัส ${ids.join(", ")}`, ["name_th", "birth_date"], ids.filter((id) => id !== employeeId(item))));
    }
  }

  const severityCounts = { critical: 0, warning: 0, info: 0 };
  const categoryCounts = { duplicate: 0, missing: 0, date: 0, organization: 0 };
  const affectedIds = new Set<string>();
  issues.forEach((issue) => {
    severityCounts[issue.severity] += 1;
    categoryCounts[issue.category] += 1;
    affectedIds.add(issue.employee.id);
  });

  issues.sort((a, b) => {
    const severityRank: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
    return severityRank[a.severity] - severityRank[b.severity]
      || a.employee.id.localeCompare(b.employee.id, "en")
      || a.title.localeCompare(b.title, "th");
  });

  return {
    generatedAt: new Date().toISOString(),
    today,
    summary: {
      totalRecords: employees.length,
      currentRecords: currentEmployees.length,
      affectedEmployees: affectedIds.size,
      healthyEmployees: Math.max(0, currentEmployees.length - affectedIds.size),
      ...severityCounts,
      ...categoryCounts,
    },
    issues,
    metadata: {
      organizationRecords: organization.length,
      currentEmployeeIds: currentIds.size,
      rulesVersion: "1.0",
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const refresh = request.nextUrl.searchParams.get("refresh") === "1";
    const cached = globalWithQualityCache[QUALITY_CACHE_KEY];
    if (!refresh && cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(cached.value, {
        headers: { "Cache-Control": "private, max-age=60", "X-Data-Quality-Cache": "HIT" },
      });
    }

    const [employees, organization] = await Promise.all([
      scanTable("fullstaff", EMPLOYEE_FIELDS),
      scanTable("PA_OrgStructure", ORGANIZATION_FIELDS),
    ]);
    const result = analyze(employees, organization);
    globalWithQualityCache[QUALITY_CACHE_KEY] = { value: result, expiresAt: Date.now() + CACHE_TTL_MS };

    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, max-age=60", "X-Data-Quality-Cache": "MISS" },
    });
  } catch (error) {
    console.error("Error analyzing employee data quality:", error);
    return NextResponse.json({ error: "ไม่สามารถตรวจสอบคุณภาพข้อมูลได้" }, { status: 500 });
  }
}
