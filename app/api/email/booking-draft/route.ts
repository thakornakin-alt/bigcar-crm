import { NextResponse } from "next/server";
import { createBookingEmailDraft } from "@/lib/apps-script";
import type { EmailDraftInput } from "@/lib/types";
import { requireWritableUser, RequestAuthError } from "@/lib/request-user";
import { maskEmail, resolveEmailRoute } from "@/lib/email-routing";
import { finalizeNotification, notificationFingerprint, notificationKey, reserveNotification } from "@/lib/email-notification-idempotency";

export const dynamic = "force-dynamic";

function clean(body: Partial<EmailDraftInput>): EmailDraftInput {
  return {
    reportId: String(body.reportId || "").trim(),
    subject: String(body.subject || "").trim(),
    to: String(body.to || "").trim(),
    cc: String(body.cc || "").trim(),
    bcc: String(body.bcc || "").trim(),
    body: String(body.body || "").trim(),
    attachments: Array.isArray(body.attachments)
      ? body.attachments
          .map((attachment) => ({
            fileId: String(attachment.fileId || "").trim(),
            name: String(attachment.name || "").trim()
          }))
          .filter((attachment) => attachment.fileId)
      : []
  };
}

export async function POST(request: Request) {
  try {
    await requireWritableUser();
    const payload = clean(await request.json());
    if (!payload.reportId || !payload.subject || !payload.body) return NextResponse.json({ error: "Report, subject and body are required" }, { status: 400 });
    const route = await resolveEmailRoute({ eventType: "booking_report_draft", entityId: payload.reportId });
    if (route.status !== "resolved" || !route.recipient) return NextResponse.json({ error: "unresolved_email_route", reason: route.reason }, { status: 409 });
    payload.to = route.recipient.to;
    payload.cc = route.recipient.cc;
    payload.bcc = route.recipient.bcc;
    const key = notificationKey(route.eventType, payload.reportId, payload.to);
    const reservation = await reserveNotification(key, notificationFingerprint(payload));
    if (!reservation.created && reservation.record.status === "sent") return NextResponse.json({ result: reservation.record.result, idempotentReplay: true }, { status: 200 });
    if (!reservation.created && reservation.record.status === "pending") return NextResponse.json({ error: "email_notification_pending" }, { status: 409 });

    try {
      const result = await createBookingEmailDraft(payload);
      await finalizeNotification(key, "sent", result);
      return NextResponse.json({ result, route: { owner: route.ownerDisplayName, email: maskEmail(route.ownerEmail) } }, { status: 201 });
    } catch (error) {
      await finalizeNotification(key, "failed");
      throw error;
    }
  } catch (error) {
    if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    const message = error instanceof Error ? error.message : "Unable to create Gmail draft";
    const status = message.includes("ไม่สามารถเชื่อมต่อ Google Apps Script ได้") ? 503 : 500;
    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}
