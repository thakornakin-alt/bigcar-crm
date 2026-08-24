import { NextResponse } from "next/server";
import { verifyPasswordResetEmailSenderBoundary } from "@/lib/apps-script";
import { getPasswordResetReadiness } from "@/lib/password-reset";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ error: "not_available" }, { status: 404 });
  }
  const origin = `https://${String(process.env.VERCEL_URL || "")}`;
  if (!/^https:\/\/(?:bigcar|bigcar-crm)-[a-z0-9-]+-thakornakin-8081s-projects\.vercel\.app$/i.test(origin)) {
    return NextResponse.json({ error: "invalid_preview_origin" }, { status: 500 });
  }
  try {
    const senderBoundary = await verifyPasswordResetEmailSenderBoundary(origin);
    const passwordResetReadiness = await getPasswordResetReadiness();
    return NextResponse.json({ ...senderBoundary, passwordResetReadiness });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "verification_failed" }, { status: 500 });
  }
}
