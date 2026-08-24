import { NextResponse } from "next/server";
import { listSalesUsers, loginSalesUser } from "@/lib/apps-script";
import { recordActivity } from "@/lib/activity-log";
import { assertAuthConfigured, setSalesProfileCookie } from "@/lib/auth-session";
import { mergeStoredSalesProfile, saveSalesProfile } from "@/lib/sales-profile-store";
import { createAuthCredentialV2IfMissing, getAuthCredentialV2, verifyAuthCredentialV2 } from "@/lib/auth-credentials-v2";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertAuthConfigured();
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const account = (await listSalesUsers()).find((candidate) => String(candidate.email || "").trim().toLowerCase() === email);
    if (!account || account.locked) throw new Error("Invalid credentials");
    const existingCredential = await getAuthCredentialV2(account.id);
    let sourceUser = account;
    let migrated = false;
    if (existingCredential) {
      if (!await verifyAuthCredentialV2(existingCredential, password)) throw new Error("Invalid credentials");
    } else {
      sourceUser = await loginSalesUser({ email, password });
      try {
        const result = await createAuthCredentialV2IfMissing(sourceUser.id, password);
        migrated = result.created;
      } catch (migrationError) {
        console.warn("credential_migration_failed", { userId: sourceUser.id, reason: migrationError instanceof Error ? migrationError.message : "unknown" });
      }
    }
    const user = await mergeStoredSalesProfile(sourceUser) || sourceUser;
    await saveSalesProfile(user);
    const credential = await getAuthCredentialV2(user.id);
    if (!credential) throw new Error("Credential migration unavailable; retry login");
    const response = NextResponse.json({ user });
    setSalesProfileCookie(response, user, credential.sessionVersion);
    if (migrated) {
      await recordActivity(user, { action: "credential_migrated", targetType: "salesUser", targetId: user.id, source: "api" });
    }
    await recordActivity(user, {
      action: "auth.login",
      targetType: "salesUser",
      targetId: user.id,
      detail: user.email,
      source: "api"
    });
    return response;
  } catch (error) {
    console.warn("auth.login.failed", { reason: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json(
      { error: "Email หรือ Password ไม่ถูกต้อง" },
      { status: 401 }
    );
  }
}
