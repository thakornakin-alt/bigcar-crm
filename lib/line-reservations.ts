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

function normalizePlateForMatch(value: string) {
  return String(value || "")
    .toUpperCase()
    .replace(/[.\-_/\\\s]+/g, "")
    .trim();
}

function parseReserveAction(text: string): { action: LineReservationAction; plate: string } | null {
  const cleaned = String(text || "").trim();
  if (!cleaned) return null;

  const reserveMatch = cleaned.match(/(?:^|\s)(?:ติดจอง|จอง|#?reserve)\s*[:：-]?\s*([^\s]+)/i);
  if (reserveMatch?.[1]) return { action: "reserve", plate: reserveMatch[1] };

  const unreserveMatch = cleaned.match(/(?:^|\s)(?:ยกเลิก|ปล่อยจอง|#?unreserve)\s*[:：-]?\s*([^\s]+)/i);
  if (unreserveMatch?.[1]) return { action: "unreserve", plate: unreserveMatch[1] };

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

