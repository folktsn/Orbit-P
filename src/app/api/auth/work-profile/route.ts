import { NextResponse } from "next/server";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { getSessionUser } from "@/lib/auth-session";
import { docClient } from "@/lib/dynamodb";
import { toEmployeeWorkProfile, WORK_PROFILE_SOURCE_FIELDS } from "@/lib/employee-work-profile";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401, headers });
  if (!user.staffId) return NextResponse.json({ profile: null }, { headers });

  try {
    // The employee key comes only from the verified session, never request input.
    const result = await docClient.send(new GetCommand({
      TableName: "fullstaff",
      Key: { staff_id: user.staffId },
      ProjectionExpression: WORK_PROFILE_SOURCE_FIELDS.map((_, index) => `#f${index}`).join(", "),
      ExpressionAttributeNames: Object.fromEntries(WORK_PROFILE_SOURCE_FIELDS.map((field, index) => [`#f${index}`, field])),
    }), { abortSignal: AbortSignal.timeout(8_000) });

    return NextResponse.json({ profile: result.Item ? toEmployeeWorkProfile(result.Item) : null }, { headers });
  } catch {
    return NextResponse.json({ error: "Work profile is temporarily unavailable" }, { status: 503, headers });
  }
}
