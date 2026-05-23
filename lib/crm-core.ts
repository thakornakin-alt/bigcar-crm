export type CrmRole = "super_admin" | "admin" | "sales" | "viewer";

export type CrmPermission =
  | "customers:read:all"
  | "customers:read:own"
  | "customers:write:own"
  | "stock:manage"
  | "reports:read"
  | "export:create"
  | "users:manage"
  | "impersonate:user"
  | "activity:read";

export type CrmUserProfile = {
  id: string;
  firstName: string;
  lastName: string;
  nickname: string;
  phone: string;
  lineId: string;
  lineQrUrl: string;
  avatarUrl: string;
  email: string;
  position: string;
  branch: string;
  role: CrmRole;
  locked?: boolean;
};

export const roleLabels: Record<CrmRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  sales: "Sales",
  viewer: "Viewer"
};

export const rolePermissions: Record<CrmRole, CrmPermission[]> = {
  super_admin: [
    "customers:read:all",
    "customers:write:own",
    "stock:manage",
    "reports:read",
    "export:create",
    "users:manage",
    "impersonate:user",
    "activity:read"
  ],
  admin: ["customers:read:all", "stock:manage", "reports:read", "export:create", "users:manage", "activity:read"],
  sales: ["customers:read:own", "customers:write:own", "reports:read", "export:create"],
  viewer: ["customers:read:own", "reports:read"]
};

export const demoCurrentUser: CrmUserProfile = {
  id: "user-big",
  firstName: "ฐากร",
  lastName: "กาญจนอังกูร",
  nickname: "บิ๊ก",
  phone: "091-778-5117",
  lineId: "@bigcars",
  lineQrUrl: "",
  avatarUrl: "",
  email: "big@bigcar-rdd.local",
  position: "Sales",
  branch: "สาขาบางนา",
  role: "super_admin"
};

export function hasPermission(user: CrmUserProfile | null, permission: CrmPermission) {
  if (!user || user.locked) return false;
  return rolePermissions[user.role]?.includes(permission) ?? false;
}

export function fullName(user: Pick<CrmUserProfile, "firstName" | "lastName">) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
}
