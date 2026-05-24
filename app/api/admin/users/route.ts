import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { listSalesUsers, updateSalesUser } from "@/lib/apps-script";
import { salesProfileCookieName, setSalesProfileCookie, verifySalesProfileToken } from "@/lib/auth-session";
import type { SalesUserRole } from "@/lib/types";

export const dynamic = "force-dynamic";

const adminRoles = new Set(["super_admin", "admin"]);
const validRoles = new Set(["super_admin", "admin", "sales", "viewer"]);

function requireAdmin() {
  const token = cookies().get(salesProfileCookieName)?.value;
  const user = verifySalesProfileToken(token);
  if (!user) throw new Error("กรุณา Login ก่อน");
  if (!adminRoles.has(user.role)) throw new Error("ไม่มีสิทธิ์เข้าถึง Admin");
  return user;
}

export async function GET() {
  try {
    requireAdmin();
    const users = await listSalesUsers();
    return NextResponse.json({ users });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "โหลดผู้ใช้ไม่สำเร็จ" },
      { status: 403 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const currentUser = requireAdmin();
    const body = await request.json();
    const role = String(body.role || "") as SalesUserRole;
    const nextUser = await updateSalesUser({
      id: String(body.id || ""),
      role: validRoles.has(role) ? role : undefined,
      locked: typeof body.locked === "boolean" ? body.locked : undefined,
      position: typeof body.position === "string" ? body.position : undefined,
      branch: typeof body.branch === "string" ? body.branch : undefined
    });

    const response = NextResponse.json({ user: nextUser });
    if (nextUser.id === currentUser.id) setSalesProfileCookie(response, nextUser);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "อัปเดตผู้ใช้ไม่สำเร็จ" },
      { status: 400 }
    );
  }
}
