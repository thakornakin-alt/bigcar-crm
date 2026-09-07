import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readFileSync } from "node:fs";
import { renderBookingReport } from "../lib/booking-report.ts";
import type { BookingReportInput } from "../lib/types.ts";

const formatterSource = readFileSync(new URL("../lib/booking-report.ts", import.meta.url), "utf8");

function fixture(): BookingReportInput {
  return {
    bookingDate: "2026-09-08", customerName: "ลูกค้า ทดสอบ", idCard: "1234567890123", phone: "0812345678",
    address: "99 ถนนสุขุมวิท กรุงเทพฯ", postalCode: "10260", buyerType: "individual", bookingPrice: "10000",
    plate: "1กก 1234", brand: "TOYOTA", model: "CAMRY", year: "2022", color: "ดำ", salePrice: "800000",
    finalPrice: "780000", finalPriceNote: "", discount: "20000", paymentType: "ไฟแนนซ์", source: "หน้าร้าน",
    ownership: "บริษัท", project: "BIG CAR", campaign: "September", saleName: "ฐากร", teamName: "พี่ลีฟ",
    conditions: "ส่งมอบพร้อมเอกสาร", emailSubject: "", emailTo: "", emailCc: "", emailBcc: "", attachments: [],
    reportText: "", status: "draft"
  };
}

test("Booking Preview follows the requested field order and spacing", () => {
  const ordered = ["รายงานการจอง", "วันที่จอง :", "ชื่อผู้ซื้อ :", "เลขบัตรปชช :", "เบอร์โทร :", "*จองรถยนต์ :", "ยี่ห้อรถยนต์ :", "รุ่น :", "ปี :", "สี :", "ทะเบียน :", "ราคาตั้งขาย :", "ราคาที่ขาย :", "ส่วนลด :", "การชำระเงิน :", "แหล่งที่มา :", "กรรมสิทธิ์ :", "Project :", "Campaign :", "*เงื่อนไข*", "Sale ", "ที่อยู่จัดส่งเอกสาร"];
  for (let index = 1; index < ordered.length; index += 1) {
    assert.ok(formatterSource.indexOf(ordered[index - 1]) < formatterSource.indexOf(ordered[index]), `${ordered[index - 1]} before ${ordered[index]}`);
  }
  assert.match(formatterSource, /`Campaign : \$\{input\.campaign\}`,[\s\S]*?"",[\s\S]*?`\*เงื่อนไข\*`/);
  assert.equal(renderBookingReport(fixture()), [
    "รายงานการจอง", "", "วันที่จอง : 2026-09-08", "ชื่อผู้ซื้อ : ลูกค้า ทดสอบ", "เลขบัตรปชช : 1234567890123",
    "เบอร์โทร : 0812345678", "*จองรถยนต์ : 10,000 บาท", "ยี่ห้อรถยนต์ : TOYOTA", "รุ่น : CAMRY", "ปี : 2022",
    "สี : ดำ", "", "ทะเบียน : 1กก 1234", "", "ราคาตั้งขาย : 800,000", "ราคาที่ขาย : 780,000", "ส่วนลด : 20,000",
    "การชำระเงิน : ไฟแนนซ์", "แหล่งที่มา : หน้าร้าน", "กรรมสิทธิ์ : บริษัท", "Project : BIG CAR", "Campaign : September",
    "", "*เงื่อนไข*", "", "ส่งมอบพร้อมเอกสาร", "", "Sale ฐากร ทีมพี่ลีฟ", "", "ที่อยู่จัดส่งเอกสาร",
    "99 ถนนสุขุมวิท กรุงเทพฯ", "รหัสไปรษณีย์ : 10260"
  ].join("\n"));
});

test("Booking Preview ends after delivery address and omits the salesperson profile block", () => {
  for (const removed of ["ข้อมูลเซลล์", "LINE ID :", "สาขา :", "ทีม/ตำแหน่ง :"]) assert.equal(formatterSource.includes(removed), false);
  assert.match(formatterSource, /"ที่อยู่จัดส่งเอกสาร",[\s\S]*?input\.address,[\s\S]*?input\.postalCode/);
});

test("Preview, Copy and saved reportText use one canonical body while Gmail and LINE append separate suffixes", async () => {
  const [page, route, signatures] = await Promise.all([
    readFile(new URL("../app/booking-reports/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/booking-reports/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/sales-profile-signature.ts", import.meta.url), "utf8")
  ]);
  assert.match(page, /const reportBody = useMemo\([\s\S]*renderBookingReport/);
  assert.match(page, /reportText: reportBody/);
  assert.match(page, /navigator\.clipboard\.writeText\(reportBody\)/);
  assert.match(page, /\{reportBody\}/);
  assert.match(page, /body: gmailBody/);
  assert.match(page, /message: lineBody/);
  assert.match(route, /reportText: renderBookingReport\(report\)/);
  assert.match(signatures, /appendBookingGmailSignature/);
  assert.match(signatures, /appendBookingLineSignature/);
  assert.equal(page.includes("renderBookingReportPreview"), false);
});
