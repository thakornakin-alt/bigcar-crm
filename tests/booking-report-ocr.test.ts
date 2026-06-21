import assert from "node:assert/strict";
import test from "node:test";

test("booking report OCR maps Thai ID card fields into booking form fields", { concurrency: false }, async () => {
  const { mapOcrToBookingReportFields } = await import("../lib/booking-report-ocr.ts");

  const mapped = mapOcrToBookingReportFields({
    documentType: "id_card",
    provider: "fallback",
    rawText: "text",
    fields: {
      name: "สมชาย ใจดี",
      firstName: "สมชาย",
      lastName: "ใจดี",
      idNumber: "1-2345-67890-12-3",
      address: "123 ถนนหลัก",
      companyName: "",
      taxId: "",
      contactName: "",
      phone: "",
      companyAddress: "",
      rawText: "text"
    }
  });

  assert.deepEqual(mapped, {
    customerName: "สมชาย ใจดี",
    idCard: "1234567890123",
    phone: "",
    address: "123 ถนนหลัก"
  });
});

test("booking report OCR maps company certificate fields into company booking form fields", { concurrency: false }, async () => {
  const { mapOcrToBookingReportFields } = await import("../lib/booking-report-ocr.ts");

  const mapped = mapOcrToBookingReportFields({
    documentType: "company_certificate",
    provider: "fallback",
    rawText: "text",
    fields: {
      name: "",
      firstName: "",
      lastName: "",
      idNumber: "",
      address: "",
      companyName: "บิ๊กคาร์ จำกัด",
      taxId: "0-1234-56789-01-2",
      contactName: "",
      phone: "",
      companyAddress: "99 ถนนสุขุมวิท",
      rawText: "text"
    }
  });

  assert.deepEqual(mapped, {
    customerName: "บิ๊กคาร์ จำกัด",
    idCard: "0123456789012",
    phone: "",
    address: "99 ถนนสุขุมวิท"
  });
});

test("booking report OCR maps business card fields and keeps contact phone", { concurrency: false }, async () => {
  const { mapOcrToBookingReportFields } = await import("../lib/booking-report-ocr.ts");

  const mapped = mapOcrToBookingReportFields({
    documentType: "business_card",
    provider: "fallback",
    rawText: "text",
    fields: {
      name: "",
      firstName: "",
      lastName: "",
      idNumber: "",
      address: "12 ถนนพัฒนา",
      companyName: "บิ๊กคาร์",
      taxId: "1234567890123",
      contactName: "สมหญิง รักรถ",
      phone: "081-234-5678",
      companyAddress: "",
      rawText: "text"
    }
  });

  assert.deepEqual(mapped, {
    customerName: "สมหญิง รักรถ",
    idCard: "1234567890123",
    phone: "0812345678",
    address: "12 ถนนพัฒนา"
  });
});

test("booking report OCR tolerates missing fields and only fills what is present", { concurrency: false }, async () => {
  const { mapOcrToBookingReportFields } = await import("../lib/booking-report-ocr.ts");

  const mapped = mapOcrToBookingReportFields({
    documentType: "company_certificate",
    provider: "fallback",
    rawText: "",
    fields: {
      name: "",
      firstName: "",
      lastName: "",
      idNumber: "",
      address: "",
      companyName: "บิ๊กคาร์ จำกัด",
      taxId: "",
      contactName: "",
      phone: "",
      companyAddress: "",
      rawText: ""
    }
  });

  assert.deepEqual(mapped, {
    customerName: "บิ๊กคาร์ จำกัด",
    idCard: "",
    phone: "",
    address: ""
  });
});

test("booking report OCR does not overwrite existing form values when applying", { concurrency: false }, async () => {
  const { mapOcrToBookingReportFields } = await import("../lib/booking-report-ocr.ts");

  const current = {
    buyerType: "individual",
    customerName: "ชื่อเดิม",
    idCard: "1111111111111",
    phone: "0999999999",
    address: "ที่อยู่เดิม"
  };

  const mapped = mapOcrToBookingReportFields({
    documentType: "id_card",
    provider: "fallback",
    rawText: "",
    fields: {
      name: "ชื่อใหม่",
      firstName: "",
      lastName: "",
      idNumber: "2222222222222",
      address: "ที่อยู่ใหม่",
      companyName: "",
      taxId: "",
      contactName: "",
      phone: "0888888888",
      companyAddress: "",
      rawText: ""
    }
  });

  const next = {
    ...current,
    customerName: current.customerName || mapped.customerName,
    idCard: current.idCard || mapped.idCard,
    phone: current.phone || mapped.phone,
    address: current.address || mapped.address
  };

  assert.deepEqual(next, current);
});

test("booking report OCR falls back to free OCR when OpenAI quota is exceeded", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  const originalFreeKey = process.env.OCR_SPACE_API_KEY;
  const originalOcrKey = process.env.OCR_OPENAI_KEY;
  const originalOcrApiKey = process.env.OCR_OPENAI_API_KEY;

  process.env.OPENAI_API_KEY = "test-openai-key";
  delete process.env.OCR_SPACE_API_KEY;
  delete process.env.OCR_OPENAI_KEY;
  delete process.env.OCR_OPENAI_API_KEY;

  const calls: string[] = [];
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    calls.push(String(url));
    if (String(url).includes("api.openai.com")) {
      return new Response(JSON.stringify({ error: { message: "quota exceeded" } }), { status: 429 });
    }
    return new Response(
      JSON.stringify({
        OCRExitCode: 1,
        IsErroredOnProcessing: false,
        ParsedResults: [
          {
            ParsedText: "นาย สมชาย ใจดี\nเลขประจำตัวประชาชน 1 2345 67890 12 3\nที่อยู่ 123 ถนนหลัก กรุงเทพฯ"
          }
        ]
      }),
      { status: 200 }
    );
  }) as typeof fetch;

  try {
    const { runBookingReportOcr } = await import("../lib/booking-report-ocr.ts");

    const result = await runBookingReportOcr({
      base64: "dGVzdA==",
      mimeType: "image/jpeg",
      documentType: "id_card"
    });

    assert.equal(result.provider, "free-ocr");
    assert.equal(result.fields.name, "สมชาย ใจดี");
    assert.equal(result.fields.idNumber, "1234567890123");
    assert.equal(result.fields.address, "123 ถนนหลัก กรุงเทพฯ");
    assert.ok(calls.some((url) => url.includes("api.openai.com")));
    assert.ok(calls.some((url) => url.includes("api.ocr.space")));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalOpenAiKey;
    if (originalFreeKey === undefined) delete process.env.OCR_SPACE_API_KEY;
    else process.env.OCR_SPACE_API_KEY = originalFreeKey;
    if (originalOcrKey === undefined) delete process.env.OCR_OPENAI_KEY;
    else process.env.OCR_OPENAI_KEY = originalOcrKey;
    if (originalOcrApiKey === undefined) delete process.env.OCR_OPENAI_API_KEY;
    else process.env.OCR_OPENAI_API_KEY = originalOcrApiKey;
  }
});

test("booking report OCR free provider tolerates incomplete OCR text without throwing", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  const originalOcrKey = process.env.OCR_OPENAI_KEY;
  const originalOcrApiKey = process.env.OCR_OPENAI_API_KEY;

  delete process.env.OPENAI_API_KEY;
  delete process.env.OCR_OPENAI_KEY;
  delete process.env.OCR_OPENAI_API_KEY;

  globalThis.fetch = (async (url: string | URL) => {
    if (String(url).includes("api.ocr.space")) {
      return new Response(
        JSON.stringify({
          OCRExitCode: 1,
          IsErroredOnProcessing: false,
          ParsedResults: [
            {
              ParsedText: "นาย สมชาย ใจดี\n1-2345-67890-12-3"
            }
          ]
        }),
        { status: 200 }
      );
    }
    throw new Error("OpenAI should not be called without key");
  }) as typeof fetch;

  try {
    const { runBookingReportOcr } = await import("../lib/booking-report-ocr.ts");

    const result = await runBookingReportOcr({
      base64: "dGVzdA==",
      mimeType: "image/jpeg",
      documentType: "id_card"
    });

    assert.equal(result.provider, "fallback");
    assert.equal(result.fields.name, "สมชาย ใจดี");
    assert.equal(result.fields.idNumber, "1234567890123");
    assert.equal(result.fields.address, "");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalOpenAiKey;
    if (originalOcrKey === undefined) delete process.env.OCR_OPENAI_KEY;
    else process.env.OCR_OPENAI_KEY = originalOcrKey;
    if (originalOcrApiKey === undefined) delete process.env.OCR_OPENAI_API_KEY;
    else process.env.OCR_OPENAI_API_KEY = originalOcrApiKey;
  }
});

test("booking report OCR strips date-related lines from extracted address", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const originalOpenAiKey = process.env.OPENAI_API_KEY;

  delete process.env.OPENAI_API_KEY;

  globalThis.fetch = (async (url: string | URL) => {
    if (String(url).includes("api.ocr.space")) {
      return new Response(
        JSON.stringify({
          OCRExitCode: 1,
          IsErroredOnProcessing: false,
          ParsedResults: [
            {
              ParsedText: "นาย สมชาย ใจดี\n1234567890123\n123 ถนนหลัก กรุงเทพฯ\nเกิดวันที่ 1 มกราคม 2533\nวันออกบัตร 1 กุมภาพันธ์ 2566\nเจ้าพนักงานออกบัตร"
            }
          ]
        }),
        { status: 200 }
      );
    }
    throw new Error("OpenAI should not be called without key");
  }) as typeof fetch;

  try {
    const { runBookingReportOcr } = await import("../lib/booking-report-ocr.ts");

    const result = await runBookingReportOcr({
      base64: "dGVzdA==",
      mimeType: "image/jpeg",
      documentType: "id_card"
    });

    assert.equal(result.fields.name, "สมชาย ใจดี");
    assert.equal(result.fields.idNumber, "1234567890123");
    assert.equal(result.fields.address, "123 ถนนหลัก กรุงเทพฯ");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalOpenAiKey;
  }
});

test("booking report OCR removes date-only trailing line from Thai address without removing house number or moo", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const originalOpenAiKey = process.env.OPENAI_API_KEY;

  delete process.env.OPENAI_API_KEY;

  globalThis.fetch = (async (url: string | URL) => {
    if (String(url).includes("api.ocr.space")) {
      return new Response(
        JSON.stringify({
          OCRExitCode: 1,
          IsErroredOnProcessing: false,
          ParsedResults: [
            {
              ParsedText: "นาย สมชาย ใจดี\n1234567890123\n111/126 หมู่ที่ 4 ต.บางแก้ว อ.บางพลี จ.สมุทรปราการ 30 ก.ย. 2565"
            }
          ]
        }),
        { status: 200 }
      );
    }
    throw new Error("OpenAI should not be called without key");
  }) as typeof fetch;

  try {
    const { runBookingReportOcr } = await import("../lib/booking-report-ocr.ts");

    const result = await runBookingReportOcr({
      base64: "dGVzdA==",
      mimeType: "image/jpeg",
      documentType: "id_card"
    });

    assert.equal(result.fields.address, "111/126 หมู่ที่ 4 ต.บางแก้ว อ.บางพลี จ.สมุทรปราการ");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalOpenAiKey;
  }
});

test("booking report OCR auto-fills postal code for matched Thai address", { concurrency: false }, async () => {
  const { mapOcrToBookingReportFields } = await import("../lib/booking-report-ocr.ts");

  const mapped = mapOcrToBookingReportFields({
    documentType: "id_card",
    provider: "fallback",
    rawText: "",
    fields: {
      name: "สมชาย ใจดี",
      firstName: "",
      lastName: "",
      idNumber: "1234567890123",
      address: "ต.บางแก้ว อ.บางพลี จ.สมุทรปราการ",
      companyName: "",
      taxId: "",
      contactName: "",
      phone: "",
      companyAddress: "",
      rawText: ""
    }
  });

  assert.equal(mapped.postalCode, "10540");
});

test("booking report OCR leaves postal code blank when address is incomplete", { concurrency: false }, async () => {
  const { mapOcrToBookingReportFields } = await import("../lib/booking-report-ocr.ts");

  const mapped = mapOcrToBookingReportFields({
    documentType: "id_card",
    provider: "fallback",
    rawText: "",
    fields: {
      name: "สมชาย ใจดี",
      firstName: "",
      lastName: "",
      idNumber: "1234567890123",
      address: "ถนนหลัก กรุงเทพฯ",
      companyName: "",
      taxId: "",
      contactName: "",
      phone: "",
      companyAddress: "",
      rawText: ""
    }
  });

  assert.equal(mapped.postalCode || "", "");
});
