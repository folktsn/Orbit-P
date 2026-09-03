import { NextResponse } from "next/server";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { ATTACHMENTS_BUCKET, s3Client } from "@/lib/s3";
import { authorizeRequest } from "@/lib/auth-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BUDGET_KEY = "manpower/budgets.json";
const FALLBACK_PATH = path.join(os.tmpdir(), "s-recruit-manpower-budgets.json");

type BudgetMap = Record<string, number | null>;

type BudgetFile = {
  budgets: BudgetMap;
  updatedAt: string;
};

function isMissingS3Object(error: unknown) {
  const err = error as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } };
  return err?.name === "NoSuchKey" || err?.Code === "NoSuchKey" || err?.$metadata?.httpStatusCode === 404;
}

async function streamToString(body: unknown) {
  if (!body) return "";
  if (typeof body === "string") return body;
  if (body instanceof Uint8Array) return Buffer.from(body).toString("utf8");

  const stream = body as AsyncIterable<Uint8Array>;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function normalizeBudgets(value: unknown): BudgetMap {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const normalized: BudgetMap = {};

  Object.entries(source).forEach(([key, budget]) => {
    const trimmedKey = key.trim();
    if (!trimmedKey) return;
    if (budget === null || budget === "") {
      normalized[trimmedKey] = null;
      return;
    }
    const numeric = Number(budget);
    normalized[trimmedKey] = Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : null;
  });

  return normalized;
}

async function readFallback(): Promise<BudgetFile | null> {
  try {
    const text = await fs.readFile(FALLBACK_PATH, "utf8");
    const parsed = JSON.parse(text) as Partial<BudgetFile>;
    return {
      budgets: normalizeBudgets(parsed.budgets),
      updatedAt: parsed.updatedAt || "",
    };
  } catch {
    return null;
  }
}

async function writeFallback(file: BudgetFile) {
  await fs.writeFile(FALLBACK_PATH, JSON.stringify(file, null, 2), "utf8");
}

async function readBudgetFile(): Promise<BudgetFile> {
  try {
    const response = await s3Client.send(new GetObjectCommand({ Bucket: ATTACHMENTS_BUCKET, Key: BUDGET_KEY }));
    const text = await streamToString(response.Body);
    const parsed = JSON.parse(text || "{}") as Partial<BudgetFile>;
    return {
      budgets: normalizeBudgets(parsed.budgets),
      updatedAt: parsed.updatedAt || "",
    };
  } catch (error) {
    if (!isMissingS3Object(error)) console.error("Error reading manpower budgets from S3:", error);
    return (await readFallback()) || { budgets: {}, updatedAt: "" };
  }
}

async function writeBudgetFile(file: BudgetFile) {
  await writeFallback(file);
  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: ATTACHMENTS_BUCKET,
        Key: BUDGET_KEY,
        Body: JSON.stringify(file, null, 2),
        ContentType: "application/json; charset=utf-8",
      })
    );
  } catch (error) {
    console.error("Error writing manpower budgets to S3; fallback file was saved:", error);
  }
}

export async function GET(request: Request) {
  const authorization = await authorizeRequest(request, "view");
  if (!authorization.ok) return authorization.response;

  const file = await readBudgetFile();
  return NextResponse.json(file, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const authorization = await authorizeRequest(request, "edit");
  if (!authorization.ok) return authorization.response;

  try {
    const body = await request.json().catch(() => ({}));
    const incomingBudgets = normalizeBudgets(body?.budgets ?? body);
    const currentFile = await readBudgetFile();
    const budgets = { ...currentFile.budgets, ...incomingBudgets };
    const file = { budgets, updatedAt: new Date().toISOString() };
    await writeBudgetFile(file);
    return NextResponse.json(file, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Error saving manpower budgets:", error);
    return NextResponse.json({ error: "Failed to save manpower budgets" }, { status: 500 });
  }
}


