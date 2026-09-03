import { NextResponse } from 'next/server';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '@/lib/dynamodb';
import { ensureEmployeeDocumentStructure } from '@/lib/employeeDocumentStorage';
import { authorizeRequest } from '@/lib/auth-session';

export const runtime = 'nodejs';

type EmployeeFolderSyncItem = {
  staff_id?: string;
  emp_code?: string;
  name_th?: string;
  name?: string;
  first_name_th?: string;
  last_name_th?: string;
};

function pickEmployeeId(item: EmployeeFolderSyncItem) {
  return String(item.staff_id || item.emp_code || '').trim();
}

function pickEmployeeName(item: EmployeeFolderSyncItem) {
  const fullName = String(item.name_th || item.name || '').trim();
  if (fullName) return fullName;
  return [item.first_name_th, item.last_name_th]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' ');
}

async function scanEmployeeFolderCandidates() {
  const items: EmployeeFolderSyncItem[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const response: any = await docClient.send(
      new ScanCommand({
        TableName: 'fullstaff',
        ExclusiveStartKey: lastEvaluatedKey,
        ProjectionExpression: '#staffId, #empCode, #nameTh, #name, #firstNameTh, #lastNameTh',
        ExpressionAttributeNames: {
          '#staffId': 'staff_id',
          '#empCode': 'emp_code',
          '#nameTh': 'name_th',
          '#name': 'name',
          '#firstNameTh': 'first_name_th',
          '#lastNameTh': 'last_name_th',
        },
      })
    );

    if (response.Items) items.push(...response.Items);
    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return items;
}

export async function POST(request: Request) {
  const authorization = await authorizeRequest(request, 'edit');
  if (!authorization.ok) return authorization.response;

  try {
    const employees = await scanEmployeeFolderCandidates();
    const results = [];
    const errors = [];

    for (const employee of employees) {
      const staffId = pickEmployeeId(employee);
      if (!staffId) continue;

      try {
        results.push(await ensureEmployeeDocumentStructure(staffId, pickEmployeeName(employee)));
      } catch (error: any) {
        errors.push({
          staffId,
          message: error?.message || 'Failed to sync employee folder',
        });
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      totalEmployees: employees.length,
      syncedEmployees: results.length,
      failedEmployees: errors.length,
      createdFolders: results.reduce((sum, result) => sum + result.createdCount, 0),
      skippedFolders: results.reduce((sum, result) => sum + result.skippedCount, 0),
      errors,
    });
  } catch (error: any) {
    console.error('Error syncing employee document folders:', error);
    return NextResponse.json(
      { error: 'Failed to sync employee document folders.', details: error?.message },
      { status: 500 }
    );
  }
}
