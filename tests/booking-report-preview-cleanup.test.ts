import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { renderBookingReportPreview } from "../lib/booking-report-preview.ts";
import type { BookingReportInput } from "../lib/types.ts";

function fixture(overrides: Partial<BookingReportInput> = {}): BookingReportInput {
  return {
    bookingDate: "2026-09-08", customerName: "ลูกค้า ทดสอบ", idCard: "1234567890123", phone: "0812345678",
    address: "99 ถนนสุขุมวิท กรุงเทพฯ", postalCode: "10260", buyerType: "individual", bookingPrice: "10000",
    plate: "1กก 1234", brand: "TOYOTA", model: "CAMRY", year: "2022", color: "ดำ", salePrice: "800000",
    finalPrice: "780000", finalPriceNote: "", discount: "20000", paymentType: "ไฟแนนซ์", source: "หน้าร้าน",
    ownership: "บริษัท", project: "BIG CAR", campaign: "September", saleName: "ฐากร", teamName: "พี่ลีฟ",
    conditions: "ส่งมอบพร้อมเอกสาร", emailSubject: "", emailTo: "", emailCc: "", emailBcc: "", attachments: [],
    reportText: "", status: "draft", ...overrides
  };
}

test("Booking Preview follows the requested field order and spacing", () => {
  const preview = renderBookingReportPreview(fixture());
  const expected = [
    "รายงานการจอง", "", "วันที่จอง : 2026-09-08", "ชื่อผู้ซื้อ : ลูกค้า ทดสอบ", "เลขบัตรปชช : 1234567890123",
    "เบอร์โทร : 0812345678", "*จองรถยนต์ : 10,000 บาท", "ยี่ห้อรถยนต์ : TOYOTA", "รุ่น : CAMRY", "ปี : 2022",
    "สี : ดำ", "", "ทะเบียน : 1กก 1234", "", "ราคาตั้งขาย : 800,000", "ราคาที่ขาย : 780,000",
    "ส่วนลด : 20,000", "การชำระเงิน : ไฟแนนซ์", "แหล่งที่มา : หน้าร้าน", "กรรมสิทธิ์ : บริษัท",
    "Project : BIG CAR", "Campaign : September", "", "*เงื่อนไข*", "", "ส่งมอบพร้อมเอกสาร", "",
    "Sale ฐากร ทีมพี่ลีฟ", "", "ที่อยู่จัดส่งเอกสาร", "99 ถนนสุขุมวิท กรุงเทพฯ", "รหัสไปรษณีย์ : 10260"
  ].join("\n");
  assert.equal(preview, expected);
});

test("Booking Preview ends after delivery address and omits the salesperson profile block", () => {
  const preview = renderBookingReportPreview(fixture());
  for (const removed of ["ข้อมูลเซลล์", "LINE ID :", "สาขา :", "ทีม/ตำแหน่ง :"]) assert.equal(preview.includes(removed), false);
  assert.equal(preview.includes("เบอร์โทร : 0812345678"), true, "customer phone remains visible");
  assert.equal(preview.endsWith("รหัสไปรษณีย์ : 10260"), true);
});

test("Preview-only formatter does not replace outbound save, Gmail, or LINE report text", async () => {
  const page = await readFile(new URL("../app/booking-reports/page.tsx", import.meta.url), "utf8");
  assert.match(page, /const reportText = useMemo\([\s\S]*appendSalesProfileSignature\(renderBookingReport/);
  assert.match(page, /const previewText = useMemo\([\s\S]*renderBookingReportPreview/);
  assert.match(page, /body: reportText/);
  assert.match(page, /message: reportText/);
  assert.match(page, /reportText,/);
  assert.match(page, /navigator\.clipboard\.writeText\(previewText\)/);
  assert.match(page, /\{previewText\}/);
});
