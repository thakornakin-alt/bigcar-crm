export type OcrBuyerType = "individual" | "company";

export type OcrDocumentInput = {
  base64: string;
  mimeType: string;
  buyerType: OcrBuyerType;
};

export type OcrDocumentResult = {
  documentType: OcrBuyerType | "unknown";
  name: string;
  idNumber: string;
  birthDate: string;
  address: string;
  companyName: string;
  taxId: string;
  companyAddress: string;
  rawText: string;
};

const blankResult: OcrDocumentResult = {
  documentType: "unknown",
  name: "",
  idNumber: "",
  birthDate: "",
  address: "",
  companyName: "",
  taxId: "",
  companyAddress: "",
  rawText: ""
};

function getOpenAiKey() {
  const key = process.env.OPENAI_API_KEY || process.env.OCR_OPENAI_API_KEY;
  if (!key) throw new Error("ยังไม่ได้ตั้งค่า OPENAI_API_KEY สำหรับ OCR");
  return key;
}

function safeString(value: unknown) {
  return String(value || "").trim();
}

function normalizeOcrResult(value: Partial<OcrDocumentResult>): OcrDocumentResult {
  const documentType = value.documentType === "individual" || value.documentType === "company" ? value.documentType : "unknown";
  return {
    documentType,
    name: safeString(value.name),
    idNumber: safeString(value.idNumber).replace(/[^\d]/g, ""),
    birthDate: safeString(value.birthDate),
    address: safeString(value.address),
    companyName: safeString(value.companyName),
    taxId: safeString(value.taxId).replace(/[^\d]/g, ""),
    companyAddress: safeString(value.companyAddress),
    rawText: safeString(value.rawText)
  };
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

export async function readDocumentOcr(input: OcrDocumentInput) {
  const base64 = safeString(input.base64);
  const mimeType = safeString(input.mimeType) || "image/jpeg";
  const buyerType = input.buyerType === "company" ? "company" : "individual";

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
              text: [
                `Document target: ${buyerType}.`,
                "Extract Thai ID card, business card, or company certificate fields.",
                "Return JSON keys exactly:",
                "documentType, name, idNumber, birthDate, address, companyName, taxId, companyAddress, rawText.",
                "For individual: name is full Thai name, idNumber is Thai national ID, birthDate if visible, address if visible.",
                "For company: companyName, taxId, companyAddress.",
                "rawText should be a short OCR transcript."
              ].join("\n")
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
  return normalizeOcrResult(extractJson(content) as Partial<OcrDocumentResult> || blankResult);
}
