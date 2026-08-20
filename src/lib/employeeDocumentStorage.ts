import { HeadObjectCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { ATTACHMENTS_BUCKET, s3Client } from "@/lib/s3";

export const EMPLOYEE_DOCUMENT_ROOT_PREFIX = "Employees/";

export const EMPLOYEE_DOCUMENT_FOLDERS = [
  { id: "resumeDocument", folder: "01_Resume" },
  { id: "idCardCopyDocument", folder: "02_National_ID_Card" },
  { id: "houseRegistrationDocument", folder: "03_House_Registration" },
  { id: "educationCertificateDocument", folder: "04_Educational_Certificates" },
  { id: "criminalRecordCheckDocument", folder: "05_Criminal_Record_Check" },
  { id: "medicalCheckDocument", folder: "06_Pre-Employment_Medical_Examination" },
  { id: "militaryDocument", folder: "07_Military_Service_Documents" },
  { id: "nameChangeDocument", folder: "08_Name_Change_Documents" },
  { id: "employmentCertificateDocument", folder: "09_Employment_Certificates" },
  { id: "toeicScoreDocument", folder: "10_TOEIC_Certificate" },
  { id: "driverLicenseDocument", folder: "11_Drivers_License" },
  { id: "bankBookDocument", folder: "12_Bank_Account" },
  { id: "probationPassAttachment", folder: "13_Probation_Evaluation" },
] as const;

export type EmployeeDocumentFolderId = (typeof EMPLOYEE_DOCUMENT_FOLDERS)[number]["id"];

const DOCUMENT_FOLDER_BY_ID = new Map<string, string>(
  EMPLOYEE_DOCUMENT_FOLDERS.map((documentFolder) => [documentFolder.id, documentFolder.folder])
);

function cleanPathPart(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|#%{}^~[\]`]+/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function buildEmployeeFolderName(staffId: string, _employeeName?: string) {
  const safeStaffId = cleanPathPart(staffId) || "employee";
  return safeStaffId;
}

export function buildEmployeeFolderPrefix(staffId: string, employeeName?: string) {
  return `${EMPLOYEE_DOCUMENT_ROOT_PREFIX}${buildEmployeeFolderName(staffId, employeeName)}/`;
}

export function documentFolderForId(documentId?: string) {
  return DOCUMENT_FOLDER_BY_ID.get(documentId || "") || "Attachments";
}

export function buildEmployeeDocumentFolderPrefix(
  staffId: string,
  employeeName: string | undefined,
  documentId: string | undefined
) {
  return `${buildEmployeeFolderPrefix(staffId, employeeName)}${documentFolderForId(documentId)}/`;
}

export function buildEmployeeDocumentKey(params: {
  staffId: string;
  employeeName?: string;
  documentId?: string;
  fileName: string;
}) {
  return `${buildEmployeeDocumentFolderPrefix(
    params.staffId,
    params.employeeName,
    params.documentId
  )}${params.fileName}`;
}

async function prefixHasObjects(prefix: string) {
  const response = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: ATTACHMENTS_BUCKET,
      Prefix: prefix,
      MaxKeys: 1,
    })
  );
  return Boolean(response.Contents?.length);
}

async function objectExists(key: string) {
  try {
    await s3Client.send(
      new HeadObjectCommand({
        Bucket: ATTACHMENTS_BUCKET,
        Key: key,
      })
    );
    return true;
  } catch (error: any) {
    const statusCode = error?.$metadata?.httpStatusCode;
    if (statusCode === 404 || error?.name === "NotFound" || error?.Code === "NotFound") {
      return false;
    }
    throw error;
  }
}

async function ensureFolderMarker(prefix: string) {
  if (await prefixHasObjects(prefix)) {
    return { prefix, created: false };
  }

  if (await objectExists(prefix)) {
    return { prefix, created: false };
  }

  await s3Client.send(
    new PutObjectCommand({
      Bucket: ATTACHMENTS_BUCKET,
      Key: prefix,
      Body: Buffer.alloc(0),
      ContentType: "application/x-directory",
    })
  );

  return { prefix, created: true };
}

export async function ensureEmployeeDocumentStructure(staffId: string, employeeName?: string) {
  const employeePrefix = buildEmployeeFolderPrefix(staffId, employeeName);
  const results = [await ensureFolderMarker(employeePrefix)];

  for (const folder of EMPLOYEE_DOCUMENT_FOLDERS) {
    results.push(await ensureFolderMarker(`${employeePrefix}${folder.folder}/`));
  }

  return {
    staffId,
    employeeFolder: employeePrefix,
    createdCount: results.filter((result) => result.created).length,
    skippedCount: results.filter((result) => !result.created).length,
    folders: results,
  };
}
