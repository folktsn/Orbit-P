import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { NextResponse } from "next/server";
import { docClient } from "@/lib/dynamodb";
import { invalidateEmployeesCache } from "@/lib/employeesCache";
import { invalidateProbationCache } from "@/lib/probationCache";

export const runtime = "nodejs";

type FollowUpRequest = {
  employeeId?: unknown;
  followUpNumber?: unknown;
  followUpDate?: unknown;
};

function isValidDateOnly(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1])
    && date.getUTCMonth() === Number(match[2]) - 1
    && date.getUTCDate() === Number(match[3]);
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as FollowUpRequest;
    const employeeId = String(body.employeeId ?? "").trim();
    const followUpNumber = Number(body.followUpNumber);
    const followUpDate = String(body.followUpDate ?? "").trim();

    if (!employeeId) {
      return NextResponse.json({ error: "กรุณาระบุรหัสพนักงาน" }, { status: 400 });
    }

    if (![1, 2, 3].includes(followUpNumber)) {
      return NextResponse.json({ error: "ครั้งที่ติดตามต้องอยู่ระหว่าง 1 ถึง 3" }, { status: 400 });
    }

    if (!isValidDateOnly(followUpDate)) {
      return NextResponse.json({ error: "รูปแบบวันที่ติดตามไม่ถูกต้อง" }, { status: 400 });
    }

    const attributeName = `probation_follow_up_${followUpNumber}_date`;
    const response = await docClient.send(new UpdateCommand({
      TableName: "fullstaff",
      Key: { staff_id: employeeId },
      UpdateExpression: "SET #followUpDate = :followUpDate",
      ConditionExpression: "attribute_exists(staff_id)",
      ExpressionAttributeNames: {
        "#followUpDate": attributeName,
      },
      ExpressionAttributeValues: {
        ":followUpDate": followUpDate,
      },
      ReturnValues: "UPDATED_NEW",
    }));

    invalidateEmployeesCache();
    invalidateProbationCache();

    return NextResponse.json({
      success: true,
      employeeId,
      followUpNumber,
      followUpDate,
      updatedItem: response.Attributes,
    });
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "";
    if (errorName === "ConditionalCheckFailedException") {
      return NextResponse.json({ error: "ไม่พบข้อมูลพนักงานที่ต้องการบันทึก" }, { status: 404 });
    }

    console.error("Error saving probation follow-up:", error);
    return NextResponse.json({ error: "ไม่สามารถบันทึกวันที่ติดตามได้" }, { status: 500 });
  }
}
