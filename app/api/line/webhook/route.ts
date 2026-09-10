import { NextResponse } from "next/server";
import { LineWebhookEvent, replyLineText, replyLineTextWithQuickReplies, verifyLineSignature } from "@/lib/line";
import { saveLineGroup, saveLineWebhookLog } from "@/lib/apps-script";
import { saveStoredLineGroup } from "@/lib/line-group-store";
import { applyLineReservationCommands } from "@/lib/line-reservations";
import { handleRddLineTrackerMessage, isRddLineTrackerCommand, formatRddLineCase, rememberRddLineWebhook, wasRddLineWebhookProcessed } from "@/lib/rdd-line-tracker";
import { listBookingDeliveryRecordsWithRevision } from "@/lib/booking-delivery";
import { updateRddWorkspaceRecord } from "@/lib/rdd-workspace-write";
import { appendRddActivity } from "@/lib/rdd-activity";
import type { RddWorkspaceChanges } from "@/lib/rdd-workspace-fields";

export const dynamic = "force-dynamic";

const trackerTasks = ["ล้างรถ", "ลอกลาย", "น้ำมันเครื่อง", "แบตเตอรี่", "ภาษี", "ประกัน", "ส่งอู่", "รถกลับ"];

type MenuTask = "ล้างรถ" | "ลอกลาย" | "น้ำมันเครื่อง" | "แบตเตอรี่" | "ภาษี" | "ประกัน";
const menuTasks = new Set<MenuTask>(["ล้างรถ", "ลอกลาย", "น้ำมันเครื่อง", "แบตเตอรี่", "ภาษี", "ประกัน"]);

const taskOptions: Record<MenuTask, Array<{ label: string; value: string; changes: RddWorkspaceChanges }>> = {
  "ล้างรถ": [
    { label: "ยังไม่สั่ง", value: "ยังไม่สั่ง", changes: { washStatus: "not_ordered" } },
    { label: "สั่งแล้ว / รอล้าง", value: "สั่งแล้ว", changes: { washStatus: "ordered_waiting" } },
    { label: "ล้างเสร็จแล้ว ✅", value: "เสร็จแล้ว", changes: { washStatus: "completed" } }
  ],
  "ลอกลาย": [
    { label: "ยังไม่บอก", value: "ยังไม่บอก", changes: { stickerStatus: "not_checked" } },
    { label: "บอกแล้ว / รอลอก", value: "บอกแล้ว", changes: { stickerStatus: "ordered_waiting" } },
    { label: "ลอกเสร็จแล้ว ✅", value: "เสร็จแล้ว", changes: { stickerStatus: "completed" } },
    { label: "ไม่มีสติ๊กเกอร์", value: "ไม่มีสติ๊กเกอร์", changes: { stickerStatus: "no_sticker" } }
  ],
  "น้ำมันเครื่อง": [
    { label: "ไม่เปลี่ยน", value: "ไม่เปลี่ยน", changes: { oilStatus: "no_change" } },
    { label: "สั่งเปลี่ยน / รอ", value: "สั่งเปลี่ยนแล้ว", changes: { oilStatus: "change_waiting" } },
    { label: "เปลี่ยนแล้ว ✅", value: "เสร็จแล้ว", changes: { oilStatus: "changed" } }
  ],
  "แบตเตอรี่": [
    { label: "ยังไม่ตรวจ", value: "ยังไม่ตรวจ", changes: { batteryStatus: "not_checked" } },
    { label: "แบตปกติ ✅", value: "แบตปกติ", changes: { batteryStatus: "good" } },
    { label: "สั่งแล้ว / รอเปลี่ยน", value: "สั่งแล้ว", changes: { batteryStatus: "ordered_waiting" } },
    { label: "เปลี่ยนแล้ว ✅", value: "เสร็จแล้ว", changes: { batteryStatus: "replaced" } }
  ],
  "ภาษี": [
    { label: "ยังไม่ตรวจ", value: "ยังไม่ตรวจ", changes: { taxStatus: "not_checked" } },
    { label: "ภาษีไม่ขาด ✅", value: "ไม่ขาด", changes: { taxStatus: "valid" } },
    { label: "สั่งต่อแล้ว", value: "สั่งต่อแล้ว", changes: { taxStatus: "renewal_ordered" } }
  ],
  "ประกัน": [
    { label: "ยังไม่ได้คุย", value: "ยังไม่ได้คุย", changes: { insuranceStatus: "not_discussed" } },
    { label: "ทำกับเรา ✅", value: "ทำกับเรา", changes: { insuranceStatus: "with_us" } },
    { label: "ลูกค้าทำเอง", value: "ลูกค้าทำเอง", changes: { insuranceStatus: "customer_self" } }
  ]
};

function resolvedCaseQuery(reply: string) {
  const firstLine = String(reply || "").split("\n")[0]?.trim() || "";
  const match = firstLine.match(/^ติดตาม\s+(.+?)\s+·\s+(.+)$/);
  if (!match) return "";
  const plate = match[1].trim(); const customer = match[2].trim();
  if (!plate || !customer || customer === "-") return "";
  return `${plate} ${customer}`;
}

function mainQuickReplies(reply: string) {
  const caseQuery = resolvedCaseQuery(reply); if (!caseQuery) return [];
  return trackerTasks.map((label) => ({ label, text: menuTasks.has(label as MenuTask) ? `เมนูงาน|${caseQuery}|${label}` : `งาน ${caseQuery} ${label}` }));
}

function parseMenu(text: string) {
  const parts = String(text || "").split("|");
  if (parts[0] !== "เมนูงาน" || parts.length !== 3 || !menuTasks.has(parts[2] as MenuTask)) return null;
  return { caseQuery: parts[1].trim(), task: parts[2] as MenuTask };
}
function parseStatus(text: string) {
  const parts = String(text || "").split("|");
  if (parts[0] !== "สถานะงาน" || parts.length !== 4 || !menuTasks.has(parts[2] as MenuTask)) return null;
  return { caseQuery: parts[1].trim(), task: parts[2] as MenuTask, value: parts[3] };
}
function normalize(value: unknown) { return String(value || "").normalize("NFKC").toLowerCase().replace(/[^0-9a-zก-๙]/g, ""); }
async function findExactCase(caseQuery: string) {
  const snapshot = await listBookingDeliveryRecordsWithRevision();
  const records = snapshot.records.filter((record) => {
    const plate = normalize(record.plate); const name = normalize(record.customerName); const q = normalize(caseQuery);
    return plate && name && q.includes(plate) && q.includes(name);
  });
  return { snapshot, record: records.length === 1 ? records[0] : null };
}
async function handleMenu(text: string) {
  const menu = parseMenu(text); if (!menu) return null;
  const { record } = await findExactCase(menu.caseQuery); if (!record) return { reply: "ไม่พบเคส หรือพบมากกว่า 1 เคส กรุณาพิมพ์ติดตามทะเบียนใหม่", quickReplies: [] };
  const reply = `${record.plate} · ${record.customerName}\nเลือกสถานะ: ${menu.task}`;
  const quickReplies = [
    ...taskOptions[menu.task].map((option) => ({ label: option.label, text: `สถานะงาน|${menu.caseQuery}|${menu.task}|${option.value}` })),
    { label: "← กลับเมนูงาน", text: `ดูเคส|${menu.caseQuery}` }
  ];
  return { reply, quickReplies };
}
async function handleStatus(text: string, sourceGroupId: string, sourceUserId?: string) {
  const status = parseStatus(text); if (!status) return null;
  const option = taskOptions[status.task].find((item) => item.value === status.value); if (!option) return null;
  const { snapshot, record } = await findExactCase(status.caseQuery); if (!record) return { reply: "ไม่พบเคส หรือพบมากกว่า 1 เคส กรุณาพิมพ์ติดตามทะเบียนใหม่", quickReplies: [] };
  const result = await updateRddWorkspaceRecord({ id: record.id, expectedRevision: snapshot.revision, changes: option.changes, actor: { id: `line:${sourceUserId || sourceGroupId}`, role: "sales" } });
  await appendRddActivity(null, { action: "booking_delivery_updated", targetType: "booking_delivery", targetId: result.record.id, source: "line", before: result.before, after: result.after, metadata: { changedFields: result.changedFields, lineUserId: sourceUserId || "", lineGroupId: sourceGroupId } }).catch(() => undefined);
  const latest = formatRddLineCase(result.record);
  return { reply: `อัปเดต ${status.task}: ${option.label}\n\n${latest}`, quickReplies: mainQuickReplies(latest) };
}
async function handleView(text: string) {
  const match = String(text || "").match(/^ดูเคส\|(.+)$/); if (!match) return null;
  const { record } = await findExactCase(match[1]); if (!record) return { reply: "ไม่พบเคส กรุณาพิมพ์ติดตามทะเบียนใหม่", quickReplies: [] };
  const reply = formatRddLineCase(record); return { reply, quickReplies: mainQuickReplies(reply) };
}
function isContinuousCommand(text: string) { return /^(?:เมนูงาน|สถานะงาน|ดูเคส)\|/.test(String(text || "")); }

export async function GET() { return NextResponse.json({ ok: true, message: "Big Car CRM LINE webhook is ready" }); }

export async function POST(request: Request) {
  const body = await request.text(); const signature = request.headers.get("x-line-signature"); const receivedAt = new Date().toISOString();
  let signatureValid = false; let webhookError = ""; let events: LineWebhookEvent[] = []; let sourceSummary = "";
  try { signatureValid = verifyLineSignature(body, signature); } catch (error) { webhookError = error instanceof Error ? error.message : "Unable to verify LINE signature"; }
  try { const payload = JSON.parse(body) as { events?: LineWebhookEvent[] }; events = Array.isArray(payload.events) ? payload.events : []; sourceSummary = events.map((event) => { const source = event.source; return [event.type, source?.type, source?.groupId || source?.roomId || source?.userId].filter(Boolean).join(":"); }).join(", "); } catch (error) { webhookError = webhookError || (error instanceof Error ? error.message : "Invalid LINE webhook JSON"); }
  void saveLineWebhookLog({ receivedAt, signatureValid: signatureValid ? "yes" : "no", eventCount: String(events.length), source: sourceSummary, error: webhookError }).catch(() => undefined);
  if (!signatureValid) return NextResponse.json({ ok: false, error: "Invalid LINE signature" }, { status: 401 });

  const groupsToSave = events.map((event) => { const sourceType = event.source?.type || ""; const groupId = event.source?.groupId || event.source?.roomId || ""; if (!groupId || (sourceType !== "group" && sourceType !== "room")) return null; return { groupId, type: sourceType, name: `${sourceType} ${groupId.slice(-6)}`, lastSeenAt: new Date().toISOString() }; }).filter((group): group is { groupId: string; type: string; name: string; lastSeenAt: string } => Boolean(group));
  await Promise.all(groupsToSave.map((group) => saveStoredLineGroup(group))).catch((error) => console.error("line_group_store_failed", error instanceof Error ? error.message : error));
  void Promise.all(groupsToSave.map((group) => saveLineGroup(group))).catch(() => undefined);

  for (const event of events) {
    const messageText = String(event.message?.text || "").trim(); if (!messageText) continue;
    const sourceGroupId = event.source?.groupId || event.source?.roomId || "";
    if (isRddLineTrackerCommand(messageText) || isContinuousCommand(messageText)) {
      try {
        if (event.webhookEventId && await wasRddLineWebhookProcessed(event.webhookEventId)) continue;
        let reply = ""; let quickReplies: Array<{ label: string; text: string }> = [];
        const continuous = await handleMenu(messageText) || await handleStatus(messageText, sourceGroupId, event.source?.userId) || await handleView(messageText);
        if (continuous) { reply = continuous.reply; quickReplies = continuous.quickReplies; }
        else {
          const trackerReply = await handleRddLineTrackerMessage({ text: messageText, sourceGroupId, sourceUserId: event.source?.userId });
          if (trackerReply) { reply = trackerReply; quickReplies = mainQuickReplies(trackerReply); }
        }
        if (reply) {
          if (event.webhookEventId) await rememberRddLineWebhook(event.webhookEventId);
          if (event.replyToken) {
            if (quickReplies.length) await replyLineTextWithQuickReplies(event.replyToken, reply, quickReplies); else await replyLineText(event.replyToken, reply);
          } else if (sourceGroupId) {
            const { pushLineText, pushLineTextWithQuickReplies } = await import("@/lib/line");
            if (quickReplies.length) await pushLineTextWithQuickReplies(sourceGroupId, reply, quickReplies); else await pushLineText(sourceGroupId, reply);
          }
          continue;
        }
      } catch (error) { const reply = error instanceof Error ? error.message : "อัปเดตงานไม่สำเร็จ กรุณาลองใหม่"; if (event.replyToken) await replyLineText(event.replyToken, reply).catch(() => undefined); continue; }
    }
    await applyLineReservationCommands([{ text: messageText, sourceGroupId, receivedAt: new Date().toISOString() }]).catch(() => undefined);
  }
  return NextResponse.json({ ok: true, queued: groupsToSave.length });
}
