import { randomUUID } from "crypto";
import path from "path";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { NextRequest, NextResponse } from "next/server";
import { docClient } from "@/lib/dynamodb";
import { invalidateEmployeesCache } from "@/lib/employeesCache";
import { invalidateProbationCache } from "@/lib/probationCache";
import { uploadAttachment } from "@/lib/s3";
import { authorizeRequest } from "@/lib/auth-session";
import { MAX_FOLLOW_UP_COMMENT_LENGTH } from "@/lib/probationFollowUp";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

type FollowUpRequest = {
  employeeId?: unknown;
  followUpNumber?: unknown;
  followUpDate?: unknown;
  evaluatorId?: unknown;
  comment?: unknown;
  attachmentName?: unknown;
  attachmentData?: unknown;
};

type RawEmployee = Record<string, unknown>;

function hasValue(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized !== "" && normalized !== "-" && normalized !== "null" && normalized !== "undefined";
}

function valueOf(item: RawEmployee, fields: readonly string[], fallback = "") {
  for (const field of fields) {
    if (hasValue(item[field])) return String(item[field]).trim();
  }
  return fallback;
}

function isValidDateOnly(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1])
    && date.getUTCMonth() === Number(match[2]) - 1
    && date.getUTCDate() === Number(match[3]);
}

async function findEvaluator(employeeId: string) {
  const response = await docClient.send(new GetCommand({
    TableName: "fullstaff",
    Key: { staff_id: employeeId },
    ProjectionExpression: [
      "staff_id",
      "emp_code",
      "title_th",
      "title_en",
      "first_name_th",
      "last_name_th",
      "first_name_en",
      "last_name_en",
      "name_th",
      "name_en",
      "#position",
      "position_th",
      "position_en",
    ].join(", "),
    ExpressionAttributeNames: {
      "#position": "position",
    },
  }));

  if (!response.Item) return null;
  const item = response.Item as RawEmployee;
  const firstNameTh = valueOf(item, ["first_name_th"]);
  const lastNameTh = valueOf(item, ["last_name_th"]);
  const firstNameEn = valueOf(item, ["first_name_en"]);
  const lastNameEn = valueOf(item, ["last_name_en"]);
  const titleTh = valueOf(item, ["title_th"]);
  const titleEn = valueOf(item, ["title_en"]);
  const thaiName = firstNameTh || lastNameTh
    ? `${titleTh}${firstNameTh} ${lastNameTh}`.trim()
    : valueOf(item, ["name_th"]);
  const englishName = firstNameEn || lastNameEn
    ? `${titleEn ? `${titleEn} ` : ""}${firstNameEn} ${lastNameEn}`.trim()
    : valueOf(item, ["name_en"]);

  return {
    employeeId: valueOf(item, ["emp_code", "staff_id"], employeeId),
    name: thaiName || englishName || employeeId,
    nameEn: englishName,
    position: valueOf(item, ["position_th", "position_en", "position"], "-"),
  };
}

async function employeeExists(employeeId: string) {
  const response = await docClient.send(new GetCommand({
    TableName: "fullstaff",
    Key: { staff_id: employeeId },
    ProjectionExpression: "staff_id",
  }));
  return Boolean(response.Item);
}

function safePathPart(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120) || "image";
}

function isValidImageBuffer(contentType: string, body: Buffer) {
  if (contentType === "image/jpeg") {
    return body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff;
  }
  if (contentType === "image/png") {
    return body.length >= 8 && body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (contentType === "image/webp") {
    return body.length >= 12 && body.toString("ascii", 0, 4) === "RIFF" && body.toString("ascii", 8, 12) === "WEBP";
  }
  return false;
}

async function uploadFollowUpImage(params: {
  employeeId: string;
  followUpNumber: number;
  fileName: string;
  dataUrl: string;
}) {
  const match = params.dataUrl.match(/^data:([^;,]+);base64,([\s\S]+)$/);
  if (!match) throw new Error("INVALID_IMAGE");

  const contentType = match[1].toLowerCase();
  const extension = ALLOWED_IMAGE_TYPES.get(contentType);
  if (!extension) throw new Error("INVALID_IMAGE_TYPE");

  const body = Buffer.from(match[2], "base64");
  if (body.length === 0 || body.length > MAX_IMAGE_BYTES) throw new Error("INVALID_IMAGE_SIZE");
  if (!isValidImageBuffer(contentType, body)) throw new Error("INVALID_IMAGE");

  const parsedName = path.parse(params.fileName || "follow-up-image");
  const fileName = `${safePathPart(parsedName.name)}${extension}`;
  const key = [
    "evaluation",
    "follow-up",
    safePathPart(params.employeeId),
    `Follow_Up_${params.followUpNumber}`,
    `${Date.now()}-${randomUUID()}-${fileName}`,
  ].join("/");

  await uploadAttachment({ key, body, contentType });
  return { key, fileName };
}

export async function GET(request: NextRequest) {
  const authorization = await authorizeRequest(request, "view");
  if (!authorization.ok) return authorization.response;

  try {
    const employeeId = request.nextUrl.searchParams.get("employeeId")?.trim() || "";
    if (!employeeId) {
      return NextResponse.json({ error: "กรุณาระบุรหัสพนักงานผู้ติดตาม" }, { status: 400 });
    }

    const evaluator = await findEvaluator(employeeId);
    if (!evaluator) {
      return NextResponse.json({ error: "ไม่พบรหัสพนักงานผู้ติดตาม" }, { status: 404 });
    }

    return NextResponse.json({ evaluator });
  } catch (error) {
    console.error("Error looking up probation evaluator:", error);
    return NextResponse.json({ error: "ไม่สามารถตรวจสอบผู้ติดตามได้" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeRequest(request, "edit");
  if (!authorization.ok) return authorization.response;

  try {
    const body = await request.json() as FollowUpRequest;
    const employeeId = String(body.employeeId ?? "").trim();
    const followUpNumber = Number(body.followUpNumber);
    const followUpDate = String(body.followUpDate ?? "").trim();
    const evaluatorId = String(body.evaluatorId ?? "").trim();
    const attachmentName = String(body.attachmentName ?? "").trim();
    const attachmentData = String(body.attachmentData ?? "").trim();

    if (!employeeId) {
      return NextResponse.json({ error: "กรุณาระบุรหัสพนักงาน" }, { status: 400 });
    }
    if (![1, 2, 3].includes(followUpNumber)) {
      return NextResponse.json({ error: "ครั้งที่ติดตามต้องอยู่ระหว่าง 1 ถึง 3" }, { status: 400 });
    }
    if (!isValidDateOnly(followUpDate)) {
      return NextResponse.json({ error: "รูปแบบวันที่ติดตามไม่ถูกต้อง" }, { status: 400 });
    }
    if (!evaluatorId) {
      return NextResponse.json({ error: "กรุณาระบุรหัสพนักงานผู้ติดตาม" }, { status: 400 });
    }
    if (body.comment !== undefined && typeof body.comment !== "string") {
      return NextResponse.json({ error: "Comment ต้องเป็นข้อความ" }, { status: 400 });
    }
    if (typeof body.comment === "string" && body.comment.length > MAX_FOLLOW_UP_COMMENT_LENGTH) {
      return NextResponse.json({ error: `Comment ต้องไม่เกิน ${MAX_FOLLOW_UP_COMMENT_LENGTH.toLocaleString()} ตัวอักษร` }, { status: 400 });
    }
    const comment = typeof body.comment === "string" ? body.comment.trim() : undefined;

    const evaluator = await findEvaluator(evaluatorId);
    if (!evaluator) {
      return NextResponse.json({ error: "ไม่พบรหัสพนักงานผู้ติดตาม" }, { status: 404 });
    }
    if (!(await employeeExists(employeeId))) {
      return NextResponse.json({ error: "ไม่พบข้อมูลพนักงานที่ต้องการบันทึก" }, { status: 404 });
    }

    let uploadedImage: { key: string; fileName: string } | null = null;
    if (attachmentData) {
      uploadedImage = await uploadFollowUpImage({
        employeeId,
        followUpNumber,
        fileName: attachmentName,
        dataUrl: attachmentData,
      });
    }

    const prefix = `probation_follow_up_${followUpNumber}`;
    const names: Record<string, string> = {
      "#date": `${prefix}_date`,
      "#evaluatorId": `${prefix}_evaluator_id`,
      "#evaluatorName": `${prefix}_evaluator_name`,
      "#evaluatorNameEn": `${prefix}_evaluator_name_en`,
      "#evaluatorPosition": `${prefix}_evaluator_position`,
    };
    const values: Record<string, unknown> = {
      ":date": followUpDate,
      ":evaluatorId": evaluator.employeeId,
      ":evaluatorName": evaluator.name,
      ":evaluatorNameEn": evaluator.nameEn,
      ":evaluatorPosition": evaluator.position,
    };
    const assignments = [
      "#date = :date",
      "#evaluatorId = :evaluatorId",
      "#evaluatorName = :evaluatorName",
      "#evaluatorNameEn = :evaluatorNameEn",
      "#evaluatorPosition = :evaluatorPosition",
    ];

    // Older clients omit comment; do not erase a previously saved note.
    if (comment !== undefined) {
      names["#comment"] = `${prefix}_comment`;
      values[":comment"] = comment;
      assignments.push("#comment = :comment");
    }

    if (uploadedImage) {
      names["#attachmentName"] = `${prefix}_attachment_name`;
      names["#attachmentData"] = `${prefix}_attachment_data`;
      values[":attachmentName"] = uploadedImage.fileName;
      values[":attachmentData"] = uploadedImage.key;
      assignments.push("#attachmentName = :attachmentName", "#attachmentData = :attachmentData");
    }

    const response = await docClient.send(new UpdateCommand({
      TableName: "fullstaff",
      Key: { staff_id: employeeId },
      UpdateExpression: `SET ${assignments.join(", ")}`,
      ConditionExpression: "attribute_exists(staff_id)",
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: "UPDATED_NEW",
    }));

    invalidateEmployeesCache();
    invalidateProbationCache();

    return NextResponse.json({
      success: true,
      employeeId,
      followUpNumber,
      followUpDate,
      evaluator,
      comment,
      attachmentName: uploadedImage?.fileName || undefined,
      attachmentData: uploadedImage?.key || undefined,
      updatedItem: response.Attributes,
    });
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "";
    const errorMessage = error instanceof Error ? error.message : "";
    if (errorName === "SyntaxError") {
      return NextResponse.json({ error: "ข้อมูลที่ส่งมาไม่ถูกต้อง" }, { status: 400 });
    }
    if (errorName === "ConditionalCheckFailedException") {
      return NextResponse.json({ error: "ไม่พบข้อมูลพนักงานที่ต้องการบันทึก" }, { status: 404 });
    }
    if (errorMessage === "INVALID_IMAGE_TYPE") {
      return NextResponse.json({ error: "รองรับรูป JPG, PNG และ WebP เท่านั้น" }, { status: 400 });
    }
    if (errorMessage === "INVALID_IMAGE_SIZE") {
      return NextResponse.json({ error: "รูปต้องมีขนาดไม่เกิน 20 MB" }, { status: 400 });
    }
    if (errorMessage === "INVALID_IMAGE") {
      return NextResponse.json({ error: "ข้อมูลรูปภาพไม่ถูกต้อง" }, { status: 400 });
    }

    console.error("Error saving probation follow-up:", error);
    return NextResponse.json({ error: "ไม่สามารถบันทึกการติดตามได้" }, { status: 500 });
  }
}
