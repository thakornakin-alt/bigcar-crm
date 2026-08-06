import { readJsonStore, writeJsonStore } from "@/lib/json-store";
import type { RddActivityEvent, SalesUser } from "@/lib/types";
import { buildRddActivityEvent } from "@/lib/rdd-activity-event";

const storeFile = "rdd-activity-log.json";
const maxEvents = 2000;

export async function appendRddActivity(
  user: SalesUser | null | undefined,
  input: Omit<RddActivityEvent, "id" | "occurredAt" | "actorUserId" | "actorName" | "actorRole">
) {
  const event = buildRddActivityEvent(user, input);
  const store = await readJsonStore<{ events?: RddActivityEvent[] }>(storeFile, { events: [] });
  const events = Array.isArray(store.events) ? store.events : [];
  events.unshift(event);
  await writeJsonStore(storeFile, { events: events.slice(0, maxEvents) });
  return event;
}
