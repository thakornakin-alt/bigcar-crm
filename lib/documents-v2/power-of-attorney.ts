export type PowerOfAttorneyPurpose = "มอบอำนาจรับรถแทน" | "สำหรับโอนรถยนต์";

export type PowerOfAttorneyAddressParts = {
  customer_house_no: string;
  customer_moo: string;
  customer_soi: string;
  customer_road: string;
  cusyomer_subdistrict: string;
  customer_district: string;
  customer_province: string;
};

export type PowerOfAttorneySuggestion = Partial<PowerOfAttorneyAddressParts> & {
  customerName?: string;
  customer_age?: string;
  customer_race?: string;
  customer_nationality?: string;
  plateNo?: string;
  purpose?: PowerOfAttorneyPurpose;
  address?: string;
};

const blankAddressParts: PowerOfAttorneyAddressParts = {
  customer_house_no: "",
  customer_moo: "",
  customer_soi: "",
  customer_road: "",
  cusyomer_subdistrict: "",
  customer_district: "",
  customer_province: ""
};

function cleanText(value: unknown) {
  return String(value || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function normalizeLines(value: unknown) {
  return cleanText(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function removeTrailingNoise(lines: string[]) {
  const monthPattern = /(?:ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;
  return lines.filter((line, index) => {
    if (new RegExp(`^\\d{1,2}\\s+${monthPattern.source}\\s+\\d{2,4}\\s*$`, "i").test(line)) return false;
    if (/(?:เกิดวันที่|date of birth|วันออกบัตร|date of issue|วันบัตรหมดอายุ|date of expiry|เจ้าพนักงานออกบัตร)/i.test(line)) return false;
    return true;
  });
}

function joinText(lines: string[]) {
  return lines.join(" ").replace(/\s+/g, " ").trim();
}

function pickMatch(text: string, regexes: RegExp[]) {
  for (const regex of regexes) {
    const match = text.match(regex);
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

function removePostalCodes(text: string) {
  return String(text || "").replace(/\b\d{5}\b/g, " ").replace(/\s+/g, " ").trim();
}

function removeTrailingHeightNoise(value: string) {
  return String(value || "")
    .replace(/\b(?:140|150|160|170|180)\b\.?/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function composePowerOfAttorneyVehiclePlate(plateValue: unknown, purpose: PowerOfAttorneyPurpose) {
  const plate = String(plateValue || "").trim().replace(/\s+/g, " ");
  const selectedPurpose = purpose || "มอบอำนาจรับรถแทน";
  if (!plate) return "";
  return `${selectedPurpose} ทะเบียน ${plate}`;
}

export function splitPowerOfAttorneyAddress(input: unknown): PowerOfAttorneyAddressParts {
  const lines = removeTrailingNoise(normalizeLines(input));
  const compact = removePostalCodes(joinText(lines));

  const houseNo = pickMatch(compact, [
    /(?:^|\s)(?:เลขที่\s*)?(\d+[\/\d-]*)(?=\s|$)/i
  ]);
  const moo = pickMatch(compact, [
    /(?:หมู่ที่|หมู่|ม\.)\s*([0-9A-Za-z\/-]+)/i
  ]);
  const soi = pickMatch(compact, [
    /(?:ซอย|ซ\.)\s*([^\s,]+(?:\s+[^\s,]+){0,4}?)(?=\s+(?:ถนน|ถ\.|ตำบล|ต\.|แขวง|อำเภอ|อ\.|เขต|จังหวัด|จ\.)|$)/i
  ]);
  const road = pickMatch(compact, [
    /(?:ถนน|ถ\.)\s*([^\s,]+(?:\s+[^\s,]+){0,4}?)(?=\s+(?:ตำบล|ต\.|แขวง|อำเภอ|อ\.|เขต|จังหวัด|จ\.)|$)/i
  ]);
  const subdistrict = pickMatch(compact, [
    /(?:ตำบล|ต\.|แขวง)\s*([^\s,]+(?:\s+[^\s,]+){0,4}?)(?=\s+(?:อำเภอ|อ\.|เขต|จังหวัด|จ\.)|$)/i
  ]);
  const district = pickMatch(compact, [
    /(?:อำเภอ|อ\.|เขต)\s*([^\s,]+(?:\s+[^\s,]+){0,4}?)(?=\s+(?:จังหวัด|จ\.)|$)/i
  ]);
  const province = pickMatch(compact, [
    /(?:จังหวัด|จ\.)\s*([^\s,]+(?:\s+[^\s,]+){0,4}?)(?=$)/i
  ]);

  return {
    ...blankAddressParts,
    customer_house_no: removeTrailingHeightNoise(houseNo),
    customer_moo: removeTrailingHeightNoise(moo),
    customer_soi: removeTrailingHeightNoise(soi),
    customer_road: removeTrailingHeightNoise(road),
    cusyomer_subdistrict: removeTrailingHeightNoise(subdistrict),
    customer_district: removeTrailingHeightNoise(district),
    customer_province: removeTrailingHeightNoise(province)
  };
}

export function mergePowerOfAttorneySuggestion<T extends PowerOfAttorneySuggestion>(
  current: T,
  suggestion: PowerOfAttorneySuggestion,
  touched: Record<string, boolean>
) {
  const next: Record<string, string> = { ...current } as Record<string, string>;
  for (const [key, value] of Object.entries(suggestion)) {
    if (value === undefined || value === null || String(value).trim() === "") continue;
    if (touched[key]) continue;
    if (String(next[key] || "").trim()) continue;
    next[key] = String(value);
  }
  return next as T;
}
