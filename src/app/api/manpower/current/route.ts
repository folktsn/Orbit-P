import { NextRequest, NextResponse } from 'next/server';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '@/lib/dynamodb';
import { getCachedEmployeeValue, setCachedEmployeeValue } from '@/lib/employeesCache';
import { authorizeRequest } from '@/lib/auth-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CURRENT_FIELDS = [
  'emp_code', 'staff_id',
  'status', 'resign_status', 'resign_date', 'last_working_date', 'last_work_date', 'separation_date', 'separation_type',
  'department_en', 'department_th', 'department', 'department_code', 'dept_code',
  'division_en', 'division_th', 'division',
  'section_en', 'section_th', 'section',
  'unit_en', 'unit_th', 'unit', 'unit_code',
  'position_en', 'position_th', 'position',
  'station', 'work_location', 'emp_type',
] as const;

type EmployeeRecord = Record<string, unknown>;

const EXCLUDED_MANPOWER_TERMS = ['INTERNSHIP', 'EXCLUSIVE', 'HDQ', 'UNA', '\u0e1e\u0e34\u0e40\u0e28\u0e29'];

type CurrentCountRow = {
  key: string;
  current: number;
};

function buildProjection(fields: readonly string[]) {
  const ExpressionAttributeNames: Record<string, string> = {};
  const ProjectionExpression = fields.map((field, index) => {
    const key = `#f${index}`;
    ExpressionAttributeNames[key] = field;
    return key;
  }).join(', ');

  return { ProjectionExpression, ExpressionAttributeNames };
}

async function scanCurrentEmployees() {
  const cacheKey = 'manpower:current:employees';
  const cached = getCachedEmployeeValue<EmployeeRecord[]>(cacheKey);
  if (cached) return cached;

  let allItems: EmployeeRecord[] = [];
  let lastEvaluatedKey: Record<string, any> | undefined = undefined;
  const projection = buildProjection(CURRENT_FIELDS);

  do {
    const response: any = await docClient.send(new ScanCommand({
      TableName: 'fullstaff',
      ExclusiveStartKey: lastEvaluatedKey,
      ...projection,
    }));

    if (response.Items) allItems = allItems.concat(response.Items as EmployeeRecord[]);
    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  setCachedEmployeeValue(cacheKey, allItems);
  return allItems;
}

function clean(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text || text === '-' || text.toLowerCase() === 'null' || text.toLowerCase() === 'undefined') return '';
  return text;
}

function pick(item: EmployeeRecord, ...fields: string[]) {
  for (const field of fields) {
    const value = clean(item[field]);
    if (value) return value;
  }
  return '';
}

function normalize(value: unknown) {
  return clean(value).toLowerCase().replace(/\s+/g, ' ');
}

function parseDateOnly(value: unknown) {
  const text = clean(value);
  if (!text) return '';

  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return '';
}

function bangkokToday() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const getPart = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
}

function isSeparatedStatus(status: string) {
  return status === 'resign' || status === 'resigned' || status.includes('resign') || status.includes('\u0e25\u0e32\u0e2d\u0e2d\u0e01');
}

function resignationEffectiveDate(employee: EmployeeRecord, status: string) {
  const resignDate = parseDateOnly(employee.resign_date);
  const lastWorkDate = parseDateOnly(pick(employee, 'last_working_date', 'last_work_date', 'separation_date'));

  if (isSeparatedStatus(status)) return resignDate || lastWorkDate;
  return lastWorkDate || resignDate;
}

function isCurrentlyWorking(employee: EmployeeRecord, today: string) {
  const status = pick(employee, 'status', 'resign_status').toLowerCase();
  const effectiveDate = resignationEffectiveDate(employee, status);

  if (effectiveDate) return effectiveDate > today;
  if (isSeparatedStatus(status)) return false;

  if (status === 'active') return true;
  if (status === 'pending') return false;
  return false;
}

function departmentName(employee: EmployeeRecord) {
  return pick(employee, 'department_en', 'department_th', 'department') || 'Unassigned Department';
}

function departmentCode(employee: EmployeeRecord) {
  const explicitCode = pick(employee, 'department_code', 'dept_code');
  if (explicitCode) return explicitCode;

  const bracketCode = departmentName(employee).match(/^\[([A-Za-z0-9-]+)\]/)?.[1];
  return bracketCode?.trim() || '';
}

function positionName(employee: EmployeeRecord) {
  return pick(employee, 'position_en', 'position_th', 'position') || 'Unassigned Position';
}

function isExcludedManpowerEmployee(employee: EmployeeRecord) {
  const candidates = [
    departmentCode(employee),
    departmentName(employee),
    positionName(employee),
    pick(employee, 'emp_type'),
  ]
    .map((value) => clean(value).toUpperCase())
    .filter(Boolean);

  return candidates.some((value) => EXCLUDED_MANPOWER_TERMS.some((term) => value === term || value.includes(term)));
}

function buildCountKey(parts: Array<unknown>) {
  return parts.map(normalize).join('||');
}

function employeeCountKey(employee: EmployeeRecord) {
  return buildCountKey([
    departmentCode(employee),
    departmentName(employee),
    pick(employee, 'division_en', 'division_th', 'division') || 'Unassigned Division',
    pick(employee, 'section_en', 'section_th', 'section') || 'Unassigned Section',
    pick(employee, 'unit_en', 'unit_th', 'unit') || 'Unassigned Unit',
    pick(employee, 'station', 'work_location'),
    positionName(employee),
  ]);
}

function matchesDepartment(employee: EmployeeRecord, department: string) {
  const filter = normalize(department);
  if (!filter) return true;
  return [departmentCode(employee), departmentName(employee), pick(employee, 'department_th', 'department')]
    .map(normalize)
    .some((value) => value === filter || value.startsWith(`[${filter}]`));
}

function summarizeDepartments(employees: EmployeeRecord[], today: string) {
  const map = new Map<string, { department: string; departmentCode: string; current: number }>();

  employees.forEach((employee) => {
    if (isExcludedManpowerEmployee(employee)) return;
    if (!isCurrentlyWorking(employee, today)) return;
    const name = departmentName(employee);
    const code = departmentCode(employee);
    const key = code || name;
    const group = map.get(key) || { department: name, departmentCode: code, current: 0 };
    group.current += 1;
    map.set(key, group);
  });

  return Array.from(map.values()).sort((a, b) => (b.current || 0) - (a.current || 0));
}

function countDepartmentRows(employees: EmployeeRecord[], department: string, today: string) {
  const map = new Map<string, CurrentCountRow>();
  let total = 0;

  employees.forEach((employee) => {
    if (!matchesDepartment(employee, department)) return;
    if (isExcludedManpowerEmployee(employee)) return;
    if (!isCurrentlyWorking(employee, today)) return;

    const key = employeeCountKey(employee);
    const row = map.get(key) || { key, current: 0 };
    row.current += 1;
    total += 1;
    map.set(key, row);
  });

  return { total, rows: Array.from(map.values()) };
}

export async function GET(request: NextRequest) {
  const authorization = await authorizeRequest(request, 'view');
  if (!authorization.ok) return authorization.response;

  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view');
    const department = searchParams.get('department') || '';
    const today = bangkokToday();
    const employees = await scanCurrentEmployees();

    if (view === 'departments') {
      return NextResponse.json({ today, departments: summarizeDepartments(employees, today) }, {
        status: 200,
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }

    return NextResponse.json({ today, department, ...countDepartmentRows(employees, department, today) }, {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('Error calculating manpower current headcount:', error);
    return NextResponse.json({ error: 'Failed to calculate manpower current headcount.' }, { status: 500 });
  }
}
