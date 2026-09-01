import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { NextResponse } from "next/server";
import { docClient } from "@/lib/dynamodb";
import { ATTACHMENTS_BUCKET, s3Client } from "@/lib/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const WORKFLOW_KEY = "data-quality/workflow.json";
const FALLBACK_PATH = path.join(os.tmpdir(), "orbit-p-data-quality-workflow.json");
const VALID_STATUSES = new Set(["open", "in_progress", "resolved", "ignored"]);

type WorkflowStatus = "open" | "in_progress" | "resolved" | "ignored";

type WorkflowActor = {
  id: string;
  name: string;
};

type WorkflowAssignee = {
  id: string;
  name: string;
  position: string;
};

type WorkflowHistoryEntry = {
  status: WorkflowStatus;
  changedAt: string;
  changedBy: WorkflowActor;
  note: string;
};

type WorkflowRecord = {
  issueId: string;
  status: WorkflowStatus;
  assignee: WorkflowAssignee | null;
  dueDate: string;
  note: string;
  updatedAt: string;
  updatedBy: WorkflowActor;
  history: WorkflowHistoryEntry[];
};

type WorkflowFile = {
  items: Record<string, WorkflowRecord>;
  updatedAt: string;
};

function clean(value: unknown, maxLength = 300) {
  return String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function validDate(value: string) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isMissingS3Object(error: unknown) {
  const err = error as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } };
  return err?.name === "NoSuchKey" || err?.Code === "NoSuchKey" || err?.$metadata?.httpStatusCode === 404;
}

async function streamToString(body: unknown) {
  if (!body) return "";
  if (typeof body === "string") return body;
  if (body instanceof Uint8Array) return Buffer.from(body).toString("utf8");
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function normalizeActor(value: unknown): WorkflowActor {
  const actor = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    id: clean(actor.id || actor.username, 80) || "unknown",
    name: clean(actor.name || actor.displayName, 160) || "Unknown user",
  };
}

function normalizeAssignee(value: unknown): WorkflowAssignee | null {
  if (!value || typeof value !== "object") return null;
  const assignee = value as Record<string, unknown>;
  const id = clean(assignee.id, 80);
  if (!id) return null;
  return {
    id,
    name: clean(assignee.name, 200),
    position: clean(assignee.position, 240),
  };
}

function normalizeRecord(issueId: string, value: unknown): WorkflowRecord | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const status = clean(source.status) as WorkflowStatus;
  if (!VALID_STATUSES.has(status)) return null;
  const history = Array.isArray(source.history)
    ? source.history.slice(-30).flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const item = entry as Record<string, unknown>;
        const historyStatus = clean(item.status) as WorkflowStatus;
        if (!VALID_STATUSES.has(historyStatus)) return [];
        return [{
          status: historyStatus,
          changedAt: clean(item.changedAt, 40),
          changedBy: normalizeActor(item.changedBy),
          note: clean(item.note, 1000),
        }];
      })
    : [];

  return {
    issueId,
    status,
    assignee: normalizeAssignee(source.assignee),
    dueDate: clean(source.dueDate, 10),
    note: clean(source.note, 1000),
    updatedAt: clean(source.updatedAt, 40),
    updatedBy: normalizeActor(source.updatedBy),
    history,
  };
}

function normalizeFile(value: unknown): WorkflowFile {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const rawItems = source.items && typeof source.items === "object" ? source.items as Record<string, unknown> : {};
  const items: Record<string, WorkflowRecord> = {};
  Object.entries(rawItems).forEach(([rawIssueId, record]) => {
    const issueId = clean(rawIssueId, 300);
    const normalized = issueId ? normalizeRecord(issueId, record) : null;
    if (normalized) items[issueId] = normalized;
  });
  return { items, updatedAt: clean(source.updatedAt, 40) };
}

async function readFallback() {
  try {
    return normalizeFile(JSON.parse(await fs.readFile(FALLBACK_PATH, "utf8")));
  } catch {
    return { items: {}, updatedAt: "" } satisfies WorkflowFile;
  }
}

async function readWorkflowFile(): Promise<WorkflowFile> {
  try {
    const response = await s3Client.send(new GetObjectCommand({ Bucket: ATTACHMENTS_BUCKET, Key: WORKFLOW_KEY }));
    return normalizeFile(JSON.parse((await streamToString(response.Body)) || "{}"));
  } catch (error) {
    if (!isMissingS3Object(error)) {
      console.error("Error reading data-quality workflow from S3:", error);
      if (process.env.NODE_ENV === "production") throw error;
    }
    return readFallback();
  }
}

async function writeWorkflowFile(file: WorkflowFile) {
  const body = JSON.stringify(file, null, 2);
  await fs.writeFile(FALLBACK_PATH, body, "utf8");
  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: ATTACHMENTS_BUCKET,
      Key: WORKFLOW_KEY,
      Body: body,
      ContentType: "application/json; charset=utf-8",
    }));
  } catch (error) {
    console.error("Error writing data-quality workflow to S3:", error);
    if (process.env.NODE_ENV === "production") throw error;
  }
}

function employeeName(item: Record<string, unknown>) {
  const direct = clean(item.name_en || item.name_th || item.name, 200);
  if (direct) return direct;
  return [clean(item.first_name_en || item.first_name_th), clean(item.last_name_en || item.last_name_th)].filter(Boolean).join(" ");
}

async function resolveAssignee(id: string): Promise<WorkflowAssignee | null> {
  if (!id) return null;
  const response = await docClient.send(new GetCommand({ TableName: "fullstaff", Key: { staff_id: id } }));
  if (!response.Item) return null;
  const item = response.Item as Record<string, unknown>;
  return {
    id,
    name: employeeName(item) || id,
    position: clean(item.position_en || item.position_th || item.position || item.title, 240),
  };
}

export async function GET() {
  try {
    const file = await readWorkflowFile();
    return NextResponse.json(file, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Error loading data-quality workflow:", error);
    return NextResponse.json({ error: "ไม่สามารถโหลดสถานะการตรวจสอบได้" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const issueId = clean(body.issueId, 300);
    const status = clean(body.status) as WorkflowStatus;
    const assigneeId = clean(body.assigneeId, 80);
    const dueDate = clean(body.dueDate, 10);
    const note = clean(body.note, 1000);
    const actor = normalizeActor(body.actor);

    if (!issueId) return NextResponse.json({ error: "Issue ID is required" }, { status: 400 });
    if (!VALID_STATUSES.has(status)) return NextResponse.json({ error: "Invalid workflow status" }, { status: 400 });
    if (!validDate(dueDate)) return NextResponse.json({ error: "Invalid due date" }, { status: 400 });

    const assignee = await resolveAssignee(assigneeId);
    if (assigneeId && !assignee) return NextResponse.json({ error: "ไม่พบรหัสพนักงานผู้รับผิดชอบ" }, { status: 404 });

    const file = await readWorkflowFile();
    const existing = file.items[issueId];
    const updatedAt = new Date().toISOString();
    const changed = !existing
      || existing.status !== status
      || existing.assignee?.id !== assignee?.id
      || existing.dueDate !== dueDate
      || existing.note !== note;
    const history = changed
      ? [...(existing?.history ?? []), { status, changedAt: updatedAt, changedBy: actor, note }].slice(-30)
      : existing.history;

    const record: WorkflowRecord = {
      issueId,
      status,
      assignee,
      dueDate,
      note,
      updatedAt,
      updatedBy: actor,
      history,
    };
    file.items[issueId] = record;
    file.updatedAt = updatedAt;
    await writeWorkflowFile(file);

    return NextResponse.json({ record, updatedAt }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Error saving data-quality workflow:", error);
    return NextResponse.json({ error: "ไม่สามารถบันทึกสถานะการตรวจสอบได้" }, { status: 500 });
  }
}
