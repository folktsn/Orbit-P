export type PermissionKey = "access" | "view" | "edit" | "admin";

export type PermissionSet = Record<PermissionKey, boolean>;

export const DEFAULT_PERMISSIONS: PermissionSet = {
  access: true,
  view: true,
  edit: false,
  admin: false,
};

export const ADMIN_PERMISSIONS: PermissionSet = {
  access: true,
  view: true,
  edit: true,
  admin: true,
};

export const PERMISSION_DEFINITIONS: Array<{
  key: PermissionKey;
  label: string;
  description: string;
}> = [
  { key: "access", label: "Access Permission", description: "สิทธิ์การเข้าถึงระบบ" },
  { key: "edit", label: "Edit Permission", description: "สิทธิ์ในการแก้ไขข้อมูล" },
  { key: "view", label: "View Permission", description: "สิทธิ์ในการดูข้อมูล" },
  { key: "admin", label: "Admin Permission", description: "สิทธิ์ผู้ดูแลระบบ" },
];

export function normalizePermissions(input?: Partial<PermissionSet> | null): PermissionSet {
  const admin = Boolean(input?.admin);
  const edit = admin || Boolean(input?.edit);
  const view = edit || Boolean(input?.view);
  const access = view || Boolean(input?.access);

  return { access, view, edit, admin };
}

export function permissionsForLegacyRole(role?: string): PermissionSet {
  if (role === "admin") return ADMIN_PERMISSIONS;
  if (role === "hr") return normalizePermissions({ edit: true });
  return DEFAULT_PERMISSIONS;
}

export function hasPermission(permissions: PermissionSet | undefined, required: PermissionKey) {
  return Boolean(permissions?.[required]);
}

export const PAGE_DEFINITIONS = [
  { key: "dashboard", name: "Dashboard", href: "/" },
  { key: "organization", name: "Organization", href: "/organization" },
  { key: "manpower", name: "Manpower", href: "/manpower" },
  { key: "employees", name: "Employees", href: "/employees" },
  { key: "dataQuality", name: "Quality", href: "/data-quality" },
  { key: "recruitment", name: "Recruitment", href: "/ats" },
  { key: "probation", name: "Probation", href: "/probation" },
] as const;

export type PageKey = typeof PAGE_DEFINITIONS[number]["key"];
export type PageAccess = Record<PageKey, boolean>;
// Quality requires an explicit Admin grant, including for legacy users.
export const DEFAULT_PAGE_ACCESS = Object.fromEntries(PAGE_DEFINITIONS.map(({ key }) => [key, key !== "dataQuality"])) as PageAccess;

export function isPageAccess(input: unknown): input is PageAccess {
  return Boolean(input && typeof input === "object" && !Array.isArray(input)
    && Object.keys(input).length === PAGE_DEFINITIONS.length
    && PAGE_DEFINITIONS.every(({ key }) => typeof (input as Record<string, unknown>)[key] === "boolean"));
}

export function normalizePageAccess(input?: unknown): PageAccess {
  // Null is the legacy default. Malformed or incomplete explicit grants fail closed.
  if (input === undefined || input === null) return { ...DEFAULT_PAGE_ACCESS };
  let parsed = input;
  if (typeof input === "string") {
    try { parsed = JSON.parse(input); } catch { parsed = {}; }
  }
  const values = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  return Object.fromEntries(PAGE_DEFINITIONS.map(({ key }) => [key, values[key] === true])) as PageAccess;
}

type PageUser = { permissions: PermissionSet; pageAccess?: PageAccess } | null | undefined;

export function hasPageAccess(user: PageUser, page: PageKey | "admin") {
  if (!user?.permissions.access || !user.permissions.view) return false;
  if (user.permissions.admin) return true;
  return page !== "admin" && normalizePageAccess(user.pageAccess)[page];
}

export function pageKeyForPath(pathname: string): PageKey | "admin" | undefined {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  return PAGE_DEFINITIONS.find(({ href }) => pathname === href || href !== "/" && pathname.startsWith(`${href}/`))?.key;
}

export function homePageForUser(user: PageUser) {
  return PAGE_DEFINITIONS.find(({ key }) => hasPageAccess(user, key))?.href || "/";
}

// Shared employee profiles and organization filters remain available to their consuming workflows.
// Never use a caller-provided page name or Referer as authorization evidence.
export function apiPageRequirements(request: Request): readonly PageKey[] {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "");
  const read = request.method === "GET" || request.method === "HEAD";
  const profiles: PageKey[] = ["employees", "probation", "dataQuality"];
  switch (path) {
    case "/api/ats": return ["recruitment"];
    case "/api/probation":
    case "/api/probation/follow-up": return ["probation"];
    case "/api/data-quality":
    case "/api/data-quality/actions": return ["dataQuality"];
    case "/api/manpower/current":
    case "/api/manpower/budgets": return ["manpower"];
    case "/api/organization": return read ? ["organization", "manpower", ...profiles] : [];
    case "/api/organization/update":
    case "/api/organization/reparent":
    case "/api/organization/layout": return ["organization"];
    case "/api/employees":
      return read && (url.searchParams.get("id")?.trim() || url.searchParams.get("view") === "directory") ? profiles : ["employees"];
    case "/api/employees/update":
    case "/api/employees/schedule-adjustment":
    case "/api/employees/document-folders/sync":
    case "/api/attachments":
    case "/api/permissions": return profiles;
    case "/api/auth/line/mappings": return ["organization", ...profiles];
    default: return [];
  }
}
