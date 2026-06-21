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

export function parseReserveAction(text: string): { action: LineReservationAction; plate: string } | null {
  const cleaned = String(text || "").trim();
  if (!cleaned) return null;

  const normalizeCommandPlate = (value: string) =>
    String(value || "")
      .replace(/^(?:ทะเบียน(?:รถ)?|plate|license\s*plate)\s*[:：-]?\s*/i, "")
      .trim();

  const reservePatterns = [
    /(?:^|\s)(?:ติดจอง|จองทะเบียน|จอง|#?reserve)\s*(?:ทะเบียน(?:รถ)?|plate|license\s*plate)?\s*[:：-]?\s*(.+)$/i
  ];
  for (const pattern of reservePatterns) {
    const match = cleaned.match(pattern);
    if (match?.[1]) {
      const plate = normalizeCommandPlate(match[1]);
      if (plate) return { action: "reserve", plate };
    }
  }

  const unreservePatterns = [
    /(?:^|\s)(?:ยกเลิกจองทะเบียน|ปล่อยจองทะเบียน|ยกเลิก|ปล่อยจอง|#?unreserve)\s*(?:ทะเบียน(?:รถ)?|plate|license\s*plate)?\s*[:：-]?\s*(.+)$/i
  ];
  for (const pattern of unreservePatterns) {
    const match = cleaned.match(pattern);
    if (match?.[1]) {
      const plate = normalizeCommandPlate(match[1]);
      if (plate) return { action: "unreserve", plate };
    }
  }

  return null;
}

export function parseLineReservationCommands(text: string): Array<{
  action: LineReservationAction;
  plate: string;
}> {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseReserveAction(line))
    .filter((item): item is { action: LineReservationAction; plate: string } => Boolean(item));
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
  return applyLineReservationCommands([
    {
      text: input.text,
      sourceGroupId: input.sourceGroupId,
      receivedAt: input.receivedAt
    }
  ]);
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

  const applied: Array<{
    action: LineReservationAction;
    plate: string;
    plateNormalized: string;
    active: boolean;
  }> = [];

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
    applied.push({
      action: parsed.action,
      plate: parsed.plate,
      plateNormalized,
      active: record.active
    });
  }

  if (!applied.length) return null;

  await writeStore(store);

  return applied.length === 1 ? applied[0] : { applied };
}

