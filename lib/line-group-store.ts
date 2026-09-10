import type { LineGroup } from "@/lib/types";
import { readJsonStore, writeJsonStore } from "@/lib/json-store";

const STORE_KEY = "line-groups.json";

function normalizeGroup(group: LineGroup): LineGroup {
  return {
    groupId: String(group.groupId || "").trim(),
    type: String(group.type || "group").trim() || "group",
    name: String(group.name || "").trim(),
    lastSeenAt: String(group.lastSeenAt || new Date().toISOString()).trim()
  };
}

export async function listStoredLineGroups(): Promise<LineGroup[]> {
  const groups = await readJsonStore<LineGroup[]>(STORE_KEY, []);
  return (Array.isArray(groups) ? groups : [])
    .map(normalizeGroup)
    .filter((group) => Boolean(group.groupId))
    .sort((a, b) => String(b.lastSeenAt).localeCompare(String(a.lastSeenAt)));
}

export async function saveStoredLineGroup(input: LineGroup): Promise<LineGroup> {
  const group = normalizeGroup(input);
  if (!group.groupId) throw new Error("LINE groupId is required");

  const groups = await listStoredLineGroups();
  const existingIndex = groups.findIndex((item) => item.groupId === group.groupId);
  if (existingIndex >= 0) groups[existingIndex] = { ...groups[existingIndex], ...group };
  else groups.unshift(group);

  await writeJsonStore(STORE_KEY, groups.slice(0, 100));
  return group;
}
