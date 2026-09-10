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
  return /\d/.test(normalized) && /[ก-ฮ]/.test(normalized);
}

function extractPlateCandidates(value: string) {
  const withoutBangkok = String(value || "").replace(/\b(?:กทม|กรุงเทพ(?:มหานคร)?)\b/gi, " ");
  const candidates = withoutBangkok.match(/[0-9ก-ฮ]{1,4}(?:\s*[-–—]?\s*)[0-9ก-ฮ]{1,7}/g) || [];
  return candidates
    .map(cleanPlateDisplay)
    .filter(looksLikeThaiPlate);
}

export function parseReserveAction(text: string): { action: LineReservationAction; plate: string } | null {
  return parseLineReservationCommands(text)[0] || null;
}

export function parseLineReservationCommands(text: string): Array<{
  action: LineReservationAction;
  plate: string;
}> {
  const cleaned = String(text || "").trim();
  if (!cleaned) return [];

  const results: Array<{ action: LineReservationAction; plate: string }> = [];
  const seen = new Set<string>();
  const add = (action: LineReservationAction, plate: string) => {
    const display = cleanPlateDisplay(plate);
    const key = `${action}:${normalizePlateForMatch(display)}`;
    if (!looksLikeThaiPlate(display) || seen.has(key)) return;
    seen.add(key);
    results.push({ action, plate: display });
  };

  const commandPattern = /(?:^|\n)\s*(ยกเลิกจองทะเบียน|ปล่อยจองทะเบียน|ยกเลิก|ปล่อยจอง|#?unreserve|ติดจอง|จองทะเบียน|จอง|#?reserve)\s*(?:ทะเบียน(?:รถ)?|plate|license\s*plate)?\s*[:：-]?\s*([^\n\r]+)/gi;
  for (const match of cleaned.matchAll(commandPattern)) {
    const command = String(match[1] || "").toLowerCase();
    const action: LineReservationAction = /ยกเลิก|ปล่อย|unreserve/.test(command) ? "unreserve" : "reserve";
    extractPlateCandidates(match[2] || "").forEach((plate) => add(action, plate));
  }

  // ข้อความขายจาก LINE group: รองรับ "ทะเบียนรถ : ...", ช่องว่าง, กทม และหลายทะเบียนในข้อความเดียว
  const registrationPattern = /(?:^|\n)\s*ทะเบียน(?:รถ)?\s*[:：-]?\s*([^\n\r]+)/gi;
  for (const match of cleaned.matchAll(registrationPattern)) {
    extractPlateCandidates(match[1] || "").forEach((plate) => add("reserve", plate));
  }

  return results;
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

export async function clearAllLineReservations(reason = "") {
  const current = await readStore();
  const clearedAt = new Date().toISOString();
  const nextStore: LineReservationStore = { byPlate: {} };
  await writeStore(nextStore);

  return {
    clearedAt,
    clearedCount: Object.keys(current.byPlate || {}).length,
    reason: String(reason || "").slice(0, 120)
  };
}

export async function applyLineReservationCommand(input: {
  text: string;
  sourceGroupId?: string;
  receivedAt?: string;
}) {
  return applyLineReservationCommands([input]);
}

export async function applyLineReservationCommands(
  inputs: Array<{
    text: string;
    sourceGroupId?: string;
    receivedAt?: string;
  }>
) {
  const normalizedInputs = inputs
    .map((input) => ({
      text: String(input.text || ""),
      sourceGroupId: String(input.sourceGroupId || ""),
      receivedAt: input.receivedAt || new Date().toISOString()
    }))
    .filter((input) => input.text.trim());

  if (!normalizedInputs.length) return null;

  const parsedCommands = normalizedInputs.flatMap((input) =>
    parseLineReservationCommands(input.text).map((parsed) => ({
      ...parsed,
      sourceGroupId: input.sourceGroupId,
      receivedAt: input.receivedAt,
      sourceText: input.text
    }))
  );

  if (!parsedCommands.length) return null;

  const store = await readStore();
  const applied: Array<{ action: LineReservationAction; plate: string; plateNormalized: string; active: boolean }> = [];

  for (const parsed of parsedCommands) {
    const plateNormalized = normalizePlateForMatch(parsed.plate);
    if (!plateNormalized) continue;

    const current = store.byPlate[plateNormalized];
    const record: LineReservationRecord = {
      plate: parsed.plate,
      plateNormalized,
      active: parsed.action === "reserve",
      updatedAt: parsed.receivedAt,
      sourceGroupId: parsed.sourceGroupId,
      sourceText: parsed.sourceText
    };
    store.byPlate[plateNormalized] = { ...current, ...record };
    applied.push({ action: parsed.action, plate: parsed.plate, plateNormalized, active: record.active });
  }

  if (!applied.length) return null;
  await writeStore(store);
  return applied.length === 1 ? applied[0] : { applied };
}
