import { NextResponse } from "next/server";
import { getLineGroupName, LineWebhookEvent, verifyLineSignature } from "@/lib/line";
import { saveLineGroup, saveLineWebhookLog } from "@/lib/apps-script";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, message: "Big Car CRM LINE webhook is ready" });
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-line-signature");
  const receivedAt = new Date().toISOString();
  let signatureValid = false;
  let webhookError = "";
  let events: LineWebhookEvent[] = [];
  let sourceSummary = "";

  try {
    signatureValid = verifyLineSignature(body, signature);
  } catch (error) {
    webhookError = error instanceof Error ? error.message : "Unable to verify LINE signature";
  }

  try {
    const payload = JSON.parse(body) as { events?: LineWebhookEvent[] };
    events = Array.isArray(payload.events) ? payload.events : [];
    sourceSummary = events
      .map((event) => {
        const source = event.source;
        return [event.type, source?.type, source?.groupId || source?.roomId || source?.userId].filter(Boolean).join(":");
      })
      .join(", ");
  } catch (error) {
    webhookError = webhookError || (error instanceof Error ? error.message : "Invalid LINE webhook JSON");
  }

  await saveLineWebhookLog({
    receivedAt,
    signatureValid: signatureValid ? "yes" : "no",
    eventCount: String(events.length),
    source: sourceSummary,
    error: webhookError
  }).catch(() => undefined);

  if (!signatureValid) {
    return NextResponse.json({ ok: false, error: "Invalid LINE signature" }, { status: 401 });
  }

  const saved = [];

  for (const event of events) {
    const sourceType = event.source?.type || "";
    const groupId = event.source?.groupId || event.source?.roomId || "";
    if (!groupId || (sourceType !== "group" && sourceType !== "room")) continue;

    const name = sourceType === "group" ? await getLineGroupName(groupId) : "";
    const group = await saveLineGroup({
      groupId,
      type: sourceType,
      name: name || `${sourceType} ${groupId.slice(-6)}`,
      lastSeenAt: new Date().toISOString()
    });
    saved.push(group);
  }

  return NextResponse.json({ ok: true, saved });
}
