import { listLineGroups } from "@/lib/apps-script";
import { enqueueNotificationOutbox, listDueNotificationOutbox, processNotificationOutboxEvent, type NotificationOutboxRecord } from "@/lib/notification-outbox";
import { getRealtimeBookingV2Dashboard, getRealtimeBookingV2QueueItem, sendRealtimeBookingV2Line } from "@/lib/realtime-booking-v2";

const EVENT_TYPE = "realtime_booking_line_ready";

export async function requireApprovedRealtimeBookingLineRoute(routeId: string) {
  const normalized = String(routeId || "").trim();
  if (!normalized) throw new Error("INVALID_ROUTE");
  const approved = (await listLineGroups()).some((group) => group.groupId === normalized);
  if (!approved) throw new Error("INVALID_ROUTE");
  return normalized;
}

export async function enqueueRealtimeBookingLine(itemId: string, routeId: string) {
  const item = await getRealtimeBookingV2QueueItem(itemId);
  if (!item) throw new Error("ไม่พบรายการนี้");
  if (item.status !== "MATCHED") {
    if (item.lineStatus === "sent") return { created: false, record: null };
    throw new Error("ต้องเป็นรายการ MATCHED ก่อน");
  }
  const approvedRouteId = await requireApprovedRealtimeBookingLineRoute(routeId);
  const entityVersion = String(item.matchedAt || item.createdAt);
  return enqueueNotificationOutbox({
    eventType: EVENT_TYPE,
    entityType: "realtime_booking_v2",
    entityId: item.id,
    entityVersion,
    ownerUserId: item.ownerUserId,
    routeType: "line_group",
    routeId: approvedRouteId
  });
}

async function deliverRealtimeBookingLine(record: NotificationOutboxRecord) {
  await requireApprovedRealtimeBookingLineRoute(record.routeId);
  await sendRealtimeBookingV2Line(record.entityId, record.routeId, { autoSend: true });
}

export async function processRealtimeBookingLineEvent(id: string) {
  return processNotificationOutboxEvent(id, deliverRealtimeBookingLine);
}

export async function processDueRealtimeBookingLineEvents() {
  const due = await listDueNotificationOutbox(EVENT_TYPE);
  const results = [];
  for (const event of due.slice(0, 10)) results.push(await processRealtimeBookingLineEvent(event.id));
  return results;
}

export async function enqueueAndProcessMatchedRealtimeBookingLines() {
  const dashboard = await getRealtimeBookingV2Dashboard();
  const matched = dashboard.queue.filter((item) => item.status === "MATCHED" && item.lineStatus !== "sent" && item.lineTargetId);
  const results = [];
  for (const item of matched.slice(0, 10)) {
    const queued = await enqueueRealtimeBookingLine(item.id, String(item.lineTargetId));
    if (queued.record) results.push(await processRealtimeBookingLineEvent(queued.record.id));
  }
  results.push(...await processDueRealtimeBookingLineEvents());
  return results;
}
