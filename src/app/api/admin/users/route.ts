import { NextResponse } from "next/server";
import { ScanCommand, type NativeAttributeValue } from "@aws-sdk/lib-dynamodb";
import { authorizeRequest } from "@/lib/auth-session";
import { docClient } from "@/lib/dynamodb";
import { getCachedEmployeeValue, setCachedEmployeeValue } from "@/lib/employeesCache";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PERMISSIONS, normalizePermissions, type PermissionKey } from "@/lib/permissions";

export const runtime = "nodejs";

const DIRECTORY_FIELDS = [
  "staff_id", "name_th", "name_en", "name", "first_name_th", "last_name_th",
  "first_name_en", "last_name_en", "position", "position_th", "position_en",
  "department", "department_th", "department_en", "status", "line_user_id",
];
type DirectoryRecord = Record<string, unknown>;

function text(value: unknown) {
  const result = String(value ?? "").normalize("NFKC").trim();
  return ["", "-", "null", "undefined"].includes(result.toLowerCase()) ? "" : result;
}

async function loadDirectory() {
  const cached = getCachedEmployeeValue<DirectoryRecord[]>("admin:directory");
  if (cached) return cached;

  const names = Object.fromEntries(DIRECTORY_FIELDS.map((field, index) => [`#f${index}`, field]));
  const items: DirectoryRecord[] = [];
  let startKey: Record<string, NativeAttributeValue> | undefined;
  do {
    const response = await docClient.send(new ScanCommand({
      TableName: "fullstaff",
      ProjectionExpression: Object.keys(names).join(", "),
      ExpressionAttributeNames: names,
      ExclusiveStartKey: startKey,
    }));
    items.push(...(response.Items || []));
    startKey = response.LastEvaluatedKey;
  } while (startKey);
  setCachedEmployeeValue("admin:directory", items);
  return items;
}

export async function GET(request: Request) {
  const authorization = await authorizeRequest(request, "admin");
  if (!authorization.ok) return authorization.response;

  const params = new URL(request.url).searchParams;
  const query = text(params.get("q")).slice(0, 160).toLowerCase();
  const permission = params.get("permission") || "all";
  const status = params.get("status") || "active";
  if (!["all", "access", "view", "edit", "admin", "blocked"].includes(permission) || !["all", "active", "inactive"].includes(status)) {
    return NextResponse.json({ error: "Invalid directory filter" }, { status: 400 });
  }
  const requestedPage = Math.max(1, Number.parseInt(params.get("page") || "1", 10) || 1);
  const pageSize = 20;

  try {
    const employees = await loadDirectory();
    // Permission grants are deliberately not cached: changes take effect on the next request.
    const grants = await prisma.permissionGrant.findMany();
    const links = await prisma.lineWebhook.findMany({
      where: { status: "Linked" }, select: { staffId: true },
    });
    const grantsById = new Map(grants.map((grant) => [grant.staffId, grant]));
    const linkedIds = new Set(links.map((link) => link.staffId));
    const directory = employees.filter((employee) => text(employee.staff_id)).map((employee) => {
      const staffId = text(employee.staff_id);
      const grant = grantsById.get(staffId);
      return {
        staffId,
        name: text(employee.name_en) || [text(employee.first_name_en), text(employee.last_name_en)].filter(Boolean).join(" ") || text(employee.name_th) || text(employee.name) || staffId,
        nameTh: text(employee.name_th) || [text(employee.first_name_th), text(employee.last_name_th)].filter(Boolean).join(" "),
        position: text(employee.position_th) || text(employee.position_en) || text(employee.position),
        department: text(employee.department_th) || text(employee.department_en) || text(employee.department),
        status: text(employee.status) || "Unknown",
        linked: Boolean(text(employee.line_user_id) || linkedIds.has(staffId)),
        permissions: grant ? normalizePermissions({
          access: grant.accessPermission, view: grant.viewPermission,
          edit: grant.editPermission, admin: grant.adminPermission,
        }) : DEFAULT_PERMISSIONS,
        isExplicit: Boolean(grant),
      };
    });
    const tokens = query.split(/\s+/).filter(Boolean);
    const filtered = directory.filter((employee) => {
      const active = employee.status.toLowerCase() === "active";
      if (status === "active" && !active || status === "inactive" && active) return false;
      if (permission === "blocked" && employee.permissions.access) return false;
      if (permission !== "all" && permission !== "blocked" && !employee.permissions[permission as PermissionKey]) return false;
      const searchable = [employee.staffId, employee.name, employee.nameTh, employee.position, employee.department].join(" ").toLowerCase();
      return tokens.every((token) => searchable.includes(token));
    }).sort((a, b) => Number(b.permissions.admin) - Number(a.permissions.admin) || a.staffId.localeCompare(b.staffId, "en", { numeric: true }));
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const page = Math.min(requestedPage, totalPages);
    return NextResponse.json({
      users: filtered.slice((page - 1) * pageSize, page * pageSize),
      total: filtered.length, page, totalPages,
      totalEmployees: directory.length,
      totalAdmins: directory.filter((employee) => employee.permissions.admin).length,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to load admin directory:", error);
    return NextResponse.json({ error: "ไม่สามารถโหลดรายชื่อสำหรับจัดการสิทธิ์ได้ กรุณาลองใหม่" }, { status: 503 });
  }
}
