import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { docClient } from "@/lib/dynamodb";
import { GetCommand, ScanCommand, type NativeAttributeValue } from "@aws-sdk/lib-dynamodb";
import { resolvePermissionsForStaff, setSessionCookie, type SessionUser } from "@/lib/auth-session";
import { DEFAULT_PERMISSIONS } from "@/lib/permissions";

function isMeaningfulValue(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized !== "" && normalized !== "-" && normalized !== "null" && normalized !== "undefined";
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return value === undefined || value === null ? "" : String(value).trim();
}

function getAccessRestriction(employee: Record<string, unknown>) {
  const statuses = [employee.status, employee.resign_status]
    .map((value) => String(value ?? "").trim().toLowerCase());

  if (statuses.includes("pending")) {
    return "Pending";
  }

  const hasResignationStatus = statuses.some((status) => status.includes("resign"));
  const hasResignationDate = [
    employee.resign_date,
    employee.last_working_date,
    employee.last_work_date,
    employee.separation_date,
  ].some(isMeaningfulValue);

  return hasResignationStatus || hasResignationDate ? "Resigning" : null;
}

type LineAccessVerification = {
  client_id?: string;
  expires_in?: number;
};

type VerifiedLineIdentity = {
  userId: string;
  displayName?: string;
  pictureUrl?: string;
};

async function verifyLineIdentity(accessToken: string): Promise<VerifiedLineIdentity | null> {
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID || process.env.LINE_CHANNEL_ID;
  if (!channelId || !accessToken) return null;

  const verificationResponse = await fetch(
    `https://api.line.me/oauth2/v2.1/verify?access_token=${encodeURIComponent(accessToken)}`,
    { cache: "no-store", signal: AbortSignal.timeout(10_000) },
  );
  if (!verificationResponse.ok) return null;
  const verification = await verificationResponse.json() as LineAccessVerification;
  if (verification.client_id !== channelId || Number(verification.expires_in || 0) <= 0) return null;

  const profileResponse = await fetch("https://api.line.me/v2/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!profileResponse.ok) return null;
  const identity = await profileResponse.json() as VerifiedLineIdentity;
  return /^U[0-9a-f]{32}$/.test(identity.userId) ? identity : null;
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin && new URL(origin).host !== new URL(request.url).host) {
    return NextResponse.json({ success: false, error: "Invalid login origin" }, { status: 403 });
  }
  if (!(process.env.LINE_LOGIN_CHANNEL_ID || process.env.LINE_CHANNEL_ID)) {
    return NextResponse.json({ success: false, error: "LINE Login channel is not configured" }, { status: 503 });
  }
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  let identity: VerifiedLineIdentity | null;
  try {
    identity = await verifyLineIdentity(String(body.accessToken || ""));
  } catch {
    return NextResponse.json({ success: false, error: "LINE verification is temporarily unavailable" }, { status: 503 });
  }
  if (!identity) {
    return NextResponse.json({ success: false, error: "LINE identity verification failed" }, { status: 401 });
  }

  const lookupUrl = new URL(request.url);
  lookupUrl.search = "";
  lookupUrl.searchParams.set("lineUserId", identity.userId);
  if (identity.displayName) lookupUrl.searchParams.set("lineNickname", identity.displayName);
  if (identity.pictureUrl) lookupUrl.searchParams.set("lineAvatarUrl", identity.pictureUrl);
  return resolveLineProfile(new Request(lookupUrl, { headers: request.headers }));
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { success: false, error: "Direct LINE User ID lookup is disabled in production" },
      { status: 403 }
    );
  }
  return resolveLineProfile(request);
}

async function resolveLineProfile(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lineNickname = searchParams.get("lineNickname");
    const lineUserId = searchParams.get("lineUserId");

    if (!lineNickname && !lineUserId) {
      return NextResponse.json(
        { success: false, error: "Missing lineNickname or lineUserId query parameter" },
        { status: 400 }
      );
    }

    let employeeProfile: Record<string, unknown> | null = null;
    let staffId: string | null = null;
    let nickname = lineNickname || "";
    let lineAvatar = "/folk_tsn_avatar.png";

    // 1. Prioritize direct lookup in DynamoDB fullstaff table if lineUserId is provided
    if (lineUserId) {
      try {
        let startKey: Record<string, NativeAttributeValue> | undefined;
        let foundItem: Record<string, unknown> | null = null;
        
        do {
          const scanResponse = await docClient.send(
            new ScanCommand({
              TableName: "fullstaff",
              FilterExpression: "line_user_id = :line_user_id",
              ExpressionAttributeValues: {
                ":line_user_id": lineUserId,
              },
              ExclusiveStartKey: startKey,
            })
          );
          
          if (scanResponse.Items && scanResponse.Items.length > 0) {
            if (foundItem || scanResponse.Items.length > 1) {
              return NextResponse.json({ success: false, error: "LINE account is linked to multiple employees; contact an administrator" }, { status: 409 });
            }
            foundItem = scanResponse.Items[0] as Record<string, unknown>;
          }
          
          startKey = scanResponse.LastEvaluatedKey;
        } while (startKey);
        
        if (foundItem) {
          employeeProfile = foundItem;
          staffId = readString(employeeProfile, "staff_id") || null;
          nickname = readString(employeeProfile, "name_en") || readString(employeeProfile, "first_name_en") || lineNickname || "Employee";
        }
      } catch (dbError) {
        console.error("DynamoDB scan by line_user_id failed:", dbError);
        return NextResponse.json({ success: false, error: "Employee identity lookup is temporarily unavailable" }, { status: 503 });
      }
    }

    // 2. If not found in DynamoDB directly, try the SQLite Prisma LineWebhook lookup
    if (!employeeProfile && lineUserId) {
      const webhookConnection = await prisma.lineWebhook.findFirst({
        where: { lineUserId, status: "Linked" },
      });

      if (webhookConnection) {
        staffId = webhookConnection.staffId;
        nickname = webhookConnection.lineNickname;
        lineAvatar = webhookConnection.lineAvatar || "/folk_tsn_avatar.png";

        // Fetch details from DynamoDB
        try {
          const dbResponse = await docClient.send(
            new GetCommand({
              TableName: "fullstaff",
              Key: { staff_id: staffId },
            })
          );
          if (dbResponse.Item) {
            const linkedEmployee = dbResponse.Item as Record<string, unknown>;
            const currentLineId = readString(linkedEmployee, "line_user_id");
            if (!isMeaningfulValue(currentLineId) || currentLineId === lineUserId) {
              employeeProfile = linkedEmployee;
            }
          }
        } catch (dbError) {
          console.warn("DynamoDB get by staffId failed:", dbError);
        }
      }
    }

    // 3. Construct the resolved session user profile
    if (employeeProfile) {
      staffId = readString(employeeProfile, "staff_id") || staffId;
      const accessRestriction = getAccessRestriction(employeeProfile);

      if (accessRestriction) {
        return NextResponse.json(
          {
            success: false,
            accessDenied: true,
            error: `ไม่อนุญาตให้เข้าใช้งานระบบสำหรับพนักงานสถานะ ${accessRestriction}`,
          },
          { status: 403 }
        );
      }

      const position = readString(employeeProfile, "position").toLowerCase();
      const firstNameEn = readString(employeeProfile, "first_name_en");
      const resolvedDisplayName = readString(employeeProfile, "name_en") ||
                                  (firstNameEn ? `${firstNameEn} ${readString(employeeProfile, "last_name_en")}`.trim() : "") ||
                                  readString(employeeProfile, "name_th") ||
                                  readString(employeeProfile, "name") ||
                                  nickname;

      // Extract lineAvatarUrl query parameter if provided from client LIFF login
      const lineAvatarUrl = searchParams.get("lineAvatarUrl");
      if (lineUserId && lineAvatarUrl) {
        try {
          await prisma.lineWebhook.upsert({
            where: { lineUserId: lineUserId },
            update: {
              staffId: staffId || "",
              lineNickname: nickname || readString(employeeProfile, "name") || "Employee",
              lineAvatar: lineAvatarUrl,
              status: "Linked"
            },
            create: {
              lineUserId: lineUserId,
              staffId: staffId || "",
              lineNickname: nickname || readString(employeeProfile, "name") || "Employee",
              lineAvatar: lineAvatarUrl,
              status: "Linked"
            }
          });
          lineAvatar = lineAvatarUrl;
        } catch (upsertError) {
          console.error("Failed to upsert LINE webhook mapping in SQLite:", upsertError);
        }
      }

      // Prioritize the DynamoDB custom line_avatar_url if it exists
      const employeeAvatar = readString(employeeProfile, "line_avatar_url");
      if (employeeAvatar && employeeAvatar !== "-") {
        lineAvatar = employeeAvatar;
      }

      // Try to find if there's an avatar in SQLite mappings for this staffId
      if (staffId && lineAvatar === "/folk_tsn_avatar.png") {
        const localWebhook = await prisma.lineWebhook.findFirst({
          where: { staffId: staffId }
        });
        if (localWebhook && localWebhook.lineAvatar) {
          lineAvatar = localWebhook.lineAvatar;
        } else {
          // If no local webhook avatar exists, check by lineUserId
          const localWebhookByUid = lineUserId ? await prisma.lineWebhook.findUnique({
            where: { lineUserId: lineUserId }
          }) : null;
          if (localWebhookByUid && localWebhookByUid.lineAvatar) {
            lineAvatar = localWebhookByUid.lineAvatar;
          } else {
            // Generate a beautiful Dicebear avatar dynamically based on their English/Thai name!
            lineAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(resolvedDisplayName)}`;
          }
        }
      }
      
      let resolvedRole: SessionUser["role"] = "employee";
      if (position.includes("recruiter") || position.includes("recruitment")) {
        resolvedRole = "recruiter";
      } else if (position.includes("hr") || position.includes("manager") || position.includes("director")) {
        resolvedRole = "hr";
      }

      const permissions = staffId
        ? await resolvePermissionsForStaff(staffId)
        : DEFAULT_PERMISSIONS;

      if (!permissions.access) {
        return NextResponse.json(
          { success: false, accessDenied: true, error: "บัญชีนี้ยังไม่มีสิทธิ์เข้าถึงระบบ" },
          { status: 403 }
        );
      }
      if (permissions.admin) resolvedRole = "admin";

      const sessionUser: SessionUser = {
        username: staffId ? staffId.toLowerCase() : nickname.toLowerCase().replace(/\s+/g, "_"),
        role: resolvedRole,
        displayName: resolvedDisplayName,
        provider: "line",
        lineAvatarUrl: lineAvatar,
        staffId: staffId || undefined,
        permissions,
      };
      const response = NextResponse.json({
        success: true,
        message: "Employee profile successfully resolved from LINE connection!",
        data: sessionUser,
      });
      return setSessionCookie(response, sessionUser);
    }

    // 4. Fallback for mock environment if no database link is resolved
    if (lineNickname && process.env.NODE_ENV !== "production") {
      let resolvedRole: SessionUser["role"] = "employee";
      if (lineNickname.toLowerCase().includes("recruit") || lineNickname.toLowerCase().includes("wichai")) {
        resolvedRole = "recruiter";
      } else if (lineNickname.toLowerCase().includes("hr") || lineNickname.toLowerCase().includes("pattama")) {
        resolvedRole = "hr";
      }

      const sessionUser: SessionUser = {
        username: lineNickname.toLowerCase().replace(/\s+/g, "_"),
        role: resolvedRole,
        displayName: lineNickname,
        provider: "line",
        lineAvatarUrl: lineAvatar,
        permissions: DEFAULT_PERMISSIONS,
      };
      return setSessionCookie(NextResponse.json({
        success: true,
        message: "Mock employee profile successfully resolved!",
        data: sessionUser,
      }), sessionUser);
    }

    return NextResponse.json(
      { success: false, error: `No Pattaya Aviation employee profile linked to LINE account: ${lineUserId || lineNickname}` },
      { status: 404 }
    );
  } catch (error: unknown) {
    console.error("Error looking up LINE employee profile:", error);
    return NextResponse.json(
      { success: false, error: "Failed to resolve LINE profile" },
      { status: 500 }
    );
  }
}
