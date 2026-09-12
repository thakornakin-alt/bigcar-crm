import { NextResponse } from "next/server";
import { listLineGroups, saveLineGroup } from "@/lib/apps-script";
import { listStoredLineGroups, saveStoredLineGroup } from "@/lib/line-group-store";

export const dynamic = "force-dynamic";

function mergeGroups<T extends { groupId: string; lastSeenAt: string }>(...sources: T[][]) {
  const merged = new Map<string, T>();
  for (const groups of sources) {
    for (const group of groups) {
      const current = merged.get(group.groupId);
      if (!current || String(group.lastSeenAt) > String(current.lastSeenAt)) merged.set(group.groupId, group);
    }
  }
  return Array.from(merged.values()).sort((a, b) => String(b.lastSeenAt).localeCompare(String(a.lastSeenAt)));
}

export async function GET() {
  try {
    // Supabase is the primary LINE-group store. Do not make the UI wait for the
    // legacy Apps Script mirror, which can take several seconds or time out.
    const stored = await listStoredLineGroups();
    void listLineGroups()
      .then((legacy) => {
        const storedIds = new Set(stored.map((group) => group.groupId));
        const missing = legacy.filter((group) => !storedIds.has(group.groupId));
        return Promise.all(missing.map((group) => saveStoredLineGroup(group)));
      })
      .catch(() => undefined);
    return NextResponse.json({ groups: mergeGroups(stored) });
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

    const input = { groupId, type, name, lastSeenAt };
    const group = await saveStoredLineGroup(input);
    void saveLineGroup(input).catch(() => undefined);
    return NextResponse.json({ group });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save LINE group" },
      { status: 500 }
    );
  }
}
