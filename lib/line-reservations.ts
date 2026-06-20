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

async function readStore() {
  const { readJsonStore } = await import("./json-store");
  return readJsonStore<LineReservationStore>(STORE_FILE, { byPlate: {} });
}

async function writeStore(store: LineReservationStore) {
  const { writeJsonStore } = await import("./json-store");
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
    active: record.active,
    writeSuccess: true
  };
}

