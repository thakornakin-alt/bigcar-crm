import { NextResponse } from "next/server";
import { LineWebhookEvent, replyLineText, replyLineTextWithQuickReplies, verifyLineSignature } from "@/lib/line";
import { saveLineGroup, saveLineWebhookLog } from "@/lib/apps-script";
import { saveStoredLineGroup } from "@/lib/line-group-store";
import { applyLineReservationCommands } from "@/lib/line-reservations";
import { handleRddLineTrackerMessage, isRddLineTrackerCommand, formatRddLineCase, rememberRddLineWebhook, wasRddLineWebhookProcessed } from "@/lib/rdd-line-tracker";
import { getRddLineSettings } from "@/lib/rdd-line-settings";
import { listBookingDeliveryRecordsWithRevision } from "@/lib/booking-delivery";
import { updateRddWorkspaceRecord } from "@/lib/rdd-workspace-write";
import { appendRddActivity } from "@/lib/rdd-activity";
import { readJsonStore, writeJsonStore } from "@/lib/json-store";
import type { RddWorkspaceChanges } from "@/lib/rdd-workspace-fields";

export const dynamic = "force-dynamic";

type MenuTask = "ล้างรถ" | "ลอกลาย" | "น้ำมันเครื่อง" | "แบตเตอรี่" | "ภาษี" | "ประกัน";
type Draft = { caseQuery: string; changes: RddWorkspaceChanges; labels: Record<string, string>; createdAt: string };
const trackerTasks = ["ล้างรถ", "ลอกลาย", "น้ำมันเครื่อง", "แบตเตอรี่", "ภาษี", "ประกัน"] as MenuTask[];
const menuTasks = new Set<MenuTask>(trackerTasks);
const draftFile = "rdd-line-multi-edit-drafts.json";

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

function key(groupId: string, userId?: string) { return `${groupId}:${userId || "group"}`; }
async function getDraft(groupId: string, userId?: string) {
  const store = await readJsonStore<Record<string, Draft>>(draftFile, {}); const k = key(groupId, userId); const draft = store[k];
  if (draft && Date.now() - Date.parse(draft.createdAt) <= 30 * 60 * 1000) return draft;
  if (draft) { delete store[k]; await writeJsonStore(draftFile, store); } return null;
}
async function putDraft(groupId: string, userId: string | undefined, draft: Draft | null) {
  const store = await readJsonStore<Record<string, Draft>>(draftFile, {}); const k = key(groupId, userId);
  if (draft) store[k] = draft; else delete store[k]; await writeJsonStore(draftFile, store);
}
function resolvedCaseQuery(reply: string) {
  const firstLine = String(reply || "").split("\n")[0]?.trim() || ""; const match = firstLine.match(/^ติดตาม\s+(.+?)\s+·\s+(.+)$/);
  if (!match) return ""; const plate = match[1].trim(); const customer = match[2].trim(); return !plate || !customer || customer === "-" ? "" : `${plate} ${customer}`;
}
function mainQuickReplies(reply: string) {
  const caseQuery = resolvedCaseQuery(reply); if (!caseQuery) return [];
  return [{ label: "✏️ แก้หลายงาน", text: `เริ่มหลายงาน|${caseQuery}` }, ...trackerTasks.map(label => ({ label, text: `เมนูงาน|${caseQuery}|${label}` }))];
}
function draftQuickReplies(caseQuery: string) {
  return [...trackerTasks.map(label => ({ label, text: `ร่างเมนู|${caseQuery}|${label}` })), { label: "✅ บันทึกทั้งหมด", text: `บันทึกร่าง|${caseQuery}` }, { label: "↩️ ยกเลิก", text: `ยกเลิกร่าง|${caseQuery}` }];
}
function parse3(text: string, prefix: string) { const p = text.split("|"); return p[0] === prefix && p.length === 3 && menuTasks.has(p[2] as MenuTask) ? { caseQuery: p[1].trim(), task: p[2] as MenuTask } : null; }
function parse4(text: string, prefix: string) { const p = text.split("|"); return p[0] === prefix && p.length === 4 && menuTasks.has(p[2] as MenuTask) ? { caseQuery: p[1].trim(), task: p[2] as MenuTask, value: p[3] } : null; }
function normalize(value: unknown) { return String(value || "").normalize("NFKC").toLowerCase().replace(/[^0-9a-zก-๙]/g, ""); }
async function findExactCase(caseQuery: string) {
  const snapshot = await listBookingDeliveryRecordsWithRevision(); const q = normalize(caseQuery);
  const records = snapshot.records.filter(record => { const plate = normalize(record.plate); const name = normalize(record.customerName); return plate && name && q.includes(plate) && q.includes(name); });
  return { snapshot, record: records.length === 1 ? records[0] : null };
}
function draftSummary(draft: Draft) {
  const items = Object.entries(draft.labels); return items.length ? `กำลังแก้ไข ${items.length} งาน:\n${items.map(([task, label]) => `• ${task}: ${label}`).join("\n")}\n\nเลือกงานต่อ หรือกด ✅ บันทึกทั้งหมด` : "โหมดแก้หลายงาน\nเลือกงานที่ต้องการอัปเดต แล้วค่อยกด ✅ บันทึกทั้งหมด";
}
async function handleContinuous(text: string, groupId: string, userId?: string) {
  const start = text.match(/^เริ่มหลายงาน\|(.+)$/); if (start) { const draft: Draft = { caseQuery: start[1], changes: {}, labels: {}, createdAt: new Date().toISOString() }; await putDraft(groupId, userId, draft); return { reply: draftSummary(draft), quickReplies: draftQuickReplies(draft.caseQuery) }; }
  const draftMenu = parse3(text, "ร่างเมนู"); if (draftMenu) { const draft = await getDraft(groupId, userId); if (!draft || draft.caseQuery !== draftMenu.caseQuery) return { reply: "โหมดแก้หลายงานหมดอายุ กรุณาเปิดเคสใหม่", quickReplies: [] }; return { reply: `${draftSummary(draft)}\n\nเลือกสถานะ: ${draftMenu.task}`, quickReplies: [...taskOptions[draftMenu.task].map(o => ({ label: o.label, text: `ร่างสถานะ|${draft.caseQuery}|${draftMenu.task}|${o.value}` })), { label: "← กลับ", text: `ดูร่าง|${draft.caseQuery}` }] }; }
  const draftStatus = parse4(text, "ร่างสถานะ"); if (draftStatus) { const draft = await getDraft(groupId, userId); const option = taskOptions[draftStatus.task].find(o => o.value === draftStatus.value); if (!draft || !option || draft.caseQuery !== draftStatus.caseQuery) return { reply: "โหมดแก้หลายงานหมดอายุ กรุณาเปิดเคสใหม่", quickReplies: [] }; draft.changes = { ...draft.changes, ...option.changes }; draft.labels[draftStatus.task] = option.label; draft.createdAt = new Date().toISOString(); await putDraft(groupId, userId, draft); return { reply: draftSummary(draft), quickReplies: draftQuickReplies(draft.caseQuery) }; }
  const viewDraft = text.match(/^ดูร่าง\|(.+)$/); if (viewDraft) { const draft = await getDraft(groupId, userId); if (!draft || draft.caseQuery !== viewDraft[1]) return { reply: "โหมดแก้หลายงานหมดอายุ กรุณาเปิดเคสใหม่", quickReplies: [] }; return { reply: draftSummary(draft), quickReplies: draftQuickReplies(draft.caseQuery) }; }
  const cancel = text.match(/^ยกเลิกร่าง\|(.+)$/); if (cancel) { await putDraft(groupId, userId, null); return { reply: "ยกเลิกการแก้ไขแล้ว ไม่มีข้อมูลถูกเปลี่ยน", quickReplies: [] }; }
  const save = text.match(/^บันทึกร่าง\|(.+)$/); if (save) { const draft = await getDraft(groupId, userId); if (!draft || draft.caseQuery !== save[1]) return { reply: "โหมดแก้หลายงานหมดอายุ กรุณาเปิดเคสใหม่", quickReplies: [] }; if (!Object.keys(draft.changes).length) return { reply: "ยังไม่ได้เลือกงานที่จะอัปเดต", quickReplies: draftQuickReplies(draft.caseQuery) }; const { snapshot, record } = await findExactCase(draft.caseQuery); if (!record) return { reply: "ไม่พบเคส กรุณาพิมพ์ติดตามทะเบียนใหม่", quickReplies: [] }; const result = await updateRddWorkspaceRecord({ id: record.id, expectedRevision: snapshot.revision, changes: draft.changes, actor: { id: `line:${userId || groupId}`, role: "sales" } }); await appendRddActivity(null, { action: "booking_delivery_updated", targetType: "booking_delivery", targetId: result.record.id, source: "line", before: result.before, after: result.after, metadata: { changedFields: result.changedFields, lineUserId: userId || "", lineGroupId: groupId, multiEdit: true } }).catch(() => undefined); await putDraft(groupId, userId, null); const latest = formatRddLineCase(result.record); return { reply: `บันทึกทั้งหมด ${Object.keys(draft.labels).length} งานเรียบร้อย ✅\n\n${latest}`, quickReplies: mainQuickReplies(latest) }; }
  const menu = parse3(text, "เมนูงาน"); if (menu) { const { record } = await findExactCase(menu.caseQuery); if (!record) return { reply: "ไม่พบเคส กรุณาพิมพ์ติดตามทะเบียนใหม่", quickReplies: [] }; return { reply: `${record.plate} · ${record.customerName}\nเลือกสถานะ: ${menu.task}`, quickReplies: taskOptions[menu.task].map(o => ({ label: o.label, text: `สถานะงาน|${menu.caseQuery}|${menu.task}|${o.value}` })) }; }
  const status = parse4(text, "สถานะงาน"); if (status) { const option = taskOptions[status.task].find(o => o.value === status.value); if (!option) return null; const { snapshot, record } = await findExactCase(status.caseQuery); if (!record) return { reply: "ไม่พบเคส กรุณาพิมพ์ติดตามทะเบียนใหม่", quickReplies: [] }; const result = await updateRddWorkspaceRecord({ id: record.id, expectedRevision: snapshot.revision, changes: option.changes, actor: { id: `line:${userId || groupId}`, role: "sales" } }); const latest = formatRddLineCase(result.record); return { reply: `อัปเดต ${status.task}: ${option.label}\n\n${latest}`, quickReplies: mainQuickReplies(latest) }; }
  return null;
}
function isContinuousCommand(text: string) { return /^(?:เริ่มหลายงาน|ร่างเมนู|ร่างสถานะ|ดูร่าง|บันทึกร่าง|ยกเลิกร่าง|เมนูงาน|สถานะงาน)\|/.test(text); }

export async function GET() { return NextResponse.json({ ok: true, message: "Big Car CRM LINE webhook is ready" }); }
export async function POST(request: Request) {
  const body = await request.text(); const signature = request.headers.get("x-line-signature"); const receivedAt = new Date().toISOString(); let signatureValid = false; let webhookError = ""; let events: LineWebhookEvent[] = []; let sourceSummary = "";
  try { signatureValid = verifyLineSignature(body, signature); } catch (error) { webhookError = error instanceof Error ? error.message : "Unable to verify LINE signature"; }
  try { const payload = JSON.parse(body) as { events?: LineWebhookEvent[] }; events = Array.isArray(payload.events) ? payload.events : []; sourceSummary = events.map(event => [event.type, event.source?.type, event.source?.groupId || event.source?.roomId || event.source?.userId].filter(Boolean).join(":")).join(", "); } catch (error) { webhookError = webhookError || (error instanceof Error ? error.message : "Invalid LINE webhook JSON"); }
  void saveLineWebhookLog({ receivedAt, signatureValid: signatureValid ? "yes" : "no", eventCount: String(events.length), source: sourceSummary, error: webhookError }).catch(() => undefined); if (!signatureValid) return NextResponse.json({ ok: false, error: "Invalid LINE signature" }, { status: 401 });
  const groupsToSave = events.map(event => { const type = event.source?.type || ""; const groupId = event.source?.groupId || event.source?.roomId || ""; return !groupId || (type !== "group" && type !== "room") ? null : { groupId, type, name: `${type} ${groupId.slice(-6)}`, lastSeenAt: new Date().toISOString() }; }).filter((g): g is { groupId: string; type: string; name: string; lastSeenAt: string } => Boolean(g));
  await Promise.all(groupsToSave.map(g => saveStoredLineGroup(g))).catch(() => undefined); void Promise.all(groupsToSave.map(g => saveLineGroup(g))).catch(() => undefined);
  for (const event of events) {
    const messageText = String(event.message?.text || "").trim(); if (!messageText) continue; const sourceGroupId = event.source?.groupId || event.source?.roomId || "";
    if (isRddLineTrackerCommand(messageText) || isContinuousCommand(messageText)) {
      try {
        if (event.webhookEventId && await wasRddLineWebhookProcessed(event.webhookEventId)) continue;
        let reply = ""; let quickReplies: Array<{ label: string; text: string }> = [];
        if (isContinuousCommand(messageText)) { const settings = await getRddLineSettings(); if (settings.enabled && settings.groupId && settings.groupId === sourceGroupId) { const result = await handleContinuous(messageText, sourceGroupId, event.source?.userId); if (result) { reply = result.reply; quickReplies = result.quickReplies; } } }
        else { const trackerReply = await handleRddLineTrackerMessage({ text: messageText, sourceGroupId, sourceUserId: event.source?.userId }); if (trackerReply) { reply = trackerReply; quickReplies = mainQuickReplies(trackerReply); } }
        if (reply) { if (event.webhookEventId) await rememberRddLineWebhook(event.webhookEventId); if (event.replyToken) { if (quickReplies.length) await replyLineTextWithQuickReplies(event.replyToken, reply, quickReplies); else await replyLineText(event.replyToken, reply); } else if (sourceGroupId) { const { pushLineText, pushLineTextWithQuickReplies } = await import("@/lib/line"); if (quickReplies.length) await pushLineTextWithQuickReplies(sourceGroupId, reply, quickReplies); else await pushLineText(sourceGroupId, reply); } continue; }
      } catch (error) { const reply = error instanceof Error ? error.message : "อัปเดตงานไม่สำเร็จ กรุณาลองใหม่"; if (event.replyToken) await replyLineText(event.replyToken, reply).catch(() => undefined); continue; }
    }
    await applyLineReservationCommands([{ text: messageText, sourceGroupId, receivedAt: new Date().toISOString() }]).catch(() => undefined);
  }
  return NextResponse.json({ ok: true, queued: groupsToSave.length });
}
