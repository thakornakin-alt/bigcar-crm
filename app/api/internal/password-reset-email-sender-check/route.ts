import { NextResponse } from "next/server";
import { createBookingEmailDraft, verifyPasswordResetEmailSenderBoundary } from "@/lib/apps-script";
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
    let bookingDraftBoundary: { reachedSignedContract: boolean; gmailDraftCreated: false; result: string };
    try {
      await createBookingEmailDraft({
        reportId: "preview-boundary-fixture",
        subject: "",
        body: "",
        to: "spoof@example.invalid",
        cc: "spoof@example.invalid",
        bcc: "spoof@example.invalid",
        attachments: []
      });
      bookingDraftBoundary = { reachedSignedContract: false, gmailDraftCreated: false, result: "unexpected_success" };
    } catch (error) {
      const result = error instanceof Error ? error.message : "unknown_error";
      bookingDraftBoundary = {
        reachedSignedContract: result === "Subject and body are required",
        gmailDraftCreated: false,
        result
      };
    }
    const passwordResetReadiness = await getPasswordResetReadiness();
    return NextResponse.json({ ...senderBoundary, bookingDraftBoundary, passwordResetReadiness });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "verification_failed" }, { status: 500 });
  }
}
