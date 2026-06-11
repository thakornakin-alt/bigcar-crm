export type LineReservationAction = "reserve" | "unreserve";

export type ParsedLineReservation = {
  action: LineReservationAction;
  plate: string;
  displayPlate: string;
  matchKey: string;
};

export function normalizePlateForMatch(value: string) {
  return String(value || "")
    .toUpperCase()
    .replace(/[.\-_/\\\s]+/g, "")
    .trim();
}

export function normalizeDisplayPlate(value: string) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function extractPlateText(text: string) {
  const cleaned = String(text || "").trim();
  if (!cleaned) return "";

  const patterns = [
    /(?:^|\s)(?:ติดจอง|จอง|#?reserve)\s*(?:ทะเบียน\s*)?[:：-]?\s*([^\r\n]+?)\s*$/i,
    /(?:^|\s)(?:ยกเลิก|ปล่อยจอง|#?unreserve)\s*(?:ทะเบียน\s*)?[:：-]?\s*([^\r\n]+?)\s*$/i
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (!match?.[1]) continue;
    const candidate = normalizeDisplayPlate(match[1]);
    if (!candidate || candidate === "ทะเบียน") continue;
    return candidate.replace(/^ทะเบียน\s*/i, "").trim();
  }

  return "";
}

export function parseLineReservationText(text: string): ParsedLineReservation | null {
  const cleaned = String(text || "").trim();
  if (!cleaned) return null;

  const reserveLike = /(?:^|\s)(?:ติดจอง|จอง|#?reserve)/i.test(cleaned);
  const unreserveLike = /(?:^|\s)(?:ยกเลิก|ปล่อยจอง|#?unreserve)/i.test(cleaned);

  const plate = extractPlateText(cleaned);
  if (!plate) return null;

  if (reserveLike) {
    return { action: "reserve", plate, displayPlate: normalizeDisplayPlate(plate), matchKey: normalizePlateForMatch(plate) };
  }

  if (unreserveLike) {
    return { action: "unreserve", plate, displayPlate: normalizeDisplayPlate(plate), matchKey: normalizePlateForMatch(plate) };
  }

  return null;
}

export function parseLineReservationCommands(text: string): ParsedLineReservation[] {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const candidates = lines.length > 1 ? lines : [String(text || "").trim()];
  const parsed = candidates
    .map((line) => parseLineReservationText(line))
    .filter((item): item is ParsedLineReservation => Boolean(item?.matchKey));

  if (parsed.length > 0) return parsed;

  const single = parseLineReservationText(text);
  return single ? [single] : [];
}
