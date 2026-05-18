import { NextResponse } from "next/server";
import { createSalesEmailDraft } from "@/lib/apps-script";
import type { EmailDraftInput } from "@/lib/types";

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
    const payload = clean(await request.json());
    if (!payload.to || !payload.subject || !payload.body) {
      return NextResponse.json({ error: "To, subject and body are required" }, { status: 400 });
    }

    const result = await createSalesEmailDraft(payload);
    return NextResponse.json({ result }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create Gmail draft" },
      { status: 500 }
    );
  }
}
