import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Clean existing webhooks first to ensure clean state
    await prisma.lineWebhook.deleteMany({});

    const seeds = [
      {
        lineUserId: "folk_tsn_line_id",
        lineNickname: "FOLK.TSN",
        staffId: "01001", // Administrator / Director Staff ID
        lineAvatar: "/folk_tsn_avatar.png",
        status: "Linked",
      },
      {
        lineUserId: "somchai_pattaya_line_id",
        lineNickname: "Somchai Pattaya",
        staffId: "05592", // Active Employee on Probation in fullstaff
        lineAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
        status: "Linked",
      },
      {
        lineUserId: "wichai_recruit_line_id",
        lineNickname: "Wichai Recruit",
        staffId: "02241", // Recruiter Staff ID
        lineAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
        status: "Linked",
      },
      {
        lineUserId: "pattama_hr_line_id",
        lineNickname: "Pattama HR",
        staffId: "01183", // HR Manager Staff ID
        lineAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
        status: "Linked",
      },
    ];

    const createdWebhooks = [];
    for (const seed of seeds) {
      const webhook = await prisma.lineWebhook.create({
        data: seed,
      });
      createdWebhooks.push(webhook);
    }

    return NextResponse.json({
      success: true,
      message: "LINE Webhooks seeded successfully in SQLite database",
      data: createdWebhooks,
    });
  } catch (error: any) {
    console.error("Error seeding LINE Webhook data:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to seed LINE webhooks",
      },
      { status: 500 }
    );
  }
}
