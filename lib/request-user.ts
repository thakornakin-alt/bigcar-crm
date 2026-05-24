import { cookies } from "next/headers";
import { salesProfileCookieName, verifySalesProfileToken } from "@/lib/auth-session";
import type { SalesUser } from "@/lib/types";

export function getRequestSalesUser(): SalesUser | null {
  const token = cookies().get(salesProfileCookieName)?.value;
  return verifySalesProfileToken(token);
}

export function canReadAllCustomers(user: SalesUser | null) {
  return user?.role === "super_admin" || user?.role === "admin";
}

export function canAccessCustomerOwner(user: SalesUser | null, ownerId?: string) {
  if (!user) return true;
  if (canReadAllCustomers(user)) return true;
  return Boolean(ownerId) && ownerId === user.id;
}

export function salesUserOwnerName(user: SalesUser) {
  return [user.nickname, user.firstName].filter(Boolean).join(" / ") || user.email;
}
