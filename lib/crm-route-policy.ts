export type RouteAccess = "public" | "authenticated" | "admin" | "external";

const PUBLIC_PAGES = [
  "/", "/auth", "/forgot-password", "/reset-password", "/cars", "/articles", "/contact", "/showroom", "/locations",
  "/why-us", "/lease-return-cars"
];

const ADMIN_PAGES = ["/admin"];
const ADMIN_APIS = [
  "/api/admin", "/api/activity/logs", "/api/system/export", "/api/system/restore",
  "/api/system/reset-user-data", "/api/system/storage-status"
];
const PUBLIC_APIS = ["/api/auth/login", "/api/auth/me", "/api/auth/forgot-password", "/api/auth/reset-password", "/api/site-admin/login"];
const EXTERNAL_APIS = [
  "/api/line/webhook",
  "/api/realtime-booking/gmail-oauth/callback",
  "/api/realtime-booking/gmail-webhook",
  "/api/internal/password-reset-email-sender-check"
];

function matches(pathname: string, prefix: string) {
  return pathname === prefix || (prefix !== "/" && pathname.startsWith(`${prefix}/`));
}

export function routeAccess(pathname: string): RouteAccess {
  if (EXTERNAL_APIS.some((path) => matches(pathname, path))) return "external";
  if (PUBLIC_APIS.some((path) => matches(pathname, path))) return "public";
  if (ADMIN_APIS.some((path) => matches(pathname, path))) return "admin";
  if (pathname === "/api/auth/register") return "admin";
  if (pathname.startsWith("/api/")) return "authenticated";
  if (ADMIN_PAGES.some((path) => matches(pathname, path))) return "admin";
  if (PUBLIC_PAGES.some((path) => matches(pathname, path))) return "public";
  return "authenticated";
}

export function isPublicWebsitePath(pathname: string) {
  return routeAccess(pathname) === "public" && !pathname.startsWith("/api/");
}
