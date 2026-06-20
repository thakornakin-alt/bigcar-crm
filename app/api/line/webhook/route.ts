import { NextResponse } from "next/server";
import { LineWebhookEvent, verifyLineSignature } from "@/lib/line";
import { saveLineGroup, saveLineWebhookLog } from "@/lib/apps-script";
import { applyLineReservationCommand } from "@/lib/line-reservations";

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

  void saveLineWebhookLog({
    receivedAt,
    signatureValid: signatureValid ? "yes" : "no",
    eventCount: String(events.length),
    source: sourceSummary,
    error: webhookError
  }).catch(() => undefined);

  if (!signatureValid) {
    return NextResponse.json({ ok: false, error: "Invalid LINE signature" }, { status: 401 });
  }

  const groupsToSave = events
    .map((event) => {
      const sourceType = event.source?.type || "";
      const groupId = event.source?.groupId || event.source?.roomId || "";
      if (!groupId || (sourceType !== "group" && sourceType !== "room")) return null;
      return {
        groupId,
        type: sourceType,
        name: `${sourceType} ${groupId.slice(-6)}`,
        lastSeenAt: new Date().toISOString()
      };
    })
    .filter((group): group is { groupId: string; type: string; name: string; lastSeenAt: string } => Boolean(group));

  void Promise.all(groupsToSave.map((group) => saveLineGroup(group))).catch(() => undefined);

  const reservationTraces: Array<{
    text: string;
    action: string;
    plate: string;
    plateNormalized: string;
    writeSuccess: boolean;
  }> = [];

  for (const event of events) {
    const messageText = String(event.message?.text || "").trim();
    if (!messageText) continue;
    const sourceGroupId = event.source?.groupId || event.source?.roomId || "";
    const result = await applyLineReservationCommand({
      text: messageText,
      sourceGroupId,
      receivedAt: new Date().toISOString()
    }).catch((error) => {
      console.log(
        "[line-reservation-trace]",
        JSON.stringify({
          text: messageText.slice(0, 80),
          action: "error",
          plate: "",
          plateNormalized: "",
          writeSuccess: false,
          error: error instanceof Error ? error.message : "Unknown error"
        })
      );
      return null;
    });

    if (result) {
      reservationTraces.push({
        text: messageText.slice(0, 80),
        action: result.action,
        plate: result.plate.slice(0, 40),
        plateNormalized: result.plateNormalized,
        writeSuccess: result.writeSuccess
      });
    }
  }

  for (const trace of reservationTraces) {
    console.log("[line-reservation-trace]", JSON.stringify(trace));
  }

  return NextResponse.json({ ok: true, queued: groupsToSave.length });
}
