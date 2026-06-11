import { readJsonStore, writeJsonStore } from "@/lib/json-store";
import {
  LineReservationAction,
  normalizeDisplayPlate,
  normalizePlateForMatch,
  parseLineReservationCommands,
  parseLineReservationText
} from "@/lib/line-reservation-parser";

const STORE_FILE = "line-reservations.json";

export type LineReservationRecord = {
  plate: string;
  displayPlate: string;
  matchKey: string;
  plateNormalized: string;
  active: boolean;
  updatedAt: string;
  sourceGroupId: string;
  sourceText: string;
};

type LineReservationStore = {
  byPlate: Record<string, LineReservationRecord>;
};

function normalizeReservationRecord(record: Partial<LineReservationRecord>, fallbackKey = ""): LineReservationRecord {
  const parsedFromSource = record.sourceText ? parseLineReservationText(record.sourceText) : null;
  const isBadPlateValue = (value: string) => {
    const normalized = normalizeDisplayPlate(value);
    return !normalized || normalized === "ทะเบียน";
  };
  const candidatePlate =
    normalizeDisplayPlate(
      record.plate ||
        record.displayPlate ||
        parsedFromSource?.displayPlate ||
        parsedFromSource?.plate ||
        fallbackKey
    );
  const rawPlate = candidatePlate && candidatePlate !== "ทะเบียน" ? candidatePlate : normalizeDisplayPlate(parsedFromSource?.displayPlate || parsedFromSource?.plate || fallbackKey);
  const recordMatchKey = normalizePlateForMatch(record.matchKey || record.plateNormalized || "");
  const parsedMatchKey = parsedFromSource?.matchKey || "";
  const matchKeySource =
    !isBadPlateValue(recordMatchKey) && recordMatchKey !== normalizePlateForMatch("ทะเบียน")
      ? recordMatchKey
      : parsedMatchKey || rawPlate || fallbackKey;
  const matchKey = normalizePlateForMatch(matchKeySource);
  return {
    plate: rawPlate,
    displayPlate: rawPlate,
    matchKey,
    plateNormalized: matchKey,
    active: record.active === true,
    updatedAt: String(record.updatedAt || ""),
    sourceGroupId: String(record.sourceGroupId || ""),
    sourceText: String(record.sourceText || "")
  };
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
    .map((item, index) => normalizeReservationRecord(item, Object.keys(store.byPlate)[index] || ""))
    .filter((item) => item.active)
    .map((item) => item.plate);
}

export async function listLineReservationRecords() {
  const store = await readStore();
  return Object.entries(store.byPlate)
    .map(([key, item]) => normalizeReservationRecord(item, key))
    .sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1));
}

export async function clearLineReservations() {
  await writeStore({ byPlate: {} });
}

export async function applyLineReservationCommand(input: {
  text: string;
  sourceGroupId?: string;
  receivedAt?: string;
}) {
  const parsedItems = parseLineReservationCommands(input.text);
  if (parsedItems.length === 0) return null;

  const store = await readStore();
  const updatedAt = input.receivedAt || new Date().toISOString();
  const results = parsedItems.map((parsed) => {
    const plateNormalized = parsed.matchKey;
    const current = store.byPlate[plateNormalized];
    const record = normalizeReservationRecord(
      {
        plate: parsed.displayPlate,
        displayPlate: parsed.displayPlate,
        matchKey: plateNormalized,
        plateNormalized,
        active: parsed.action === "reserve",
        updatedAt,
        sourceGroupId: String(input.sourceGroupId || ""),
        sourceText: input.text
      },
      plateNormalized
    );
    store.byPlate[plateNormalized] = { ...normalizeReservationRecord(current || {}, plateNormalized), ...record };
    return {
      action: parsed.action,
      plate: parsed.displayPlate,
      displayPlate: parsed.displayPlate,
      plateNormalized,
      matchKey: plateNormalized,
      active: record.active
    };
  });
  await writeStore(store);

  return results.length === 1 ? results[0] : results;
}
