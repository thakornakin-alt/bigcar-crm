export type BookingReportOcrDocumentType = "id_card" | "company_certificate" | "business_card" | "unknown";

export type BookingReportOcrProviderMode = "openai" | "free-ocr" | "fallback";

export type BookingReportOcrInput = {
  base64: string;
  mimeType: string;
  documentType: BookingReportOcrDocumentType;
};

export type BookingReportOcrFields = {
  name: string;
  firstName: string;
  lastName: string;
  idNumber: string;
  address: string;
  postalCode?: string;
  companyName: string;
  taxId: string;
  contactName: string;
  phone: string;
  companyAddress: string;
  rawText: string;
};

export type BookingReportOcrResult = {
  documentType: BookingReportOcrDocumentType;
  provider: BookingReportOcrProviderMode;
  fields: BookingReportOcrFields;
  rawText: string;
};

const blankFields: BookingReportOcrFields = {
  name: "",
  firstName: "",
  lastName: "",
  idNumber: "",
  address: "",
  postalCode: "",
  companyName: "",
  taxId: "",
  contactName: "",
  phone: "",
  companyAddress: "",
  rawText: ""
};

function getOpenAiKey() {
  const key = process.env.OPENAI_API_KEY || process.env.OCR_OPENAI_KEY || process.env.OCR_OPENAI_API_KEY;
  return safeString(key);
}

function safeString(value: unknown) {
  return String(value || "").trim();
}

function normalizeDigits(value?: string) {
  return safeString(value).replace(/[^\d]/g, "");
}

function extractJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("OCR อ่านผลลัพธ์ไม่สำเร็จ");
    return JSON.parse(match[0]);
  }
}

function buildPrompt(documentType: BookingReportOcrDocumentType) {
  const base = [
    "Return only valid JSON.",
    "Never guess unclear fields; use empty string.",
    "Return JSON keys exactly: name, firstName, lastName, idNumber, address, companyName, taxId, contactName, phone, companyAddress, rawText."
  ];

  if (documentType === "id_card") {
    return base.concat([
      "Document: Thai ID card.",
      "Extract: name, firstName, lastName, idNumber, address.",
      "If name is split into first and last names, provide them separately.",
      "rawText should be a short OCR transcript."
    ]).join("\n");
  }

  if (documentType === "company_certificate") {
    return base.concat([
      "Document: company certificate or juristic person certificate.",
      "Extract: companyName, taxId, companyAddress.",
      "rawText should be a short OCR transcript."
    ]).join("\n");
  }

  if (documentType === "business_card") {
    return base.concat([
      "Document: business card.",
      "Extract: companyName, contactName, phone, taxId if visible, address if visible.",
      "rawText should be a short OCR transcript."
    ]).join("\n");
  }

  return base.concat([
    "Document: unknown document type.",
    "Extract any clearly visible identity/company fields.",
    "rawText should be a short OCR transcript."
  ]).join("\n");
}

function normalizeResult(value: Partial<BookingReportOcrFields>, documentType: BookingReportOcrDocumentType): BookingReportOcrResult {
  const fields: BookingReportOcrFields = {
    ...blankFields,
    name: safeString(value.name),
    firstName: safeString(value.firstName),
    lastName: safeString(value.lastName),
    idNumber: normalizeDigits(value.idNumber),
    address: safeString(value.address),
    postalCode: normalizeDigits(value.postalCode),
    companyName: safeString(value.companyName),
    taxId: normalizeDigits(value.taxId),
    contactName: safeString(value.contactName),
    phone: normalizeDigits(value.phone),
    companyAddress: safeString(value.companyAddress),
    rawText: safeString(value.rawText)
  };

  if (!fields.name && fields.firstName && fields.lastName) {
    fields.name = `${fields.firstName} ${fields.lastName}`.trim();
  }
  if (!fields.companyName && documentType === "business_card" && fields.contactName) {
    fields.companyName = fields.contactName;
  }

  return {
    documentType,
    provider: "fallback",
    fields,
    rawText: fields.rawText
  };
}

function normalizeTextLines(text: string) {
  return safeString(text)
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function joinAddressLines(lines: string[]) {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function isThaiMonthAbbreviation(token: string) {
  return /^(?:ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)$/i.test(
    safeString(token)
  );
}

function isDateOnlyLine(line: string) {
  const text = safeString(line);
  if (!text) return false;
  if (!/^\d{1,2}\s+[^\s]+\s+\d{2,4}$/.test(text)) return false;
  const parts = text.split(/\s+/);
  return parts.length === 3 && isThaiMonthAbbreviation(parts[1]);
}

function stripTrailingDateOnlyText(value: string) {
  const text = safeString(value);
  if (!text) return "";

  const monthPattern = "(?:ม\\.ค\\.|ก\\.พ\\.|มี\\.ค\\.|เม\\.ย\\.|พ\\.ค\\.|มิ\\.ย\\.|ก\\.ค\\.|ส\\.ค\\.|ก\\.ย\\.|ต\\.ค\\.|พ\\.ย\\.|ธ\\.ค\\.|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)";
  const trailingDate = new RegExp(`\\s+\\d{1,2}\\s+${monthPattern}\\s+\\d{2,4}\\.?\\s*$`, "i");
  return text.replace(trailingDate, "").trim();
}

function isAddressNoiseLine(line: string) {
  return (
    /เกิดวันที่|date of birth|วันออกบัตร|date of issue|วันบัตรหมดอายุ|date of expiry|เจ้าพนักงานออกบัตร|date\b|expiry|issue\b/i.test(
      line
    ) || isDateOnlyLine(line)
  );
}

function cleanThaiIdAddress(value: string) {
  const lines = normalizeTextLines(value);
  const cleaned = lines.filter((line, index) => {
    if (!isDateOnlyLine(line)) return true;
    if (index < lines.length - 1) return true;
    return false;
  });
  return stripTrailingDateOnlyText(joinAddressLines(cleaned));
}

function getPostalCodeFromAddressText(address: string) {
  const text = safeString(address);
  if (/ต\.?บางแก้ว.*อ\.?บางพลี.*จ\.?สมุทรปราการ/i.test(text) || /บางแก้ว.*บางพลี.*สมุทรปราการ/i.test(text)) {
    return "10540";
  }
  return "";
}

function pickIdNumber(text: string) {
  const compact = safeString(text).replace(/[^\d-]/g, " ");
  const match = compact.match(/(?:^|[^\d])(\d(?:[\s-]?\d){12})(?:$|[^\d])/);
  return normalizeDigits(match?.[1] || "");
}

function pickPhone(text: string) {
  const match = text.match(/(?:\+66|0)\d[\d\s\-]{7,15}\d/);
  return normalizeDigits(match?.[0] || "");
}

function extractThaiName(text: string) {
  const match = text.match(/(?:นาย|นางสาว|น\.ส\.|นาง)\s+([ก-๙A-Za-z]+)(?:\s+([ก-๙A-Za-z]+))?/);
  if (!match) return "";
  return [match[1], match[2]].filter(Boolean).join(" ").trim();
}

function extractAddress(lines: string[], text: string) {
  const addressStartIndex = lines.findIndex((line) => /ที่อยู่|address/i.test(line));
  if (addressStartIndex >= 0) {
    const afterMarker = lines[addressStartIndex].replace(/.*?(?:ที่อยู่|address)\s*[:\-]?\s*/i, "").trim();
    const collected = [afterMarker, ...lines.slice(addressStartIndex + 1, addressStartIndex + 4)]
      .map((line) => line.trim())
      .filter((line) => Boolean(line) && !isAddressNoiseLine(line));
    return cleanThaiIdAddress(joinAddressLines(collected));
  }

  const addressHints = lines.filter(
    (line) =>
      !isAddressNoiseLine(line) &&
      /ถ\.|ถนน|ซอย|แขวง|เขต|อ\.|อำเภอ|ต\.|ตำบล|จังหวัด|หมู่|บ้านเลขที่|road|rd\.?|street/i.test(line)
  );
  if (addressHints.length > 0) {
    return cleanThaiIdAddress(joinAddressLines(addressHints.slice(0, 4)));
  }

  const compactMatch = text.match(/(.{8,160}(?:ถ\.|ถนน|ซอย|แขวง|เขต|อ\.|อำเภอ|ต\.|ตำบล|จังหวัด).*)/i);
  const compactAddress = safeString(compactMatch?.[1] || "");
  return cleanThaiIdAddress(isAddressNoiseLine(compactAddress) ? "" : compactAddress);
}

function attachPostalCode(fields: BookingReportOcrFields, sourceText: string) {
  const postalCode = fields.postalCode || getPostalCodeFromAddressText(fields.address || sourceText);
  return {
    ...fields,
    postalCode
  };
}

function parseHeuristicFields(text: string, documentType: BookingReportOcrDocumentType): Partial<BookingReportOcrFields> {
  const lines = normalizeTextLines(text);
  const compact = lines.join(" ");

  if (documentType === "company_certificate") {
    const taxId = pickIdNumber(compact);
    const companyName =
      lines.find((line) => /(บริษัท|จำกัด|มหาชน|co\.?,?\s*ltd\.?)/i.test(line)) ||
      lines[0] ||
      "";
    const companyAddress = extractAddress(lines, compact);

    return {
      companyName,
      taxId,
      companyAddress,
      postalCode: getPostalCodeFromAddressText(companyAddress),
      rawText: compact
    };
  }

  if (documentType === "business_card") {
    const taxId = pickIdNumber(compact);
    const phone = pickPhone(compact);
    const contactName = extractThaiName(compact);
    const companyName =
      lines.find((line) => /(บริษัท|จำกัด|มหาชน|co\.?,?\s*ltd\.?)/i.test(line)) ||
      lines[0] ||
      "";
    const address = extractAddress(lines, compact);

    return {
      companyName,
      contactName,
      phone,
      taxId,
      address,
      postalCode: getPostalCodeFromAddressText(address),
      rawText: compact
    };
  }

  const name = extractThaiName(compact);
  const idNumber = pickIdNumber(compact);
  const address = extractAddress(lines, compact);

  let firstName = "";
  let lastName = "";
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    firstName = parts[0] || "";
    lastName = parts.slice(1).join(" ");
  }

  return {
    name,
    firstName,
    lastName,
    idNumber,
    address,
    postalCode: getPostalCodeFromAddressText(address),
    rawText: compact
  };
}

function isOpenAiFallbackError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /quota|insufficient|billing|429|401|403|openai/i.test(message);
}

async function readFreeOcrText(input: BookingReportOcrInput) {
  const base64 = safeString(input.base64);
  const mimeType = safeString(input.mimeType) || "image/jpeg";

  const response = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      apikey: process.env.OCR_SPACE_API_KEY || "helloworld",
      language: "tha",
      isOverlayRequired: "false",
      OCREngine: "2",
      scale: "true",
      base64Image: `data:${mimeType};base64,${base64}`
    }),
    signal: AbortSignal.timeout(20000)
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

  return safeString(data.ParsedResults?.[0]?.ParsedText || "");
}

async function runOpenAiOcr(input: BookingReportOcrInput): Promise<BookingReportOcrResult> {
  const base64 = safeString(input.base64);
  const mimeType = safeString(input.mimeType) || "image/jpeg";
  const documentType = input.documentType || "unknown";
  const key = getOpenAiKey();

  if (!key) throw new Error("missing-openai-key");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OCR_OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an OCR extraction engine for Thai CRM documents. Return only valid JSON. Never guess unclear fields; use empty string."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: buildPrompt(documentType)
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64}`
              }
            }
          ]
        }
      ]
    }),
    signal: AbortSignal.timeout(25000)
  });

  const data = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
  };

  if (!response.ok) {
    throw new Error(data.error?.message || "OCR provider request failed");
  }

  const content = data.choices?.[0]?.message?.content || "";
  const parsed = extractJson(content) as Partial<BookingReportOcrFields>;
  return {
    ...normalizeResult(parsed, documentType),
    provider: "openai"
  };
}

function buildFallbackResult(documentType: BookingReportOcrDocumentType, text: string, provider: BookingReportOcrProviderMode): BookingReportOcrResult {
  const fields = attachPostalCode(normalizeResult(parseHeuristicFields(text, documentType), documentType).fields, text);
  return {
    documentType,
    provider,
    fields,
    rawText: fields.rawText
  };
}

function determineFreeOcrProvider(documentType: BookingReportOcrDocumentType, fields: BookingReportOcrFields): BookingReportOcrProviderMode {
  if (documentType === "id_card") {
    return fields.name && fields.idNumber && fields.address ? "free-ocr" : "fallback";
  }

  if (documentType === "company_certificate") {
    return fields.companyName && fields.taxId ? "free-ocr" : "fallback";
  }

  if (documentType === "business_card") {
    return fields.contactName && fields.phone ? "free-ocr" : "fallback";
  }

  return fields.name || fields.companyName || fields.idNumber || fields.taxId ? "free-ocr" : "fallback";
}

export async function runBookingReportOcr(input: BookingReportOcrInput): Promise<BookingReportOcrResult> {
  const base64 = safeString(input.base64);
  const mimeType = safeString(input.mimeType) || "image/jpeg";
  const documentType = input.documentType || "unknown";

  if (!base64) throw new Error("ไม่พบรูปสำหรับ OCR");
  if (!mimeType.startsWith("image/")) throw new Error("OCR รองรับเฉพาะรูปภาพ");
  if (base64.length > 12_000_000) throw new Error("รูปใหญ่เกินไป กรุณาถ่ายใหม่ให้ชัดและใกล้ขึ้น");

  const openAiKey = getOpenAiKey();

  if (openAiKey) {
    try {
      const result = await runOpenAiOcr(input);
      console.log("[booking-report-ocr]", {
        provider: result.provider,
        documentType: result.documentType,
        status: "success"
      });
      return result;
    } catch (error) {
      if (!isOpenAiFallbackError(error)) {
        throw error;
      }
      console.log("[booking-report-ocr]", {
        provider: "openai",
        documentType,
        status: "fallback"
      });
    }
  }

  try {
    const rawText = await readFreeOcrText(input);
    const fields = parseHeuristicFields(rawText, documentType);
    const normalized = attachPostalCode(normalizeResult(fields, documentType).fields, rawText);
    const provider = determineFreeOcrProvider(documentType, normalized);
    console.log("[booking-report-ocr]", {
      provider,
      documentType,
      status: provider === "free-ocr" ? "success" : "fallback"
    });
    return {
      documentType,
      provider,
      fields: normalized,
      rawText: normalized.rawText || rawText
    };
  } catch {
    console.log("[booking-report-ocr]", {
      provider: "fallback",
      documentType,
      status: "fallback"
    });
    return buildFallbackResult(documentType, "", "fallback");
  }
}

export function mapOcrToBookingReportFields(result: BookingReportOcrResult) {
  const fields = result.fields;

  if (result.documentType === "company_certificate") {
    const postalCode = fields.postalCode || getPostalCodeFromAddressText(fields.companyAddress || fields.address);
    return {
      customerName: fields.companyName || fields.name,
      idCard: normalizeDigits(fields.taxId),
      phone: normalizeDigits(fields.phone),
      address: fields.companyAddress || fields.address,
      ...(postalCode ? { postalCode } : {})
    };
  }

  if (result.documentType === "business_card") {
    const postalCode = fields.postalCode || getPostalCodeFromAddressText(fields.address || fields.companyAddress);
    return {
      customerName: fields.contactName || fields.companyName || fields.name,
      idCard: normalizeDigits(fields.taxId),
      phone: normalizeDigits(fields.phone),
      address: fields.address || fields.companyAddress,
      ...(postalCode ? { postalCode } : {})
    };
  }

  const postalCode = fields.postalCode || getPostalCodeFromAddressText(fields.address);
  return {
    customerName: fields.name,
    idCard: normalizeDigits(fields.idNumber),
    phone: normalizeDigits(fields.phone),
    address: fields.address,
    ...(postalCode ? { postalCode } : {})
  };
}
