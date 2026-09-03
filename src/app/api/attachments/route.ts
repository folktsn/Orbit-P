import { NextResponse } from "next/server";
import { getAttachmentDownloadUrl, isS3Key, isAllowedAttachmentKey } from "@/lib/s3";
import { authorizeRequest } from "@/lib/auth-session";

export const runtime = "nodejs";

// Returns a short-lived presigned URL for an employee attachment stored in S3.
// The bucket is private; this is the only way clients get at the file.
export async function GET(request: Request) {
  const authorization = await authorizeRequest(request, "view");
  if (!authorization.ok) return authorization.response;

  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");
    const disposition =
      searchParams.get("disposition") === "attachment" ? "attachment" : "inline";
    const fileName = searchParams.get("name") || undefined;

    if (!key || !isS3Key(key)) {
      return NextResponse.json({ error: "Missing or invalid key" }, { status: 400 });
    }

    // Only ever presign objects inside this app's own prefixes (evaluation/,
    // attachments/). This blocks the endpoint from signing URLs for unrelated
    // bucket objects (e.g. the shared employees/, documents/, payslips/ areas).
    if (!isAllowedAttachmentKey(key)) {
      return NextResponse.json({ error: "Forbidden key prefix" }, { status: 403 });
    }

    const url = await getAttachmentDownloadUrl(key, { disposition, fileName });
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Error presigning attachment:", error);
    return NextResponse.json(
      { error: "Failed to generate download URL" },
      { status: 500 }
    );
  }
}
