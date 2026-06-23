import type { PowerOfAttorneySuggestion } from "@/lib/documents-v2/power-of-attorney";
import { splitPowerOfAttorneyAddress } from "@/lib/documents-v2/power-of-attorney";

export type PowerOfAttorneyOcrDocumentType = "id_card" | "company_certificate";
export type PowerOfAttorneyOcrProvider = "free-ocr" | "fallback";

export type PowerOfAttorneyOcrInput = {
  base64: string;
  mimeType: string;
  documentType: PowerOfAttorneyOcrDocumentType;
};

export type PowerOfAttorneyOcrResult = {
  provider: PowerOfAttorneyOcrProvider;
  documentType: PowerOfAttorneyOcrDocumentType;
  fields: PowerOfAttorneySuggestion & {
    rawText: string;
  };
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

function isDateLine(line: string) {
  const parts = safe(line).split(/\s+/);
  return parts.length === 3 && /^\d{1,2}$/.test(parts[0] || "") && isThaiMonth(parts[1] || "") && /^\d{2,4}$/.test(parts[2] || "");
}

function cleanAddressText(text: string) {
  const lines = normalizeLines(text).filter((line) => !/(?:เกิดวันที่|date of birth|วันออกบัตร|date of issue|วันบัตรหมดอายุ|date of expiry|เจ้าพนักงานออกบัตร)/i.test(line));
  while (lines.length && isDateLine(lines[lines.length - 1])) {
    lines.pop();
  }
  return lines.join(" ").replace(/\b\d{5}\b/g, " ").replace(/\s+/g, " ").trim();
}

function extractThaiName(text: string) {
  const match = safe(text).match(/(?:นาย|นางสาว|น\.ส\.|นาง)\s+([ก-๙A-Za-z]+)(?:\s+([ก-๙A-Za-z]+))?/);
  if (match?.[1]) return [match[1], match[2]].filter(Boolean).join(" ").trim();
  const fallback = safe(text).match(/([ก-๙A-Za-z]{2,}\s+[ก-๙A-Za-z]{2,})/);
  return safe(fallback?.[1] || "");
}

function extractCompanyName(lines: string[]) {
  return (
    lines.find((line) => /(บริษัท|จำกัด|มหาชน|co\.?,?\s*ltd\.?)/i.test(line)) ||
    lines[0] ||
    ""
  ).trim();
}

function extractAddress(lines: string[]) {
  const markerIndex = lines.findIndex((line) => /ที่อยู่|address/i.test(line));
  const source = markerIndex >= 0 ? lines.slice(markerIndex, markerIndex + 5).join(" ") : lines.join(" ");
  return cleanAddressText(source);
}

function extractLabeledValue(text: string, labels: RegExp[]) {
  for (const label of labels) {
    const match = safe(text).match(new RegExp(`${label.source}\\s*[:\\-]?\\s*([ก-๙A-Za-z0-9./\\- ]{1,60})`, "i"));
    if (match?.[1]) return match[1].trim().replace(/\b(?:140|150|160|170|180)\b\.?/g, " ").replace(/\s+/g, " ").trim();
  }
  return "";
}

function extractTextFields(text: string, documentType: PowerOfAttorneyOcrDocumentType): PowerOfAttorneySuggestion & { rawText: string } {
  const lines = normalizeLines(text);
  const compact = lines.join(" ");
  const address = extractAddress(lines);
  const suggestion: PowerOfAttorneySuggestion & { rawText: string } = {
    rawText: compact
  };

  if (documentType === "company_certificate") {
    suggestion.customerName = extractCompanyName(lines);
    Object.assign(suggestion, splitPowerOfAttorneyAddress(address));
    return suggestion;
  }

  suggestion.customerName = extractThaiName(compact);
  suggestion.customer_age = extractLabeledValue(compact, [/อายุ/]);
  suggestion.customer_race = extractLabeledValue(compact, [/เชื้อชาติ/]);
  suggestion.customer_nationality = extractLabeledValue(compact, [/สัญชาติ/]);
  Object.assign(suggestion, splitPowerOfAttorneyAddress(address));
  return suggestion;
}

async function readFreeOcrText(input: PowerOfAttorneyOcrInput) {
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

export async function runPowerOfAttorneyOcr(input: PowerOfAttorneyOcrInput): Promise<PowerOfAttorneyOcrResult> {
  if (!safe(input.base64)) throw new Error("ไม่พบรูปสำหรับ OCR");
  if (!safe(input.mimeType).startsWith("image/")) throw new Error("OCR รองรับเฉพาะรูปภาพ");

  try {
    const rawText = await readFreeOcrText(input);
    const fields = extractTextFields(rawText, input.documentType);
    const provider: PowerOfAttorneyOcrProvider = fields.customerName || fields.customer_house_no || fields.customer_province ? "free-ocr" : "fallback";
    return {
      provider,
      documentType: input.documentType,
      fields,
      rawText: fields.rawText
    };
  } catch {
    return {
      provider: "fallback",
      documentType: input.documentType,
      fields: { rawText: "" },
      rawText: ""
    };
  }
}
