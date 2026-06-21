export type BookingReportOcrDocumentType = "id_card" | "company_certificate" | "business_card" | "unknown";

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
  if (!key) throw new Error("ยังไม่ได้ตั้งค่า OPENAI_API_KEY สำหรับ OCR");
  return key;
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
    fields,
    rawText: fields.rawText
  };
}

export async function runBookingReportOcr(input: BookingReportOcrInput): Promise<BookingReportOcrResult> {
  const base64 = safeString(input.base64);
  const mimeType = safeString(input.mimeType) || "image/jpeg";
  const documentType = input.documentType || "unknown";

  if (!base64) throw new Error("ไม่พบรูปสำหรับ OCR");
  if (!mimeType.startsWith("image/")) throw new Error("OCR รองรับเฉพาะรูปภาพ");
  if (base64.length > 12_000_000) throw new Error("รูปใหญ่เกินไป กรุณาถ่ายใหม่ให้ชัดและใกล้ขึ้น");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getOpenAiKey()}`,
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
  return normalizeResult(parsed, documentType);
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
