/**
 * One-off migration: move existing employee attachments into the private S3
 * bucket (pa-hr-attachments) and rewrite the DynamoDB `fullstaff` records to
 * point at the new S3 object keys.
 *
 * Handles two legacy storage shapes:
 *   1. Inline base64 data URLs stored directly in DynamoDB.
 *   2. Local disk paths under /uploads/... (served from public/). These files
 *      only exist on the VPS, so RUN THIS SCRIPT ON THE VPS from the project
 *      root (so process.cwd()/public/uploads resolves).
 *
 * Fields migrated:
 *   attachment_data / attachment_name              -> employees/<id>/attachment/...
 *   probation_pass_attachment_data / ..._name      -> employees/<id>/probation-evaluation/...
 *
 * Usage (dry run by default — nothing is written):
 *   node scripts/migrate-attachments-to-s3.mjs
 * Apply for real:
 *   MIGRATE_APPLY=1 node scripts/migrate-attachments-to-s3.mjs
 *
 * Required env: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 * Optional env: S3_ATTACHMENTS_BUCKET (default pa-hr-attachments)
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const REGION = process.env.AWS_REGION || "ap-southeast-7";
const BUCKET = process.env.S3_ATTACHMENTS_BUCKET || "pa-hr-attachments";
const APPLY = process.env.MIGRATE_APPLY === "1";
const TABLE = "fullstaff";
// Top-level prefix per attachment category (kept out of the shared employees/ area)
const PREFIXES = { "probation-evaluation": "evaluation/", attachment: "attachments/" };

const creds = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
};

const docClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION, credentials: creds }),
  { marshallOptions: { removeUndefinedValues: true } }
);
const s3 = new S3Client({ region: REGION, credentials: creds });

const FIELDS = [
  { dataKey: "attachment_data", nameKey: "attachment_name", folder: "attachment" },
  {
    dataKey: "probation_pass_attachment_data",
    nameKey: "probation_pass_attachment_name",
    folder: "probation-evaluation",
  },
];

const MIME_BY_EXT = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const EXT_BY_MIME = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
};

function sanitize(name) {
  const base = path.basename(name || "document.pdf");
  return base.replace(/[^a-zA-Z0-9._-]/g, "_") || "document.pdf";
}

function isAlreadyMigratedOrExternal(value) {
  if (!value || value === "-") return true; // nothing to do
  if (value.startsWith("data:")) return false; // base64 -> migrate
  if (value.startsWith("/")) return false; // local disk path -> migrate
  if (/^https?:\/\//i.test(value)) return true; // external URL, leave
  return true; // already an S3 key
}

async function loadBytes(value) {
  // Returns { buffer, contentType, originalExt } for a base64 or /uploads value.
  if (value.startsWith("data:")) {
    const m = value.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) throw new Error("Unparseable data URL");
    const contentType = m[1];
    const buffer = Buffer.from(m[2], "base64");
    return { buffer, contentType, originalExt: EXT_BY_MIME[contentType] || ".bin" };
  }
  // Local disk path like /uploads/employee-documents/xyz.pdf
  const abs = path.join(process.cwd(), "public", value.replace(/^\/+/, ""));
  const buffer = await readFile(abs);
  const ext = path.extname(abs).toLowerCase();
  return {
    buffer,
    contentType: MIME_BY_EXT[ext] || "application/octet-stream",
    originalExt: ext || ".bin",
  };
}

function buildKey(staffId, folder, displayName, originalExt) {
  const prefix = PREFIXES[folder] || PREFIXES.attachment;
  const safeStaffId = sanitize(staffId).replace(/\.[^.]+$/, "");
  const safeName = sanitize(displayName);
  const ext = path.extname(safeName).toLowerCase() || originalExt || ".bin";
  const stem = path.basename(safeName, path.extname(safeName));
  return `${prefix}${safeStaffId}/${Date.now()}-${randomUUID()}-${stem}${ext}`;
}

async function scanAll() {
  const items = [];
  let ExclusiveStartKey;
  do {
    const res = await docClient.send(
      new ScanCommand({ TableName: TABLE, ExclusiveStartKey })
    );
    if (res.Items) items.push(...res.Items);
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

async function main() {
  console.log(
    `\nMigrating attachments -> s3://${BUCKET}/{${Object.values(PREFIXES).join(",")}} (region ${REGION})`
  );
  console.log(APPLY ? ">>> APPLY MODE: writing to S3 + DynamoDB\n" : ">>> DRY RUN (set MIGRATE_APPLY=1 to apply)\n");

  const items = await scanAll();
  console.log(`Scanned ${items.length} employees.\n`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of items) {
    const staffId = item.staff_id;
    if (!staffId) continue;

    const updates = {};

    for (const f of FIELDS) {
      const value = item[f.dataKey];
      if (isAlreadyMigratedOrExternal(value)) {
        continue;
      }

      const displayName = item[f.nameKey] && item[f.nameKey] !== "-" ? item[f.nameKey] : `${staffId}.pdf`;

      try {
        const { buffer, contentType, originalExt } = await loadBytes(value);
        const key = buildKey(staffId, f.folder, displayName, originalExt);
        const kind = value.startsWith("data:") ? "base64" : "disk";

        console.log(`[${staffId}] ${f.dataKey} (${kind}, ${buffer.length}B) -> ${key}`);

        if (APPLY) {
          await s3.send(
            new PutObjectCommand({
              Bucket: BUCKET,
              Key: key,
              Body: buffer,
              ContentType: contentType,
            })
          );
        }
        updates[f.dataKey] = key;
        migrated++;
      } catch (e) {
        failed++;
        console.error(`  ! FAILED ${staffId}/${f.dataKey}: ${e.message}`);
      }
    }

    if (Object.keys(updates).length > 0 && APPLY) {
      const names = {};
      const values = {};
      const sets = [];
      let i = 0;
      for (const [k, v] of Object.entries(updates)) {
        names[`#a${i}`] = k;
        values[`:v${i}`] = v;
        sets.push(`#a${i} = :v${i}`);
        i++;
      }
      await docClient.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { staff_id: staffId },
          UpdateExpression: `set ${sets.join(", ")}`,
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
        })
      );
    }
    if (Object.keys(updates).length === 0) skipped++;
  }

  console.log(`\nDone. migrated=${migrated} failed=${failed} employees-untouched=${skipped}`);
  if (!APPLY) console.log("(dry run — nothing was written)");
}

main().catch((e) => {
  console.error("Migration crashed:", e);
  process.exit(1);
});
