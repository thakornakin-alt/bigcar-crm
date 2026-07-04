export type VehicleDeliveryOcrProvider = "free-ocr" | "fallback";

export type VehicleDeliveryOcrInput = {
  base64: string;
  mimeType: string;
};

export type VehicleDeliveryOcrFields = {
  customer_name?: string;
  customer_id_no?: string;
  customer_address_1?: string;
  customer_address_2?: string;
  customer_postal_code?: string;
  rawText: string;
};

export type VehicleDeliveryOcrResult = {
  provider: VehicleDeliveryOcrProvider;
  fields: VehicleDeliveryOcrFields;
  rawText: string;
};

function safe(value: unknown) {
  return String(value || "").trim();
}

function normalizeLines(text: string) {
  return safe(text)
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function isThaiMonth(token: string) {
  return /^(?:ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)$/i.test(
    safe(token)
  );
}

function isDateLikeLine(line: string) {
  const parts = safe(line).split(/\s+/);
  if (parts.length === 3 && /^\d{1,2}$/.test(parts[0] || "") && isThaiMonth(parts[1] || "") && /^\d{2,4}$/.test(parts[2] || "")) return true;
  return /(?:เกิดวันที่|date of birth|วันออกบัตร|date of issue|วันบัตรหมดอายุ|date of expiry|เจ้าพนักงานออกบัตร)/i.test(line);
}

function cleanupAddressNoise(text: string) {
  return safe(text)
    .replace(/\b\d[\d\s-]{10,18}\d\b/g, " ")
    .replace(/\b(?:130|140|150|160|170|180)\b\.?/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractThaiName(text: string) {
  const compact = safe(text);
  const match = compact.match(/(?:นาย|นางสาว|น\.ส\.|นาง)\s*([ก-๙A-Za-z]+)(?:\s+([ก-๙A-Za-z]+))?/);
  if (match?.[1]) return [match[1], match[2]].filter(Boolean).join(" ").trim();
  return "";
}

function extractIdNumber(text: string) {
  const compact = safe(text);
  const labeled = compact.match(/(?:เลขประจำตัวประชาชน|เลขบัตรประชาชน|identification number|id(?:\s*no\.?)?)\s*[:\-]?\s*([0-9\s-]{13,25})/i);
  const candidate = labeled?.[1] || compact.match(/\b[0-9][0-9\s-]{11,23}[0-9]\b/)?.[0] || "";
  const digits = candidate.replace(/\D/g, "");
  return digits.length === 13 ? digits : "";
}

function extractAddress(lines: string[]) {
  const filtered = lines.filter((line) => !isDateLikeLine(line));
  const markerIndex = filtered.findIndex((line) => /ที่อยู่|address/i.test(line));
  const addressLines = markerIndex >= 0 ? filtered.slice(markerIndex, markerIndex + 4) : filtered;
  const addressText = cleanupAddressNoise(
    addressLines
      .join(" ")
      .replace(/(?:ที่อยู่|address)\s*[:\-]?/i, " ")
  );
  const postalCode = addressText.match(/\b(\d{5})\b/)?.[1] || "";
  const withoutPostal = postalCode ? addressText.replace(new RegExp(`\\b${postalCode}\\b`), " ").replace(/\s+/g, " ").trim() : addressText;
  return {
    customer_address_1: withoutPostal,
    customer_address_2: "",
    customer_postal_code: postalCode
  };
}

function extractTextFields(text: string): VehicleDeliveryOcrFields {
  const lines = normalizeLines(text);
  const compact = lines.join(" ");
  const address = extractAddress(lines);
  return {
    rawText: compact,
    customer_name: extractThaiName(compact),
    customer_id_no: extractIdNumber(compact),
    ...address
  };
}

async function readFreeOcrText(input: VehicleDeliveryOcrInput) {
  const response = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      apikey: process.env.OCR_SPACE_API_KEY || "helloworld",
      language: "tha",
      isOverlayRequired: "false",
      OCREngine: "2",
      scale: "true",
      base64Image: `data:${safe(input.mimeType) || "image/jpeg"};base64,${safe(input.base64)}`
    })
  });

  const data = (await response.json().catch(() => ({}))) as {
    OCRExitCode?: number;
    IsErroredOnProcessing?: boolean;
    ErrorMessage?: string[] | string;
    ParsedResults?: Array<{ ParsedText?: string }>;
  };

  if (!response.ok || data.IsErroredOnProcessing || data.OCRExitCode !== 1) {
    const message = Array.isArray(data.ErrorMessage) ? data.ErrorMessage.join(" ") : data.ErrorMessage || "free OCR provider request failed";
    throw new Error(message);
  }

  return safe(data.ParsedResults?.[0]?.ParsedText || "");
}

export async function runVehicleDeliveryOcr(input: VehicleDeliveryOcrInput): Promise<VehicleDeliveryOcrResult> {
  if (!safe(input.base64)) throw new Error("ไม่พบรูปสำหรับ OCR");
  if (!safe(input.mimeType).startsWith("image/")) throw new Error("OCR รองรับเฉพาะรูปภาพ");

  try {
    const rawText = await readFreeOcrText(input);
    const fields = extractTextFields(rawText);
    const provider: VehicleDeliveryOcrProvider = fields.customer_name || fields.customer_id_no || fields.customer_address_1 ? "free-ocr" : "fallback";
    return {
      provider,
      fields,
      rawText: fields.rawText
    };
  } catch {
    return {
      provider: "fallback",
      fields: { rawText: "" },
      rawText: ""
    };
  }
}
