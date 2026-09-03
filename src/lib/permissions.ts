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
