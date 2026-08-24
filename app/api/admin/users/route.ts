import { NextResponse } from "next/server";
import { listSalesUsers, updateSalesUser } from "@/lib/apps-script";
import { setSalesProfileCookie } from "@/lib/auth-session";
import { recordActivity } from "@/lib/activity-log";
import { RequestAuthError, requireAdmin } from "@/lib/request-user";
import type { SalesUserRole } from "@/lib/types";
import { mergeStoredSalesProfile } from "@/lib/sales-profile-store";
import { getAuthCredentialV2 } from "@/lib/auth-credentials-v2";

export const dynamic = "force-dynamic";

const validRoles = new Set(["super_admin", "admin", "sales", "viewer"]);

export async function GET() {
  try {
    await requireAdmin();
    const users = await Promise.all((await listSalesUsers()).map(async (user) => await mergeStoredSalesProfile(user) || user));
    return NextResponse.json({ users });
  } catch (error) {
    if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "โหลดผู้ใช้ไม่สำเร็จ" },
      { status: 403 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const currentUser = await requireAdmin();
    const body = await request.json();
    const role = String(body.role || "") as SalesUserRole;
    const nextUser = await updateSalesUser({
      id: String(body.id || ""),
      role: validRoles.has(role) ? role : undefined,
      locked: typeof body.locked === "boolean" ? body.locked : undefined,
      position: typeof body.position === "string" ? body.position : undefined,
      branch: typeof body.branch === "string" ? body.branch : undefined
    });
    await recordActivity(currentUser, {
      action: "user.update", targetType: "salesUser", targetId: nextUser.id, source: "api",
      after: { role: nextUser.role, locked: nextUser.locked, position: nextUser.position, branch: nextUser.branch }
    });

    const response = NextResponse.json({ user: nextUser });
    if (nextUser.id === currentUser.id) {
      const credential = await getAuthCredentialV2(nextUser.id);
      if (!credential) throw new Error("Credential session unavailable");
      setSalesProfileCookie(response, nextUser, credential.sessionVersion);
    }
    return response;
  } catch (error) {
    if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "อัปเดตผู้ใช้ไม่สำเร็จ" },
      { status: 400 }
    );
  }
}
