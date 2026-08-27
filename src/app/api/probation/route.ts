import { ScanCommand, type ScanCommandInput } from "@aws-sdk/lib-dynamodb";
import { NextRequest, NextResponse } from "next/server";
import { docClient } from "@/lib/dynamodb";
import { getProbationCache, setProbationCache } from "@/lib/probationCache";

export const runtime = "nodejs";

const CACHE_TTL_MS = 60_000;

const PROBATION_FIELDS = [
  "emp_code", "staff_id", "employeeId", "id",
  "title_th", "title_en", "first_name_th", "last_name_th", "first_name_en", "last_name_en",
  "name_th", "name_en", "name",
  "position_th", "position_en", "position", "title",
  "department_th", "department_en", "department",
  "division_th", "division_en", "division",
  "section_th", "section_en", "section",
  "unit_th", "unit_en", "unit",
  "station_th", "station_en", "station", "work_location",
  "supervisor", "status", "emp_type", "start_date", "hire_date", "contractStart", "contractEnd", "contract_end",
  "probation_end_date", "probation_end", "probation_days", "probation_day", "probation_period_days",
  "probation_duration_days", "probation_total_days", "prob_days", "prob_period",
  "resign_date", "last_working_date", "last_work_date", "probation_outcome", "probation_extension_days",
  "probation_follow_up_1_date", "probation_follow_up_2_date", "probation_follow_up_3_date",
] as const;

function buildProjection(fields: readonly string[]) {
  const ExpressionAttributeNames: Record<string, string> = {};
  const ProjectionExpression = fields.map((field, index) => {
    const key = `#f${index}`;
    ExpressionAttributeNames[key] = field;
    return key;
  }).join(", ");

  return { ProjectionExpression, ExpressionAttributeNames };
}

function compactRecord(item: Record<string, unknown>) {
  return PROBATION_FIELDS.reduce<Record<string, unknown>>((record, field) => {
    if (item[field] !== undefined) record[field] = item[field];
    return record;
  }, {});
}

function normalizedValue(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function hasMeaningfulValue(value: unknown) {
  const normalized = normalizedValue(value);
  return normalized !== "" && normalized !== "-" && normalized !== "null" && normalized !== "undefined";
}

function firstValue(item: Record<string, unknown>, fields: readonly string[]) {
  for (const field of fields) {
    if (hasMeaningfulValue(item[field])) return item[field];
  }
  return "";
}

function isContractor(item: Record<string, unknown>) {
  const employeeId = String(firstValue(item, ["emp_code", "staff_id", "employeeId", "id"]));
  const position = normalizedValue(firstValue(item, ["position_en", "position", "title", "position_th"]));
  const isAgentPosition = position.includes("agent") || position.includes("เจ้าหน้าที่");
  return employeeId.startsWith("80") && !isAgentPosition;
}

function isActiveProbation(item: Record<string, unknown>) {
  const status = normalizedValue(item.status);
  const employmentType = normalizedValue(item.emp_type);
  const hasSeparationDate = ["resign_date", "last_working_date", "last_work_date"]
    .some((field) => hasMeaningfulValue(item[field]));

  return status === "active"
    && employmentType === "probation"
    && !hasSeparationDate
    && !isContractor(item);
}

async function scanProbationEmployees() {
  const items: Record<string, unknown>[] = [];
  let ExclusiveStartKey: ScanCommandInput["ExclusiveStartKey"];
  const projection = buildProjection(PROBATION_FIELDS);

  do {
    const response = await docClient.send(new ScanCommand({
      TableName: "fullstaff",
      ExclusiveStartKey,
      ...projection,
    }));

    for (const item of response.Items ?? []) {
      const compactItem = compactRecord(item);
      if (isActiveProbation(compactItem)) items.push(compactItem);
    }

    ExclusiveStartKey = response.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  return items;
}

export async function GET(request: NextRequest) {
  try {
    const shouldRefresh = request.nextUrl.searchParams.get("refresh") === "1";
    const now = Date.now();
    const probationCache = getProbationCache();

    if (!shouldRefresh && probationCache && probationCache.expiresAt > now) {
      return NextResponse.json(
        { items: probationCache.items, fetchedAt: probationCache.fetchedAt },
        {
          headers: {
            "Cache-Control": "private, max-age=30",
            "X-Probation-Cache": "HIT",
          },
        },
      );
    }

    const items = await scanProbationEmployees();
    const fetchedAt = new Date().toISOString();
    setProbationCache({ items, fetchedAt, expiresAt: now + CACHE_TTL_MS });

    return NextResponse.json(
      { items, fetchedAt },
      {
        headers: {
          "Cache-Control": "private, max-age=30",
          "X-Probation-Cache": "MISS",
        },
      },
    );
  } catch (error) {
    console.error("Error fetching probation employees:", error);
    return NextResponse.json(
      { error: "ไม่สามารถเชื่อมต่อฐานข้อมูลพนักงานทดลองงานได้" },
      { status: 500 },
    );
  }
}
