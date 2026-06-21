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

function pickIdNumber(text: string) {
  const match = text.match(/(?:^|[^\d])(\d[\d\-\s]{11,20}\d)(?:$|[^\d])/);
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
      .filter(Boolean);
    return joinAddressLines(collected);
  }

  const addressHints = lines.filter((line) => /ถ\.|ถนน|ซอย|แขวง|เขต|อ\.|อำเภอ|ต\.|ตำบล|จังหวัด|หมู่|บ้านเลขที่|road|rd\.?|street/i.test(line));
  if (addressHints.length > 0) {
    return joinAddressLines(addressHints.slice(0, 4));
  }

  const compactMatch = text.match(/(.{8,160}(?:ถ\.|ถนน|ซอย|แขวง|เขต|อ\.|อำเภอ|ต\.|ตำบล|จังหวัด).*)/i);
  return safeString(compactMatch?.[1] || "");
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
    })
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
  const fields = normalizeResult(parseHeuristicFields(text, documentType), documentType).fields;
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
      return await runOpenAiOcr(input);
    } catch (error) {
      if (!isOpenAiFallbackError(error)) {
        throw error;
      }
    }
  }

  try {
    const rawText = await readFreeOcrText(input);
    const fields = parseHeuristicFields(rawText, documentType);
    const normalized = normalizeResult(fields, documentType);
    const provider = determineFreeOcrProvider(documentType, normalized.fields);
    return {
      ...normalized,
      provider,
      rawText: normalized.rawText || rawText
    };
  } catch {
    return buildFallbackResult(documentType, "", "fallback");
  }
}

export function mapOcrToBookingReportFields(result: BookingReportOcrResult) {
  const fields = result.fields;

  if (result.documentType === "company_certificate") {
    return {
      customerName: fields.companyName || fields.name,
      idCard: normalizeDigits(fields.taxId),
      phone: normalizeDigits(fields.phone),
      address: fields.companyAddress || fields.address
    };
  }

  if (result.documentType === "business_card") {
    return {
      customerName: fields.contactName || fields.companyName || fields.name,
      idCard: normalizeDigits(fields.taxId),
      phone: normalizeDigits(fields.phone),
      address: fields.address || fields.companyAddress
    };
  }

  return {
    customerName: fields.name,
    idCard: normalizeDigits(fields.idNumber),
    phone: normalizeDigits(fields.phone),
    address: fields.address
  };
}
