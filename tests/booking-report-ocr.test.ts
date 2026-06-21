import assert from "node:assert/strict";
import test from "node:test";

test("booking report OCR maps Thai ID card fields into booking form fields", { concurrency: false }, async () => {
  const { mapOcrToBookingReportFields } = await import("../lib/booking-report-ocr.ts");

  const mapped = mapOcrToBookingReportFields({
    documentType: "id_card",
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
