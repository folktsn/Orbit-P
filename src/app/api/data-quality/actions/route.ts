import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { NextResponse } from "next/server";
import { docClient } from "@/lib/dynamodb";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const VALID_STATUSES = new Set(["open", "in_progress", "resolved", "ignored"]);

type WorkflowStatus = "open" | "in_progress" | "resolved" | "ignored";

function clean(value: unknown, maxLength = 300) {
  return String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function validDate(value: string) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function employeeName(item: Record<string, unknown>) {
  const direct = clean(item.name_en || item.name_th || item.name, 200);
  if (direct) return direct;
  return [clean(item.first_name_en || item.first_name_th), clean(item.last_name_en || item.last_name_th)].filter(Boolean).join(" ");
}

async function resolveAssignee(id: string) {
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

function mapRecord(record: {
  issueId: string;
  status: string;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneePosition: string | null;
  dueDate: string;
  note: string;
  updatedAt: Date;
  updatedById: string;
  updatedByName: string;
  history: Array<{
    status: string;
    changedAt: Date;
    changedById: string;
    changedByName: string;
    note: string;
  }>;
}) {
  return {
    issueId: record.issueId,
    status: record.status as WorkflowStatus,
    assignee: record.assigneeId ? {
      id: record.assigneeId,
      name: record.assigneeName || record.assigneeId,
      position: record.assigneePosition || "",
    } : null,
    dueDate: record.dueDate,
    note: record.note,
    updatedAt: record.updatedAt.toISOString(),
    updatedBy: { id: record.updatedById, name: record.updatedByName },
    history: record.history.map((entry) => ({
      status: entry.status as WorkflowStatus,
      changedAt: entry.changedAt.toISOString(),
      changedBy: { id: entry.changedById, name: entry.changedByName },
      note: entry.note,
    })),
  };
}

const workflowInclude = {
  history: { orderBy: { changedAt: "asc" as const }, take: 30 },
};

export async function GET() {
  try {
    const records = await prisma.dataQualityAction.findMany({ include: workflowInclude });
    const items = Object.fromEntries(records.map((record) => [record.issueId, mapRecord(record)]));
    const updatedAt = records.reduce((latest, record) => record.updatedAt > latest ? record.updatedAt : latest, new Date(0));
    return NextResponse.json({ items, updatedAt: updatedAt.getTime() ? updatedAt.toISOString() : "" }, { headers: { "Cache-Control": "no-store" } });
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
    const rawActor = body.actor && typeof body.actor === "object" ? body.actor as Record<string, unknown> : {};
    const actor = {
      id: clean(rawActor.id || rawActor.username, 80) || "unknown",
      name: clean(rawActor.name || rawActor.displayName, 160) || "Unknown user",
    };

    if (!issueId) return NextResponse.json({ error: "Issue ID is required" }, { status: 400 });
    if (!VALID_STATUSES.has(status)) return NextResponse.json({ error: "Invalid workflow status" }, { status: 400 });
    if (!validDate(dueDate)) return NextResponse.json({ error: "Invalid due date" }, { status: 400 });

    const assignee = await resolveAssignee(assigneeId);
    if (assigneeId && !assignee) return NextResponse.json({ error: "ไม่พบรหัสพนักงานผู้รับผิดชอบ" }, { status: 404 });

    const existing = await prisma.dataQualityAction.findUnique({ where: { issueId } });
    const changed = !existing
      || existing.status !== status
      || existing.assigneeId !== assignee?.id
      || existing.dueDate !== dueDate
      || existing.note !== note;

    const record = await prisma.$transaction(async (transaction) => {
      await transaction.dataQualityAction.upsert({
        where: { issueId },
        create: {
          issueId,
          status,
          assigneeId: assignee?.id,
          assigneeName: assignee?.name,
          assigneePosition: assignee?.position,
          dueDate,
          note,
          updatedById: actor.id,
          updatedByName: actor.name,
        },
        update: {
          status,
          assigneeId: assignee?.id ?? null,
          assigneeName: assignee?.name ?? null,
          assigneePosition: assignee?.position ?? null,
          dueDate,
          note,
          updatedById: actor.id,
          updatedByName: actor.name,
        },
      });

      if (changed) {
        await transaction.dataQualityActionHistory.create({
          data: {
            issueId,
            status,
            changedById: actor.id,
            changedByName: actor.name,
            note,
          },
        });
      }

      return transaction.dataQualityAction.findUniqueOrThrow({ where: { issueId }, include: workflowInclude });
    });

    return NextResponse.json({ record: mapRecord(record), updatedAt: record.updatedAt.toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Error saving data-quality workflow:", error);
    return NextResponse.json({ error: "ไม่สามารถบันทึกสถานะการตรวจสอบได้" }, { status: 500 });
  }
}
