import { NextResponse } from "next/server";
import { listLineWebhookLogs } from "@/lib/apps-script";
import { getLineConfigStatus } from "@/lib/line";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const logs = await listLineWebhookLogs();
    return NextResponse.json({ config: getLineConfigStatus(), logs });
  } catch (error) {
    return NextResponse.json(
      { config: getLineConfigStatus(), logs: [], error: error instanceof Error ? error.message : "Unable to load LINE status" },
      { status: 200 }
    );
  }
}
