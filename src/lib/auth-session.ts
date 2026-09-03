import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_PERMISSIONS,
  normalizePermissions,
  permissionsForLegacyRole,
  normalizePageAccess,
  hasPageAccess,
  apiPageRequirements,
  type PageAccess,
  type PermissionKey,
  type PermissionSet,
} from "@/lib/permissions";

export const SESSION_COOKIE = "orbithire_auth";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

export type SessionUser = {
  username: string;
  role: "admin" | "recruiter" | "hr" | "employee";
  displayName: string;
  provider: "credentials" | "line";
  lineAvatarUrl?: string;
  staffId?: string;
  permissions: PermissionSet;
  pageAccess?: PageAccess;
};

type SessionPayload = SessionUser & {
  expiresAt: number;
};

type AuthorizationResult =
  | { ok: true; user: SessionUser }
  | { ok: false; response: NextResponse };

function sessionSecret() {
  const secret = process.env.AUTH_SESSION_SECRET || process.env.LINE_CHANNEL_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV !== "production") return "orbithire-local-development-session-secret";
  throw new Error("AUTH_SESSION_SECRET or LINE_CHANNEL_SECRET is required");
}

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function sign(encodedPayload: string) {
  return createHmac("sha256", sessionSecret()).update(encodedPayload).digest("base64url");
}

export function createSessionToken(user: SessionUser) {
  const payload: SessionPayload = {
    ...user,
    permissions: normalizePermissions(user.permissions),
    expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  };
  const encodedPayload = encode(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function setSessionCookie(response: NextResponse, user: SessionUser) {
  response.cookies.set(SESSION_COOKIE, createSessionToken(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}

function readCookie(request: Request, name: string) {
  const header = request.headers.get("cookie") || "";
  for (const item of header.split(";")) {
    const [key, ...value] = item.trim().split("=");
    if (key === name) return value.join("=");
  }
  return null;
}

function verifySessionToken(token?: string | null): SessionPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encodedPayload, suppliedSignature] = parts;
  if (!encodedPayload || !suppliedSignature) return null;

  const expectedSignature = sign(encodedPayload);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.username || !Number.isFinite(payload.expiresAt) || payload.expiresAt <= Date.now()) return null;
    if (process.env.NODE_ENV === "production" && (payload.provider !== "line" || !payload.staffId)) return null;
    return { ...payload, permissions: normalizePermissions(payload.permissions) };
  } catch {
    return null;
  }
}

async function currentAccess(payload: SessionPayload) {
  if (!payload.staffId) return { permissions: permissionsForLegacyRole(payload.role), pageAccess: normalizePageAccess() };

  return resolveAccessForStaff(payload.staffId);
}

export async function resolvePermissionsForStaff(staffId: string) {
  return (await resolveAccessForStaff(staffId)).permissions;
}

async function resolveAccessForStaff(staffId: string) {
  const grant = await prisma.permissionGrant.findUnique({ where: { staffId } });
  if (!grant) return { permissions: DEFAULT_PERMISSIONS, pageAccess: normalizePageAccess() };

  return { permissions: normalizePermissions({
    access: grant.accessPermission,
    view: grant.viewPermission,
    edit: grant.editPermission,
    admin: grant.adminPermission,
  }), pageAccess: normalizePageAccess(grant.pageAccess) };
}

export async function getSessionUser(request: Request): Promise<SessionUser | null> {
  const payload = verifySessionToken(readCookie(request, SESSION_COOKIE));
  if (!payload) return null;
  const { permissions, pageAccess } = await currentAccess(payload);
  if (!permissions.access) return null;

  const { expiresAt: _expiresAt, ...user } = payload;
  void _expiresAt;
  const role = permissions.admin ? "admin" : user.role === "admin" ? "employee" : user.role;
  return { ...user, role, permissions, pageAccess };
}

export async function authorizeRequest(
  request: Request,
  required: PermissionKey,
): Promise<AuthorizationResult> {
  const user = await getSessionUser(request);
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    };
  }
  if (!user.permissions[required]) {
    return {
      ok: false,
      response: NextResponse.json({ error: `Missing ${required} permission` }, { status: 403 }),
    };
  }
  if (!user.permissions.admin && !apiPageRequirements(request).some((page) => hasPageAccess(user, page))) {
    return {
      ok: false,
      response: NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึงข้อมูลของหน้านี้", code: "PAGE_ACCESS_DENIED" }, { status: 403 }),
    };
  }
  return { ok: true, user };
}
