import { NextResponse } from "next/server";
import { getLineGroupName, LineWebhookEvent, verifyLineSignature } from "@/lib/line";
import { saveLineGroup } from "@/lib/apps-script";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, message: "Big Car CRM LINE webhook is ready" });
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-line-signature");

  if (!verifyLineSignature(body, signature)) {
    return NextResponse.json({ ok: false, error: "Invalid LINE signature" }, { status: 401 });
  }

  const payload = JSON.parse(body) as { events?: LineWebhookEvent[] };
  const events = Array.isArray(payload.events) ? payload.events : [];
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
