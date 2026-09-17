import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/auth-session";
import { readCompanyHeadcount } from "@/lib/company-headcount";
import { createHeadcountStream } from "@/lib/headcount-stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, no-transform" };

export async function GET(request: Request) {
  const authorization = await authorizeRequest(request, "view");
  if (!authorization.ok) return authorization.response;

  if (new URL(request.url).searchParams.get("stream") === "1") {
    return new Response(createHeadcountStream(request.signal), {
      headers: { ...headers, "Content-Type": "text/event-stream", "X-Accel-Buffering": "no" },
    });
  }
  try { return NextResponse.json(await readCompanyHeadcount(), { headers }); }
  catch { return NextResponse.json({ error: "Headcount temporarily unavailable" }, { status: 503, headers }); }
}
