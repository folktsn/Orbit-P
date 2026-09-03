import { NextRequest, NextResponse } from 'next/server';
import { docClient } from '@/lib/dynamodb';
import { GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { getCachedEmployeeValue, getCachedEmployees, setCachedEmployeeValue, setCachedEmployees } from '@/lib/employeesCache';
import { authorizeRequest } from '@/lib/auth-session';

export const runtime = 'nodejs';

const EMPLOYEE_DETAIL_FIELDS = [
  'emp_code', 'staff_id', 'employeeId', 'id', 'pk',
  'title_th', 'title_en', 'first_name_th', 'last_name_th', 'first_name_en', 'last_name_en',
  'name_th', 'name_en', 'name',
  'position_th', 'position_en', 'position', 'title', 'level',
  'department_th', 'department_en', 'department', 'department_code', 'dept_code',
  'division_th', 'division_en', 'division', 'div_code',
  'section_th', 'section_en', 'section', 'sec_code',
  'unit_th', 'unit_en', 'unit', 'unit_code',
  'station_th', 'station_en', 'station', 'group_name', 'work_location',
  'supervisor', 'status', 'emp_type', 'start_date', 'hire_date', 'contractStart', 'contractEnd', 'contract_end',
  'probation_end_date', 'probation_end', 'probation_days', 'probation_day', 'probation_period_days', 'probation_duration_days', 'probation_total_days', 'prob_days', 'prob_period', 'resign_date', 'last_working_date', 'probation_outcome', 'probation_extension_days',
  'probation_pass_operator_id', 'probation_pass_operator_name', 'probation_pass_operator_position',
  'probation_pass_date', 'probation_pass_attachment_name', 'probation_pass_attachment_data', 'probation_pass_attachment_files',
  'gender', 'nationality', 'id_card', 'email', 'phone', 'address',
  'emergency_contact', 'emergency_contact_name', 'emergency_contact_relation', 'emergency_contact_phone',
  'emergency_name', 'emergency_relation', 'emergency_phone',
  'contact_person', 'contact_relation', 'contact_phone',
  'education', 'work_history',
  'bank_account_no', 'bank_account', 'bank_name', 'bank_branch',
  'payment_type', 'schedule_type', 'age', 'service_years', 'service_months', 'service_days', 'total_service_years', 'total_service_days',
  'start_year', 'start_month', 'start_day', 'apv_code', 'grade', 'job_grade_level', 'user_type',
  'nickname', 'religion', 'house_no', 'moo', 'village', 'condo', 'road', 'soi', 'sub_district', 'district', 'province', 'zip_code',
  'resign_type', 'resign_status', 'resign_request_id', 'separation_type', 'separation_date', 'last_work_date',
  'verify_submitted_at', 'verify_acknowledged_at', 'verify_acknowledged_by', 'verify_edit_reason',
  'created_at', 'created_by', 'restored_at', 'restored_by',
  'line_user_id', 'line_avatar_url', 'attachment_name', 'attachment_data',
  'resume_document_name', 'resume_document_data', 'resume_document_files',
  'id_card_copy_document_name', 'id_card_copy_document_data', 'id_card_copy_document_files',
  'house_registration_document_name', 'house_registration_document_data', 'house_registration_document_files',
  'education_certificate_document_name', 'education_certificate_document_data', 'education_certificate_document_files',
  'criminal_record_check_document_name', 'criminal_record_check_document_data', 'criminal_record_check_document_files',
  'medical_check_document_name', 'medical_check_document_data', 'medical_check_document_files',
  'military_document_name', 'military_document_data', 'military_document_files',
  'name_change_document_name', 'name_change_document_data', 'name_change_document_files',
  'employment_certificate_document_name', 'employment_certificate_document_data', 'employment_certificate_document_files',
  'toeic_score_document_name', 'toeic_score_document_data', 'toeic_score_document_files',
  'driver_license_document_name', 'driver_license_document_data', 'driver_license_document_files',
  'bank_book_document_name', 'bank_book_document_data', 'bank_book_document_files',
  'birth_date', 'user_code', 'User_Code', 'updated_at', 'updated_by',
] as const;

const EMPLOYEE_LIST_FIELDS = [
  'emp_code', 'staff_id', 'employeeId', 'id',
  'title_th', 'title_en', 'name_th', 'name_en', 'name',
  'position_th', 'position_en', 'position', 'title',
  'department_th', 'department_en', 'department', 'department_code', 'dept_code',
  'division_th', 'division_en', 'division',
  'section_th', 'section_en', 'section',
  'unit_th', 'unit_en', 'unit',
  'station_th', 'station_en', 'station', 'work_location',
  'supervisor', 'status', 'emp_type', 'start_date', 'hire_date', 'contractStart', 'contractEnd', 'contract_end',
  'probation_end_date', 'probation_end', 'probation_days', 'probation_day', 'probation_period_days', 'probation_duration_days', 'probation_total_days', 'prob_days', 'prob_period', 'resign_date', 'last_working_date', 'probation_outcome', 'probation_extension_days',
  'birth_date', 'age', 'id_card', 'phone',
  'emergency_contact', 'emergency_contact_name', 'emergency_contact_relation', 'emergency_contact_phone',
  'emergency_name', 'emergency_relation', 'emergency_phone',
  'contact_person', 'contact_relation', 'contact_phone',
] as const;

const EMPLOYEE_DIRECTORY_FIELDS = [
  'staff_id', 'emp_code', 'title_th', 'title_en', 'first_name_th', 'last_name_th',
  'first_name_en', 'last_name_en', 'name_th', 'name_en', 'name', 'position_th', 'position_en', 'position',
] as const;

function compactEmployeeRecord(item: Record<string, unknown>, fields: readonly string[]) {
  return fields.reduce((record, field) => {
    if (item[field] !== undefined) {
      record[field] = item[field];
    }
    return record;
  }, {} as Record<string, unknown>);
}

function buildProjection(fields: readonly string[]) {
  const expressionAttributeNames: Record<string, string> = {};
  const projectionExpression = fields.map((field, index) => {
    const key = `#f${index}`;
    expressionAttributeNames[key] = field;
    return key;
  }).join(', ');

  return { ProjectionExpression: projectionExpression, ExpressionAttributeNames: expressionAttributeNames };
}

async function scanEmployees(fields: readonly string[]) {
  let allItems: Record<string, unknown>[] = [];
  let lastEvaluatedKey: Record<string, any> | undefined = undefined;
  const projection = buildProjection(fields);

  do {
    const command: any = new ScanCommand({
      TableName: 'fullstaff',
      ExclusiveStartKey: lastEvaluatedKey,
      ...projection,
    });

    const response: any = await docClient.send(command);
    if (response.Items) {
      allItems = allItems.concat(response.Items);
    }
    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return allItems.map((item) => compactEmployeeRecord(item, fields));
}

async function getEmployeeById(staffId: string) {
  const cached = getCachedEmployeeValue<Record<string, unknown>>(`detail:${staffId}`);
  if (cached) return { item: cached, cache: 'HIT' };

  const command = new GetCommand({
    TableName: 'fullstaff',
    Key: { staff_id: staffId },
    ...buildProjection(EMPLOYEE_DETAIL_FIELDS),
  });

  const response = await docClient.send(command);
  if (!response.Item) return { item: null, cache: 'MISS' };

  const item = compactEmployeeRecord(response.Item as Record<string, unknown>, EMPLOYEE_DETAIL_FIELDS);
  setCachedEmployeeValue(`detail:${staffId}`, item);
  return { item, cache: 'MISS' };
}

export async function GET(request: NextRequest) {
  const authorization = await authorizeRequest(request, 'view');
  if (!authorization.ok) return authorization.response;

  try {
    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get('id')?.trim();

    if (!staffId && searchParams.get('view') === 'directory') {
      const cacheKey = 'list:operator-directory';
      let items = getCachedEmployees(cacheKey);
      if (!items) {
        items = await scanEmployees(EMPLOYEE_DIRECTORY_FIELDS);
        setCachedEmployees(items, cacheKey);
      }
      return NextResponse.json(items, { headers: { 'Cache-Control': 'private, no-store' } });
    }

    if (staffId) {
      const { item, cache } = await getEmployeeById(staffId);
      if (!item) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      }
      return NextResponse.json(item, {
        status: 200,
        headers: {
          'Cache-Control': 'private, no-store',
          'X-Employees-Cache': cache,
          'X-Employees-View': 'detail',
        },
      });
    }

    const listCacheKey = 'list:compact';
    const cachedItems = getCachedEmployees(listCacheKey);
    if (cachedItems) {
      return NextResponse.json(cachedItems, {
        status: 200,
        headers: {
          'Cache-Control': 'private, no-store',
          'X-Employees-Cache': 'HIT',
          'X-Employees-View': 'list',
        },
      });
    }

    const compactItems = await scanEmployees(EMPLOYEE_LIST_FIELDS);
    setCachedEmployees(compactItems, listCacheKey);

    return NextResponse.json(compactItems, {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-store',
        'X-Employees-Cache': 'MISS',
        'X-Employees-View': 'list',
      },
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json({ error: 'Database connection failed. Please verify AWS credentials in .env file.' }, { status: 500 });
  }
}
