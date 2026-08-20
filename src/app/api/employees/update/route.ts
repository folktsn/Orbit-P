import { NextResponse } from 'next/server';
import { docClient } from '@/lib/dynamodb';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import path from 'path';
import { randomUUID } from 'crypto';
import { uploadAttachment, prefixForField } from '@/lib/s3';
import { buildEmployeeDocumentKey } from '@/lib/employeeDocumentStorage';
import { invalidateEmployeesCache } from '@/lib/employeesCache';

export const runtime = 'nodejs';

const EMPLOYEE_DOCUMENT_ATTACHMENT_FIELDS = [
  { id: 'resumeDocument', nameProp: 'resumeDocumentName', dataProp: 'resumeDocumentData', filesProp: 'resumeDocumentFiles', nameDb: 'resume_document_name', dataDb: 'resume_document_data', filesDb: 'resume_document_files' },
  { id: 'idCardCopyDocument', nameProp: 'idCardCopyDocumentName', dataProp: 'idCardCopyDocumentData', filesProp: 'idCardCopyDocumentFiles', nameDb: 'id_card_copy_document_name', dataDb: 'id_card_copy_document_data', filesDb: 'id_card_copy_document_files' },
  { id: 'houseRegistrationDocument', nameProp: 'houseRegistrationDocumentName', dataProp: 'houseRegistrationDocumentData', filesProp: 'houseRegistrationDocumentFiles', nameDb: 'house_registration_document_name', dataDb: 'house_registration_document_data', filesDb: 'house_registration_document_files' },
  { id: 'educationCertificateDocument', nameProp: 'educationCertificateDocumentName', dataProp: 'educationCertificateDocumentData', filesProp: 'educationCertificateDocumentFiles', nameDb: 'education_certificate_document_name', dataDb: 'education_certificate_document_data', filesDb: 'education_certificate_document_files' },
  { id: 'criminalRecordCheckDocument', nameProp: 'criminalRecordCheckDocumentName', dataProp: 'criminalRecordCheckDocumentData', filesProp: 'criminalRecordCheckDocumentFiles', nameDb: 'criminal_record_check_document_name', dataDb: 'criminal_record_check_document_data', filesDb: 'criminal_record_check_document_files' },
  { id: 'medicalCheckDocument', nameProp: 'medicalCheckDocumentName', dataProp: 'medicalCheckDocumentData', filesProp: 'medicalCheckDocumentFiles', nameDb: 'medical_check_document_name', dataDb: 'medical_check_document_data', filesDb: 'medical_check_document_files' },
  { id: 'militaryDocument', nameProp: 'militaryDocumentName', dataProp: 'militaryDocumentData', filesProp: 'militaryDocumentFiles', nameDb: 'military_document_name', dataDb: 'military_document_data', filesDb: 'military_document_files' },
  { id: 'nameChangeDocument', nameProp: 'nameChangeDocumentName', dataProp: 'nameChangeDocumentData', filesProp: 'nameChangeDocumentFiles', nameDb: 'name_change_document_name', dataDb: 'name_change_document_data', filesDb: 'name_change_document_files' },
  { id: 'employmentCertificateDocument', nameProp: 'employmentCertificateDocumentName', dataProp: 'employmentCertificateDocumentData', filesProp: 'employmentCertificateDocumentFiles', nameDb: 'employment_certificate_document_name', dataDb: 'employment_certificate_document_data', filesDb: 'employment_certificate_document_files' },
  { id: 'toeicScoreDocument', nameProp: 'toeicScoreDocumentName', dataProp: 'toeicScoreDocumentData', filesProp: 'toeicScoreDocumentFiles', nameDb: 'toeic_score_document_name', dataDb: 'toeic_score_document_data', filesDb: 'toeic_score_document_files' },
  { id: 'driverLicenseDocument', nameProp: 'driverLicenseDocumentName', dataProp: 'driverLicenseDocumentData', filesProp: 'driverLicenseDocumentFiles', nameDb: 'driver_license_document_name', dataDb: 'driver_license_document_data', filesDb: 'driver_license_document_files' },
  { id: 'bankBookDocument', nameProp: 'bankBookDocumentName', dataProp: 'bankBookDocumentData', filesProp: 'bankBookDocumentFiles', nameDb: 'bank_book_document_name', dataDb: 'bank_book_document_data', filesDb: 'bank_book_document_files' },
] as const;


function sanitizeFileName(fileName?: string) {
  const fallback = 'document.pdf';
  const baseName = path.basename(fileName || fallback);
  const sanitized = baseName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return sanitized || fallback;
}

function extensionFromMime(mimeType: string, fileName?: string) {
  const existingExtension = path.extname(fileName || '').toLowerCase();
  if (existingExtension) return existingExtension;

  if (mimeType === 'application/pdf') return '.pdf';
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/webp') return '.webp';

  return '.bin';
}

// Uploads a freshly-attached (base64 data URL) document to the private S3
// attachments bucket and returns its object key, which is what gets stored in
// DynamoDB. Values that are not new uploads (existing S3 keys, legacy paths,
// the "-" marker) are passed through untouched.
async function persistAttachmentFile(
  dataUrl?: string,
  fileName?: string,
  staffId?: string,
  fieldName?: string,
  employeeName?: string,
  documentId?: string
) {
  if (!dataUrl || dataUrl === '-' || !dataUrl.startsWith('data:')) {
    return dataUrl;
  }

  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return dataUrl;
  }

  const mimeType = match[1];
  const base64Data = match[2];
  const safeName = sanitizeFileName(fileName);
  const safeStaffId = sanitizeFileName(staffId || 'employee').replace(/\.[^.]+$/, '');
  const extension = extensionFromMime(mimeType, safeName);
  const fileStem = path.basename(safeName, path.extname(safeName));
  const storedFileName = `${Date.now()}-${randomUUID()}-${fileStem}${extension}`;

  // Probation evaluations -> evaluation/<staffId>/...  ; general -> attachments/<staffId>/...
  // e.g. evaluation/05456/1730000000000-<uuid>-05456.pdf
  const key = documentId
    ? buildEmployeeDocumentKey({ staffId: safeStaffId, employeeName, documentId, fileName: storedFileName })
    : `${prefixForField(fieldName)}${safeStaffId}/${storedFileName}`;

  await uploadAttachment({
    key,
    body: Buffer.from(base64Data, 'base64'),
    contentType: mimeType,
  });

  return key;
}


type AttachmentFileItem = { name?: string; data?: string; uploadedAt?: string };

async function persistAttachmentFiles(
  files: unknown,
  staffId?: string,
  fieldName?: string,
  employeeName?: string,
  documentId?: string
) {
  if (!Array.isArray(files)) return files;

  return Promise.all(files.map(async (file) => {
    if (!file || typeof file !== 'object') return file;
    const item = file as AttachmentFileItem;
    return {
      ...item,
      data: await persistAttachmentFile(item.data, item.name, staffId, fieldName, employeeName, documentId),
    };
  }));
}

export async function PUT(request: Request) {
  try {
    const data = await request.json();
    
    // id in our EmployeeData maps to staff_id or emp_code in DB.
    // The exact primary key schema is staff_id.
    const staffId = data.id;
    const employeeName = data.employeeName || data.name || [data.firstNameTh, data.lastNameTh].filter(Boolean).join(' ');
    
    if (!staffId) {
      return NextResponse.json({ error: "Missing employee ID" }, { status: 400 });
    }

    data.attachmentData = await persistAttachmentFile(
      data.attachmentData,
      data.attachmentName,
      staffId,
      'attachment'
    );
    if (Array.isArray(data.probationPassAttachmentFiles)) {
      data.probationPassAttachmentFiles = await persistAttachmentFiles(
        data.probationPassAttachmentFiles,
        staffId,
        'probation-evaluation',
        employeeName,
        'probationPassAttachment'
      );
      const latestProbationFile = data.probationPassAttachmentFiles[data.probationPassAttachmentFiles.length - 1];
      data.probationPassAttachmentName = latestProbationFile?.name || '';
      data.probationPassAttachmentData = latestProbationFile?.data || '';
    } else {
      data.probationPassAttachmentData = await persistAttachmentFile(
        data.probationPassAttachmentData,
        data.probationPassAttachmentName,
        staffId,
        'probation-evaluation',
        employeeName,
        'probationPassAttachment'
      );
    }

    for (const documentField of EMPLOYEE_DOCUMENT_ATTACHMENT_FIELDS) {
      if (Array.isArray(data[documentField.filesProp])) {
        data[documentField.filesProp] = await persistAttachmentFiles(
          data[documentField.filesProp],
          staffId,
          'attachment',
          employeeName,
          documentField.id
        );
        const latestFile = data[documentField.filesProp][data[documentField.filesProp].length - 1];
        data[documentField.nameProp] = latestFile?.name || '';
        data[documentField.dataProp] = latestFile?.data || '';
      } else {
        data[documentField.dataProp] = await persistAttachmentFile(
          data[documentField.dataProp],
          data[documentField.nameProp],
          staffId,
          'attachment',
          employeeName,
          documentField.id
        );
      }
    }

    if (data.probationOutcome === 'pass') {
      data.empType = 'Normal';
      data.status = 'Active';
    }

    // Parse title prefix
    let titleTh = "";
    let titleEn = "";
    if (data.titlePrefix && data.titlePrefix.includes(" / ")) {
      const parts = data.titlePrefix.split(" / ");
      titleTh = parts[0]?.trim() || "";
      titleEn = parts[1]?.trim() || "";
    }

    // Determine names without title prefix
    const nameThWithoutTitle = `${data.firstNameTh || ""} ${data.lastNameTh || ""}`.trim();
    const nameEnWithoutTitle = `${data.firstNameEn || ""} ${data.lastNameEn || ""}`.trim();

    // Determine department code from department name (e.g. "Department (CODE)")
    let deptCode = "";
    if (data.department && data.department.includes("(")) {
      const match = data.department.match(/\(([^)]+)\)/);
      if (match) {
        deptCode = match[1].trim();
      }
    }

    // Prepare update expression. Only write fields that were actually sent so
    // focused actions like Pass Probation do not wipe unrelated profile data.
    const updateFields: Record<string, any> = {};
    const setIfProvided = (dbKey: string, value: any) => {
      if (value !== undefined && value !== null) {
        updateFields[dbKey] = value;
      }
    };
    const setDocumentFieldsIfProvided = () => {
      setIfProvided('probation_pass_attachment_name', data.probationPassAttachmentName);
      setIfProvided('probation_pass_attachment_data', data.probationPassAttachmentData);
      setIfProvided('probation_pass_attachment_files', data.probationPassAttachmentFiles);
      setIfProvided('attachment_name', data.attachmentName);
      setIfProvided('attachment_data', data.attachmentData);

      for (const documentField of EMPLOYEE_DOCUMENT_ATTACHMENT_FIELDS) {
        setIfProvided(documentField.nameDb, data[documentField.nameProp]);
        setIfProvided(documentField.dataDb, data[documentField.dataProp]);
        setIfProvided(documentField.filesDb, data[documentField.filesProp]);
      }
    };

    if (data.updateScope === 'documents') {
      setDocumentFieldsIfProvided();
    } else {
    if (data.titlePrefix !== undefined) {
      setIfProvided('title_th', titleTh);
      setIfProvided('title_en', titleEn);
    }

    setIfProvided('first_name_th', data.firstNameTh);
    setIfProvided('last_name_th', data.lastNameTh);
    setIfProvided('first_name_en', data.firstNameEn);
    setIfProvided('last_name_en', data.lastNameEn);
    setIfProvided('name_th', nameThWithoutTitle || data.name);
    setIfProvided('name_en', nameEnWithoutTitle || data.nameEn);
    setIfProvided('name', nameEnWithoutTitle || data.nameEn || data.name);
    if (deptCode) setIfProvided('dept_code', deptCode);
    setIfProvided('position', data.title);
    setIfProvided('department', data.department);
    setIfProvided('station', data.station);
    setIfProvided('division', data.division);
    setIfProvided('section', data.section);
    setIfProvided('unit', data.unit);
    setIfProvided('supervisor', data.supervisor);
    setIfProvided('start_date', data.contractStart);
    setIfProvided('contract_end', data.contractEnd);
    setIfProvided('probation_end_date', data.probationEnd);
    setIfProvided('emp_type', data.empType);
    setIfProvided('status', data.status);
    setIfProvided('resign_date', data.resignDate || data.lastWorkingDate);
    setIfProvided('probation_outcome', data.probationOutcome);
    setIfProvided('last_working_date', data.lastWorkingDate);
    setIfProvided('probation_extension_days', data.probationExtensionDays);
    setIfProvided('gender', data.gender);
    setIfProvided('nationality', data.nationality);
    setIfProvided('id_card', data.idCard);
    setIfProvided('birth_date', data.birthDate);
    setIfProvided('nickname', data.nickname);
    setIfProvided('email', data.email);
    setIfProvided('phone', data.phone);
    setIfProvided('address', data.address);
    setIfProvided('emergency_contact', data.emergencyContact);
    setIfProvided('education', data.education);
    setIfProvided('work_history', data.workHistory);
    setIfProvided('emergency_contact_name', data.emergencyContactName);
    setIfProvided('emergency_contact_relation', data.emergencyContactRelation);
    setIfProvided('emergency_contact_phone', data.emergencyContactPhone);
    setIfProvided('probation_pass_operator_id', data.probationPassOperatorId);
    setIfProvided('probation_pass_operator_name', data.probationPassOperatorName);
    setIfProvided('probation_pass_operator_position', data.probationPassOperatorPosition);
    setIfProvided('probation_pass_date', data.probationPassDate);
    setIfProvided('probation_pass_attachment_name', data.probationPassAttachmentName);
    setIfProvided('probation_pass_attachment_data', data.probationPassAttachmentData);
    setIfProvided('bank_account_no', data.bankAccount);
    setIfProvided('line_user_id', data.lineUserId);
    setIfProvided('line_avatar_url', data.lineAvatarUrl);
    setIfProvided('attachment_name', data.attachmentName);
    setIfProvided('attachment_data', data.attachmentData);

    setDocumentFieldsIfProvided();
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ error: "No employee fields to update." }, { status: 400 });
    }

    let updateExpression = "set";
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    let index = 0;
    for (const [dbKey, value] of Object.entries(updateFields)) {
      const finalValue = value === "" ? "-" : value;
      
      const attributeKey = `#attr${index}`;
      const valueKey = `:val${index}`;
      
      expressionAttributeNames[attributeKey] = dbKey;
      expressionAttributeValues[valueKey] = finalValue;
      
      updateExpression += ` ${attributeKey} = ${valueKey},`;
      index++;
    }

    // Remove trailing comma
    updateExpression = updateExpression.slice(0, -1);

    const command = new UpdateCommand({
      TableName: "fullstaff",
      Key: {
        staff_id: staffId
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW"
    });

    const response = await docClient.send(command);
    invalidateEmployeesCache();

    return NextResponse.json({ success: true, updatedItem: response.Attributes }, { status: 200 });

  } catch (error: any) {
    console.error("Error updating employee:", error);
    return NextResponse.json(
      { error: "Failed to update employee.", details: error.message }, 
      { status: 500 }
    );
  }
}
