import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  getSessionUser,
  setSessionCookie,
  type SessionUser,
} from "@/lib/auth-session";
import { permissionsForLegacyRole } from "@/lib/permissions";

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, user }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Staff Login is available in local development only" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const username = String(body.username || "").trim().toLowerCase();
  const role = String(body.role || "");
  if (!username || !["admin", "recruiter", "hr"].includes(role)) {
    return NextResponse.json({ error: "Invalid local session" }, { status: 400 });
  }

  const displayNames = { admin: "Administrator", recruiter: "Senior Recruiter", hr: "HR Manager" };
  const user: SessionUser = {
    username,
    role: role as SessionUser["role"],
    displayName: displayNames[role as keyof typeof displayNames],
    provider: "credentials",
    permissions: permissionsForLegacyRole(role),
  };
  return setSessionCookie(NextResponse.json({ authenticated: true, user }), user);
}

export async function DELETE() {
  return clearSessionCookie(NextResponse.json({ success: true }));
}
