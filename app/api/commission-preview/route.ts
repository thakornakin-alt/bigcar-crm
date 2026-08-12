import { NextResponse } from "next/server";
import { getRddFeatureFlags } from "@/lib/feature-flags";
import { RequestAuthError, requireAdmin, requireWritableUser } from "@/lib/request-user";
import { addIsolatedAdjustment, closeIsolatedStatement, commissionIsolatedView, disposeIsolatedCase, recognizeIsolatedCase, reverseIsolatedSnapshot } from "@/lib/commission-persistence";
import { commissionCandidateFixtureReadiness } from "@/lib/commission-candidate-fixtures";

export const dynamic = "force-dynamic";

function previewView() {
  return { ...commissionIsolatedView(), candidateReadiness: commissionCandidateFixtureReadiness(), canonicalDataVerified: false };
}

export async function GET() {
  try {
    requireWritableUser();
    if (!getRddFeatureFlags().commissionPreview) return NextResponse.json({ error: "Commission Preview ปิดอยู่" }, { status: 404 });
    return NextResponse.json(previewView());
  } catch (error) {
    if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "อ่าน Commission Preview ไม่สำเร็จ" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!getRddFeatureFlags().commissionPreview) return NextResponse.json({ error: "Commission Preview ปิดอยู่" }, { status: 404 });
    const body = await request.json() as Record<string, unknown>;
    const actor = body.action === "adjust" || body.action === "reverse" ? requireAdmin() : requireWritableUser();
    const now = new Date().toISOString();
    let result: unknown;
    if (body.action === "recognize") result = recognizeIsolatedCase({ bookingCaseId: String(body.bookingCaseId || ""), method: body.method === "manual_cutoff" ? "manual_cutoff" : "delivered", recognizedMonth: String(body.recognizedMonth || "2026-08"), actorUserId: actor.id, now });
    else if (body.action === "carry_forward" || body.action === "do_not_carry") result = disposeIsolatedCase({ bookingCaseId: String(body.bookingCaseId || ""), sourceMonth: String(body.sourceMonth || ""), action: body.action, reason: body.reason as "cancelled" | "customer_paused" | "other" | undefined, actorUserId: actor.id, now });
    else if (body.action === "adjust") result = addIsolatedAdjustment({ snapshotId: String(body.snapshotId || ""), amount: Number(body.amount), reason: String(body.reason || ""), actorUserId: actor.id, now });
    else if (body.action === "reverse") result = reverseIsolatedSnapshot({ snapshotId: String(body.snapshotId || ""), reason: String(body.reason || ""), actorUserId: actor.id, now });
    else if (body.action === "close_statement") result = closeIsolatedStatement({ salespersonUserId: String(body.salespersonUserId || ""), month: String(body.month || "2026-08"), actorUserId: actor.id, now });
    else return NextResponse.json({ error: "Action ไม่ถูกต้อง" }, { status: 400 });
    return NextResponse.json({ result, view: previewView() });
  } catch (error) {
    if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "บันทึก fixture ไม่สำเร็จ" }, { status: 400 });
  }
}
