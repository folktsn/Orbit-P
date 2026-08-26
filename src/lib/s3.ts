import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const REGION = process.env.AWS_REGION || "ap-southeast-7";

// Private bucket that stores all HR employee attachments (probation evaluation
// documents, general attachments, etc.). Objects are NEVER public — access is
// always through short-lived presigned URLs generated server-side.
export const ATTACHMENTS_BUCKET =
  process.env.S3_ATTACHMENTS_BUCKET || "pa-hr-attachments";

// Top-level S3 prefixes this app owns, keyed by attachment category.
export const ATTACHMENT_PREFIXES: Record<string, string> = {
  "probation-evaluation": "evaluation/",
  attachment: "attachments/",
  "employee-documents": "Employees/",
};

// The only prefixes the presign route will ever sign a URL for.
export const ALLOWED_ATTACHMENT_PREFIXES = Object.values(ATTACHMENT_PREFIXES);

// Resolve the S3 prefix for a given attachment category (defaults to general).
export function prefixForField(fieldName?: string): string {
  return ATTACHMENT_PREFIXES[fieldName || "attachment"] || ATTACHMENT_PREFIXES.attachment;
}

// True when an S3 key belongs to one of this app's own attachment prefixes.
export function isAllowedAttachmentKey(key: string): boolean {
  return ALLOWED_ATTACHMENT_PREFIXES.some((p) => key.startsWith(p));
}

// Use static env credentials only when both are provided; otherwise fall back to
// the AWS SDK default provider chain (EC2 instance role) — no long-lived keys.
const staticCreds =
  process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined;

const s3Client = new S3Client({
  region: REGION,
  ...(staticCreds ? { credentials: staticCreds } : {}),
});

/**
 * True when a stored attachment value is an S3 object key (as opposed to a
 * legacy inline data: URL, a legacy /uploads/ disk path, an absolute URL, or the
 * "-" empty marker).
 */
export function isS3Key(value?: string | null): value is string {
  if (!value || value === "-") return false;
  if (value.startsWith("data:")) return false;
  if (value.startsWith("/")) return false;
  if (/^https?:\/\//i.test(value)) return false;
  return true;
}

export async function uploadAttachment(params: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<string> {
  const { key, body, contentType } = params;
  await s3Client.send(
    new PutObjectCommand({
      Bucket: ATTACHMENTS_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return key;
}

export async function getAttachmentDownloadUrl(
  key: string,
  opts: {
    expiresIn?: number;
    disposition?: "inline" | "attachment";
    fileName?: string;
  } = {}
): Promise<string> {
  const { expiresIn = 300, disposition, fileName } = opts;

  const sanitizeAsciiFileName = (name: string) => {
    const asciiName = name.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "");
    return asciiName.trim() || "document";
  };

  const contentDisposition = disposition
    ? `${disposition}${
        fileName
          ? `; filename="${sanitizeAsciiFileName(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
          : ""
      }`
    : undefined;

  const command = new GetObjectCommand({
    Bucket: ATTACHMENTS_BUCKET,
    Key: key,
    ...(contentDisposition ? { ResponseContentDisposition: contentDisposition } : {}),
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

export { s3Client };
