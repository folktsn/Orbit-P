import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { docClient } from "@/lib/dynamodb";
import { GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

export async function GET(request: Request) {
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

    let employeeProfile: any = null;
    let staffId: string | null = null;
    let nickname = lineNickname || "";
    let lineAvatar = "/folk_tsn_avatar.png";

    // 1. Prioritize direct lookup in DynamoDB fullstaff table if lineUserId is provided
    if (lineUserId) {
      try {
        console.log(`Scanning fullstaff DynamoDB table for line_user_id: ${lineUserId}`);
        let startKey: any = undefined;
        let foundItem: any = null;
        
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
            foundItem = scanResponse.Items[0];
            break;
          }
          
          startKey = scanResponse.LastEvaluatedKey;
        } while (startKey);
        
        if (foundItem) {
          employeeProfile = foundItem;
          staffId = employeeProfile.staff_id;
          nickname = employeeProfile.name_en || employeeProfile.first_name_en || lineNickname || "Employee";
          console.log(`Found direct employee by line_user_id: ${nickname} (${staffId})`);
        }
      } catch (dbError) {
        console.error("DynamoDB scan by line_user_id failed:", dbError);
      }
    }

    // 2. If not found in DynamoDB directly, try the SQLite Prisma LineWebhook lookup
    if (!employeeProfile) {
      const webhookConnection = await prisma.lineWebhook.findFirst({
        where: {
          OR: [
            lineUserId ? { lineUserId } : {},
            lineNickname ? { lineNickname } : {},
          ].filter(Boolean) as any,
        },
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
            employeeProfile = dbResponse.Item;
          }
        } catch (dbError) {
          console.warn("DynamoDB get by staffId failed:", dbError);
        }
      }
    }

    // 3. Construct the resolved session user profile
    if (employeeProfile) {
      staffId = employeeProfile.staff_id;
      const position = (employeeProfile.position || "").toLowerCase();
      const resolvedDisplayName = employeeProfile.name_en || 
                                  (employeeProfile.first_name_en ? `${employeeProfile.first_name_en} ${employeeProfile.last_name_en || ''}`.trim() : null) || 
                                  employeeProfile.name_th || 
                                  employeeProfile.name || 
                                  nickname;

      // Extract lineAvatarUrl query parameter if provided from client LIFF login
      const lineAvatarUrl = searchParams.get("lineAvatarUrl");
      if (lineUserId && lineAvatarUrl) {
        try {
          await prisma.lineWebhook.upsert({
            where: { lineUserId: lineUserId },
            update: {
              staffId: staffId || "",
              lineNickname: nickname || employeeProfile.name || "Employee",
              lineAvatar: lineAvatarUrl,
              status: "Linked"
            },
            create: {
              lineUserId: lineUserId,
              staffId: staffId || "",
              lineNickname: nickname || employeeProfile.name || "Employee",
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
      if (employeeProfile.line_avatar_url && employeeProfile.line_avatar_url !== "-" && employeeProfile.line_avatar_url !== "") {
        lineAvatar = employeeProfile.line_avatar_url;
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
      
      let resolvedRole: "admin" | "recruiter" | "hr" = "admin";
      if (position.includes("recruiter") || position.includes("recruitment")) {
        resolvedRole = "recruiter";
      } else if (position.includes("hr") || position.includes("manager") || position.includes("director")) {
        resolvedRole = "hr";
      }

      return NextResponse.json({
        success: true,
        message: "Employee profile successfully resolved from LINE connection!",
        data: {
          username: staffId ? staffId.toLowerCase() : nickname.toLowerCase().replace(/\s+/g, "_"),
          role: resolvedRole,
          displayName: resolvedDisplayName,
          provider: "line",
          lineAvatarUrl: lineAvatar,
          staffId: staffId,
        },
      });
    }

    // 4. Fallback for mock environment if no database link is resolved
    if (lineNickname) {
      let resolvedRole: "admin" | "recruiter" | "hr" = "admin";
      if (lineNickname.toLowerCase().includes("recruit") || lineNickname.toLowerCase().includes("wichai")) {
        resolvedRole = "recruiter";
      } else if (lineNickname.toLowerCase().includes("hr") || lineNickname.toLowerCase().includes("pattama")) {
        resolvedRole = "hr";
      }

      return NextResponse.json({
        success: true,
        message: "Mock employee profile successfully resolved!",
        data: {
          username: lineNickname.toLowerCase().replace(/\s+/g, "_"),
          role: resolvedRole,
          displayName: lineNickname,
          provider: "line",
          lineAvatarUrl: lineAvatar,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: `No Pattaya Aviation employee profile linked to LINE account: ${lineUserId || lineNickname}` },
      { status: 404 }
    );
  } catch (error: any) {
    console.error("Error looking up LINE employee profile:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to resolve LINE profile" },
      { status: 500 }
    );
  }
}
