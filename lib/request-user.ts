import { cookies } from "next/headers";
import { salesProfileCookieName, verifySalesProfileToken } from "@/lib/auth-session";
import type { SalesUser } from "@/lib/types";

export class RequestAuthError extends Error {
  constructor(public status: 401 | 403, message: string) {
    super(message);
    this.name = "RequestAuthError";
  }
}

export function getRequestSalesUser(): SalesUser | null {
  const token = cookies().get(salesProfileCookieName)?.value;
  return verifySalesProfileToken(token);
}

export function requireUser() {
  const user = getRequestSalesUser();
  if (!user) throw new RequestAuthError(401, "Authentication required");
  if (user.locked) throw new RequestAuthError(403, "User account is locked");
  return user;
}

export function requireWritableUser() {
  const user = requireUser();
  if (user.role === "viewer") throw new RequestAuthError(403, "Read-only account");
  return user;
}

export function requireAdmin() {
  const user = requireUser();
  if (user.role !== "admin" && user.role !== "super_admin") {
    throw new RequestAuthError(403, "Admin access required");
  }
  return user;
}

export function canReadAllCustomers(user: SalesUser | null) {
  return user?.role === "super_admin" || user?.role === "admin";
}

export function canAccessCustomerOwner(user: SalesUser | null, ownerId?: string) {
  if (!user) return false;
  if (user.role === "viewer") return false;
  return true;
}

export function salesUserOwnerName(user: SalesUser) {
  return [user.nickname, user.firstName].filter(Boolean).join(" / ") || user.email;
}
