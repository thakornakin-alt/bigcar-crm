import { readJsonStore, writeJsonStore } from "@/lib/json-store";

const STORE_FILE = "line-reservations.json";

export type LineReservationAction = "reserve" | "unreserve";

export type LineReservationRecord = {
  plate: string;
  plateNormalized: string;
  active: boolean;
  updatedAt: string;
  sourceGroupId: string;
  sourceText: string;
};

type LineReservationStore = {
  byPlate: Record<string, LineReservationRecord>;
};

function cleanPlateDisplay(value: string) {
  return String(value || "")
    .replace(/\b(?:กทม|กรุงเทพ(?:มหานคร)?)\b/gi, "")
    .replace(/[,:;|]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePlateForMatch(value: string) {
  return cleanPlateDisplay(value)
    .toUpperCase()
    .replace(/[.\-_/\\\s]+/g, "")
    .trim();
}

function looksLikeThaiPlate(value: string) {
  const normalized = normalizePlateForMatch(value);
  if (!normalized || normalized.length > 12) return false;
  // ป้ายทะเบียนรถในสต็อกต้องมีตัวเลขและอักษรไทยอย่างน้อยหนึ่งตัว
  return /\d/.test(normalized) && /[ก-ฮ]/.test(normalized);
}

function parseReserveAction(text: string): { action: LineReservationAction; plate: string } | null {
  const cleaned = String(text || "").trim();
  if (!cleaned) return null;

  // คำสั่งเดิมยังใช้ได้: จอง 3ฒศ5381 / ติดจอง ... / reserve ...
  const reserveMatch = cleaned.match(/(?:^|\s)(?:ติดจอง|จอง|#?reserve)\s*[:：-]?\s*([^\s]+)/i);
  if (reserveMatch?.[1]) {
    const plate = cleanPlateDisplay(reserveMatch[1]);
    if (looksLikeThaiPlate(plate)) return { action: "reserve", plate };
  }

  const unreserveMatch = cleaned.match(/(?:^|\s)(?:ยกเลิก|ปล่อยจอง|#?unreserve)\s*[:：-]?\s*([^\s]+)/i);
  if (unreserveMatch?.[1]) {
    const plate = cleanPlateDisplay(unreserveMatch[1]);
    if (looksLikeThaiPlate(plate)) return { action: "unreserve", plate };
  }

  // ข้อความขายปกติจากกลุ่ม LINE เช่น:
  // ทะเบียนรถ :3ฒศ5381
  // ทะเบียนรถ : 3ฒญ 7441 กทม
  // จับเฉพาะบรรทัดที่มีหัวข้อ "ทะเบียนรถ" เพื่อลด false positive จากราคา/เบอร์โทร/เลขอื่น
  const registrationLine = cleaned.match(/(?:^|\n)\s*ทะเบียน(?:รถ)?\s*[:：-]?\s*([^\n\r]+)/i);
  if (registrationLine?.[1]) {
    const rawValue = registrationLine[1]
      .split(/(?:\s{2,}|[,;|])/)[0]
      .trim();
    const plate = cleanPlateDisplay(rawValue);
    if (looksLikeThaiPlate(plate)) return { action: "reserve", plate };
  }

  return null;
}

async function readStore() {
  return readJsonStore<LineReservationStore>(STORE_FILE, { byPlate: {} });
}

async function writeStore(store: LineReservationStore) {
  await writeJsonStore(STORE_FILE, store);
}

export async function listActiveReservedPlateKeys() {
  const store = await readStore();
  return Object.values(store.byPlate)
    .filter((item) => item.active)
    .map((item) => item.plateNormalized);
}

export async function listLineReservationRecords() {
  const store = await readStore();
  return Object.values(store.byPlate).sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1));
}

export async function applyLineReservationCommand(input: {
  text: string;
  sourceGroupId?: string;
  receivedAt?: string;
}) {
  const parsed = parseReserveAction(input.text);
  if (!parsed) return null;

  const plateNormalized = normalizePlateForMatch(parsed.plate);
  if (!plateNormalized) return null;

  const store = await readStore();
  const current = store.byPlate[plateNormalized];
  const record: LineReservationRecord = {
    plate: parsed.plate,
    plateNormalized,
    active: parsed.action === "reserve",
    updatedAt: input.receivedAt || new Date().toISOString(),
    sourceGroupId: String(input.sourceGroupId || ""),
    sourceText: input.text
  };
  store.byPlate[plateNormalized] = { ...current, ...record };
  await writeStore(store);

  return {
    action: parsed.action,
    plate: parsed.plate,
    plateNormalized,
    active: record.active
  };
}
