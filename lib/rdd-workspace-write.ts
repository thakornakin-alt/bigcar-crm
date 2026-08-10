import { compareAndSwapJsonStore, readJsonStoreSnapshot } from "@/lib/json-store";
import { incrementRecordVersion, normalizeWorkspaceRecord } from "@/lib/rdd-workspace-adapter";
import type { BookingDeliveryRecord } from "@/lib/types";
import { RDD_DELIVERY_LOCATIONS, type RddWorkspaceChanges, type RddWorkspaceEditableField } from "@/lib/rdd-workspace-fields";

const storeFile = "booking-delivery.json";

export class RddWorkspaceWriteError extends Error {
  constructor(
    public status: 400 | 403 | 404 | 409 | 500,
    message: string,
    public current?: { record: BookingDeliveryRecord; revision: string }
  ) {
    super(message);
    this.name = "RddWorkspaceWriteError";
  }
}

type Store = { records?: BookingDeliveryRecord[] };

function normalizeText(value: string) {
  return value.replace(/\r\n?/g, "\n").trim();
}

export function validateRddWorkspaceChanges(input: unknown): RddWorkspaceChanges {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new RddWorkspaceWriteError(400, "รูปแบบข้อมูลที่แก้ไขไม่ถูกต้อง");
  }
  const object = input as Record<string, unknown>;
  const keys = Object.keys(object);
  if (!keys.length) throw new RddWorkspaceWriteError(400, "ไม่มีข้อมูลที่เปลี่ยนแปลง");
  const unknown = keys.filter((key) => key !== "deliveryLocation" && key !== "financeCaseNote");
  if (unknown.length) throw new RddWorkspaceWriteError(400, `ไม่อนุญาตให้แก้ไขฟิลด์: ${unknown.join(", ")}`);

  const changes: RddWorkspaceChanges = {};
  for (const key of keys as RddWorkspaceEditableField[]) {
    if (typeof object[key] !== "string") throw new RddWorkspaceWriteError(400, `${key} ต้องเป็นข้อความ`);
    const value = normalizeText(object[key] as string);
    if (key === "deliveryLocation" && value && !RDD_DELIVERY_LOCATIONS.includes(value as typeof RDD_DELIVERY_LOCATIONS[number])) {
      throw new RddWorkspaceWriteError(400, "สถานที่ส่งมอบไม่อยู่ในรายการที่อนุญาต");
    }
    if (key === "financeCaseNote" && value.length > 1000) {
      throw new RddWorkspaceWriteError(400, "หมายเหตุไฟแนนซ์ต้องไม่เกิน 1,000 ตัวอักษร");
    }
    changes[key] = value;
  }
  return changes;
}

export function validateRddWorkspacePatchBody(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new RddWorkspaceWriteError(400, "รูปแบบคำขอไม่ถูกต้อง");
  const body = input as Record<string, unknown>;
  const unknown = Object.keys(body).filter((key) => !["id", "expectedRevision", "changes"].includes(key));
  if (unknown.length) throw new RddWorkspaceWriteError(400, `คำขอมีฟิลด์ที่ไม่อนุญาต: ${unknown.join(", ")}`);
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const expectedRevision = typeof body.expectedRevision === "string" ? body.expectedRevision.trim() : "";
  if (!id) throw new RddWorkspaceWriteError(400, "ไม่พบรหัส Booking Delivery");
  if (!expectedRevision) throw new RddWorkspaceWriteError(400, "ไม่พบ revision สำหรับป้องกันข้อมูลทับกัน");
  return { id, expectedRevision, changes: validateRddWorkspaceChanges(body.changes) };
}

export async function updateRddWorkspaceRecord(input: {
  id: string;
  expectedRevision: string;
  changes: RddWorkspaceChanges;
  now?: string;
}) {
  const snapshot = await readJsonStoreSnapshot<Store>(storeFile, { records: [] });
  const records = Array.isArray(snapshot.data.records) ? snapshot.data.records : [];
  const matches = records.map((record, index) => ({ record, index })).filter(({ record }) => record.id === input.id);
  if (matches.length !== 1) {
    throw new RddWorkspaceWriteError(matches.length ? 500 : 404, matches.length ? "พบ Booking Delivery ซ้ำในระบบ" : "ไม่พบ Booking Delivery");
  }
  const current = matches[0].record;
  if (snapshot.revision !== input.expectedRevision) {
    throw new RddWorkspaceWriteError(409, "ข้อมูลเคสนี้มีการเปลี่ยนแปลงจากผู้ใช้อื่น", {
      record: normalizeWorkspaceRecord(current), revision: snapshot.revision
    });
  }
  if (current.qaTestRecord === true) throw new RddWorkspaceWriteError(403, "ข้อมูล TEST/QA เป็นแบบอ่านอย่างเดียว");

  const changedFields = (Object.keys(input.changes) as RddWorkspaceEditableField[])
    .filter((key) => String(current[key] || "") !== input.changes[key]);
  if (!changedFields.length) throw new RddWorkspaceWriteError(400, "ไม่มีข้อมูลที่เปลี่ยนแปลง");

  const next = normalizeWorkspaceRecord({
    ...current,
    ...input.changes,
    updatedAt: input.now || new Date().toISOString()
  });
  Object.assign(next, incrementRecordVersion(next));
  const nextRecords = [...records];
  nextRecords[matches[0].index] = next;
  const result = await compareAndSwapJsonStore(storeFile, { ...snapshot.data, records: nextRecords }, input.expectedRevision);
  if (!result.updated) {
    const latest = await readJsonStoreSnapshot<Store>(storeFile, { records: [] });
    const latestRecord = (latest.data.records || []).find((record) => record.id === input.id);
    throw new RddWorkspaceWriteError(409, "ข้อมูลเคสนี้มีการเปลี่ยนแปลงจากผู้ใช้อื่น", latestRecord ? {
      record: normalizeWorkspaceRecord(latestRecord), revision: latest.revision
    } : undefined);
  }
  const before = Object.fromEntries(changedFields.map((key) => [key, current[key] || ""]));
  const after = Object.fromEntries(changedFields.map((key) => [key, next[key] || ""]));
  return { record: next, revision: result.revision, changedFields, before, after };
}
