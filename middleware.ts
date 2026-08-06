import { NextRequest, NextResponse } from "next/server";
import { routeAccess } from "@/lib/crm-route-policy";
import { SALES_PROFILE_COOKIE_NAME, usableAuthSecret, verifySessionTokenEdge } from "@/lib/edge-session";

export async function middleware(request: NextRequest) {
  if (process.env.RDD_AUTH_ENFORCEMENT_ENABLED !== "true") return NextResponse.next();
  const access = routeAccess(request.nextUrl.pathname);
  if (access === "public" || access === "external") return NextResponse.next();

  const secret = usableAuthSecret(process.env);
  if (!secret) {
    return NextResponse.json({ error: "Authentication is not configured" }, { status: 503 });
  }

  const user = await verifySessionTokenEdge(request.cookies.get(SALES_PROFILE_COOKIE_NAME)?.value, secret);
  if (!user) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const login = new URL("/", request.url);
    login.searchParams.set("returnTo", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }
  if (access === "admin" && user.role !== "admin" && user.role !== "super_admin") {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"]
};
