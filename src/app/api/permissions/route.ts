import { NextResponse } from "next/server";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { authorizeRequest } from "@/lib/auth-session";
import { docClient } from "@/lib/dynamodb";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PERMISSIONS, normalizePermissions } from "@/lib/permissions";

function cleanStaffId(value: unknown) {
  return String(value || "").normalize("NFKC").trim().slice(0, 80);
}

export async function GET(request: Request) {
  const authorization = await authorizeRequest(request, "view");
  if (!authorization.ok) return authorization.response;

  const staffId = cleanStaffId(new URL(request.url).searchParams.get("staffId"));
  if (!staffId) return NextResponse.json({ error: "Staff ID is required" }, { status: 400 });

  const grant = await prisma.permissionGrant.findUnique({ where: { staffId } });
  const permissions = grant ? normalizePermissions({
    access: grant.accessPermission,
    view: grant.viewPermission,
    edit: grant.editPermission,
    admin: grant.adminPermission,
  }) : DEFAULT_PERMISSIONS;

  return NextResponse.json({
    staffId,
    permissions,
    isExplicit: Boolean(grant),
    updatedAt: grant?.updatedAt.toISOString() || null,
    updatedBy: grant ? { id: grant.updatedById, name: grant.updatedByName } : null,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const authorization = await authorizeRequest(request, "admin");
  if (!authorization.ok) return authorization.response;

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const staffId = cleanStaffId(body.staffId);
  if (!staffId) return NextResponse.json({ error: "Staff ID is required" }, { status: 400 });

  const raw = body.permissions && typeof body.permissions === "object"
    ? body.permissions as Record<string, unknown>
    : {};
  if (!["access", "view", "edit", "admin"].every((key) => typeof raw[key] === "boolean")) {
    return NextResponse.json({ error: "All four permission values are required" }, { status: 400 });
  }
  const permissions = normalizePermissions({
    access: raw.access === true,
    view: raw.view === true,
    edit: raw.edit === true,
    admin: raw.admin === true,
  });

  try {
    const employee = await docClient.send(new GetCommand({
      TableName: "fullstaff", Key: { staff_id: staffId },
      ProjectionExpression: "staff_id",
    }));
    if (!employee.Item) {
      return NextResponse.json({ error: "ไม่พบรหัสพนักงานนี้ในระบบ" }, { status: 404 });
    }
  } catch (error) {
    console.error("Failed to verify permission target:", error);
    return NextResponse.json({ error: "ไม่สามารถตรวจสอบรหัสพนักงานได้ กรุณาลองใหม่" }, { status: 503 });
  }

  const grant = await prisma.$transaction(async (tx) => {
    const current = await tx.permissionGrant.findUnique({ where: { staffId } });
    if (current?.adminPermission && !permissions.admin) {
      const adminCount = await tx.permissionGrant.count({ where: { adminPermission: true } });
      if (adminCount <= 1) return null;
    }
    return tx.permissionGrant.upsert({
      where: { staffId },
      create: {
        staffId,
        accessPermission: permissions.access,
        viewPermission: permissions.view,
        editPermission: permissions.edit,
        adminPermission: permissions.admin,
        updatedById: authorization.user.staffId || authorization.user.username,
        updatedByName: authorization.user.displayName,
      },
      update: {
        accessPermission: permissions.access,
        viewPermission: permissions.view,
        editPermission: permissions.edit,
        adminPermission: permissions.admin,
        updatedById: authorization.user.staffId || authorization.user.username,
        updatedByName: authorization.user.displayName,
      },
    });
  });
  if (!grant) {
    return NextResponse.json({ error: "ไม่สามารถถอดสิทธิ์ Admin คนสุดท้ายได้ กรุณากำหนด Admin คนอื่นก่อน" }, { status: 409 });
  }

  return NextResponse.json({
    staffId,
    permissions,
    updatedAt: grant.updatedAt.toISOString(),
    updatedBy: { id: grant.updatedById, name: grant.updatedByName },
  }, { headers: { "Cache-Control": "no-store" } });
}
