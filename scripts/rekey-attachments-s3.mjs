/**
 * One-off: move already-migrated attachments from the old shared prefix
 *   employees/<staffId>/<category>/<file>
 * to this app's dedicated top-level prefixes
 *   evaluation/<staffId>/<file>     (probation evaluations)
 *   attachments/<staffId>/<file>    (general attachments)
 * and repoint the DynamoDB `fullstaff` records. Old S3 objects are deleted only
 * after a successful copy + DynamoDB update.
 *
 * Usage (dry run):      node scripts/rekey-attachments-s3.mjs
 *       apply:          MIGRATE_APPLY=1 node scripts/rekey-attachments-s3.mjs
 * Env: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, [S3_ATTACHMENTS_BUCKET]
 */

import path from "node:path";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, CopyObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const REGION = process.env.AWS_REGION || "ap-southeast-7";
const BUCKET = process.env.S3_ATTACHMENTS_BUCKET || "pa-hr-attachments";
const APPLY = process.env.MIGRATE_APPLY === "1";
const TABLE = "fullstaff";
const OLD_PREFIX = "employees/";

// Which field maps to which new top-level prefix.
const FIELDS = [
  { dataKey: "probation_pass_attachment_data", newPrefix: "evaluation/" },
  { dataKey: "attachment_data", newPrefix: "attachments/" },
];

const creds = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
};
const docClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION, credentials: creds }),
  { marshallOptions: { removeUndefinedValues: true } }
);
const s3 = new S3Client({ region: REGION, credentials: creds });

async function scanAll() {
  const items = [];
  let ExclusiveStartKey;
  do {
    const res = await docClient.send(new ScanCommand({ TableName: TABLE, ExclusiveStartKey }));
    if (res.Items) items.push(...res.Items);
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

async function main() {
  console.log(`\nRe-keying ${OLD_PREFIX} -> dedicated prefixes in s3://${BUCKET} (region ${REGION})`);
  console.log(APPLY ? ">>> APPLY MODE\n" : ">>> DRY RUN (set MIGRATE_APPLY=1 to apply)\n");

  const items = await scanAll();
  console.log(`Scanned ${items.length} employees.\n`);

  let moved = 0, failed = 0;

  for (const item of items) {
    const staffId = item.staff_id;
    if (!staffId) continue;

    const updates = {};
    for (const f of FIELDS) {
      const oldKey = item[f.dataKey];
      if (!oldKey || typeof oldKey !== "string" || !oldKey.startsWith(OLD_PREFIX)) continue;

      const safeStaffId = String(staffId).replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.[^.]+$/, "");
      const newKey = `${f.newPrefix}${safeStaffId}/${path.basename(oldKey)}`;
      console.log(`[${staffId}] ${f.dataKey}\n    ${oldKey}\n -> ${newKey}`);

      if (APPLY) {
        try {
          await s3.send(new CopyObjectCommand({
            Bucket: BUCKET,
            CopySource: encodeURI(`${BUCKET}/${oldKey}`),
            Key: newKey,
            MetadataDirective: "COPY",
          }));
          // verify copy exists before deleting the source
          await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: newKey }));
          updates[f.dataKey] = { oldKey, newKey };
          moved++;
        } catch (e) {
          failed++;
          console.error(`  ! copy FAILED: ${e.message}`);
        }
      } else {
        moved++;
      }
    }

    if (APPLY && Object.keys(updates).length) {
      // update DynamoDB to new keys
      const names = {}, values = {}, sets = [];
      let i = 0;
      for (const [k, v] of Object.entries(updates)) {
        names[`#a${i}`] = k; values[`:v${i}`] = v.newKey; sets.push(`#a${i} = :v${i}`); i++;
      }
      await docClient.send(new UpdateCommand({
        TableName: TABLE,
        Key: { staff_id: staffId },
        UpdateExpression: `set ${sets.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      }));
      // delete old objects only after DynamoDB now points at the new keys
      for (const v of Object.values(updates)) {
        try {
          await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: v.oldKey }));
        } catch (e) {
          console.error(`  ! delete old FAILED (${v.oldKey}): ${e.message} (orphan, harmless)`);
        }
      }
    }
  }

  console.log(`\nDone. moved=${moved} failed=${failed}`);
  if (!APPLY) console.log("(dry run — nothing was written)");
}

main().catch((e) => { console.error("Re-key crashed:", e); process.exit(1); });
