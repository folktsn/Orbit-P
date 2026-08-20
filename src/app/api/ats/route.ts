import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const candidates = await prisma.candidateProfile.findMany({
      include: {
        job: true,
      },
    });

    // Translate database status to UI columns
    const mapped = candidates.map((c) => {
      let uiStatus = "สมัครแล้ว";
      if (c.status === "Screening") uiStatus = "คัดกรอง";
      else if (c.status === "Interview") uiStatus = "สัมภาษณ์";
      else if (c.status === "Hired") uiStatus = "จ้างงาน";

      return {
        id: c.id,
        name: c.name,
        email: c.email,
        role: c.job.title,
        score: c.aiScore,
        skills: c.skills ? c.skills.split(",").map((s) => s.trim()) : [],
        status: uiStatus,
      };
    });

    return NextResponse.json({ success: true, candidates: mapped });
  } catch (error: any) {
    console.error("GET /api/ats error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, status } = await request.json();

    // Map UI column status to database status
    let dbStatus = "Applied";
    if (status === "คัดกรอง") dbStatus = "Screening";
    else if (status === "สัมภาษณ์") dbStatus = "Interview";
    else if (status === "จ้างงาน") dbStatus = "Hired";

    const updated = await prisma.candidateProfile.update({
      where: { id },
      data: {
        status: dbStatus,
      },
    });

    return NextResponse.json({ success: true, candidate: updated });
  } catch (error: any) {
    console.error("PATCH /api/ats error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
