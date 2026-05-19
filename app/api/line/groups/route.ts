import { NextResponse } from "next/server";
import { listLineGroups, saveLineGroup } from "@/lib/apps-script";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const groups = await listLineGroups();
    return NextResponse.json({ groups });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load LINE groups" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const groupId = String(body.groupId || "").trim();
    const type = String(body.type || "group").trim();
    const name = String(body.name || "").trim();
    const lastSeenAt = String(body.lastSeenAt || new Date().toISOString()).trim();

    if (!groupId || !name) {
      return NextResponse.json({ error: "LINE group and name are required" }, { status: 400 });
    }

    const group = await saveLineGroup({ groupId, type, name, lastSeenAt });
    return NextResponse.json({ group });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save LINE group" },
      { status: 500 }
    );
  }
}
