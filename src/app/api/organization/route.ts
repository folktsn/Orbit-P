import { NextRequest, NextResponse } from 'next/server';
import { docClient } from '@/lib/dynamodb';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { authorizeRequest } from '@/lib/auth-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ORG_FIELDS = [
  'id',
  'department_en', 'department_th', 'department_code',
  'division_en', 'division_th', 'division_code',
  'section_en', 'section_th', 'section_code',
  'unit_en', 'unit_th', 'unit_code',
  'position_en', 'position_th', 'position_level',
  'station', 'active_count', 'active_names',
] as const;

function buildProjection(fields: readonly string[]) {
  const ExpressionAttributeNames: Record<string, string> = {};
  const ProjectionExpression = fields.map((field, index) => {
    const key = `#f${index}`;
    ExpressionAttributeNames[key] = field;
    return key;
  }).join(', ');

  return { ProjectionExpression, ExpressionAttributeNames };
}

async function scanOrganization(department?: string) {
  let allItems: any[] = [];
  let lastEvaluatedKey: Record<string, any> | undefined = undefined;
  const projection = buildProjection(ORG_FIELDS);
  const departmentFilter = department?.trim();

  do {
    const command: any = new ScanCommand({
      TableName: 'PA_OrgStructure',
      ExclusiveStartKey: lastEvaluatedKey,
      ...projection,
      ...(departmentFilter
        ? {
            FilterExpression: '#department_code = :department OR #department_en = :department OR #department_th = :department',
            ExpressionAttributeNames: {
              ...projection.ExpressionAttributeNames,
              '#department_code': 'department_code',
              '#department_en': 'department_en',
              '#department_th': 'department_th',
            },
            ExpressionAttributeValues: {
              ':department': departmentFilter,
            },
          }
        : {}),
    });

    const response: any = await docClient.send(command);
    if (response.Items) allItems = allItems.concat(response.Items);
    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return allItems;
}

function clean(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text || text === '-' || text.toLowerCase() === 'null' || text.toLowerCase() === 'undefined') return '';
  return text;
}

function summarizeDepartments(items: any[]) {
  const map = new Map<string, any>();

  items.forEach((item) => {
    const department = clean(item.department_en) || clean(item.department_th) || 'Unassigned Department';
    const departmentCode = clean(item.department_code);
    const key = departmentCode || department;
    const group = map.get(key) || {
      department,
      departmentCode,
      current: 0,
      positions: 0,
    };

    group.current += Number(item.active_count ?? 0) || 0;
    group.positions += 1;
    map.set(key, group);
  });

  return Array.from(map.values()).sort((a, b) => (b.current || 0) - (a.current || 0));
}

export async function GET(request: NextRequest) {
  const authorization = await authorizeRequest(request, 'view');
  if (!authorization.ok) return authorization.response;

  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view');
    const department = searchParams.get('department') || undefined;
    const allItems = await scanOrganization(department);
    const data = view === 'departments' ? summarizeDepartments(allItems) : allItems;

    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error("Error fetching organization structure:", error);
    return NextResponse.json({ error: "Failed to fetch organization structure." }, { status: 500 });
  }
}
