import type { BookingReportInput } from "./types.ts";
import { normalizeCarYear } from "./format.ts";

function money(value: string) {
  const numeric = Number(String(value || "").replace(/,/g, ""));
  if (!numeric) return "";
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(numeric);
}

export function renderBookingReportPreview(input: BookingReportInput) {
  const finalPrice = input.finalPriceNote.trim()
    ? `${money(input.finalPrice)} (${input.finalPriceNote.trim()})`
    : money(input.finalPrice);

  return [
    "รายงานการจอง",
    "",
    `วันที่จอง : ${input.bookingDate}`,
    `ชื่อผู้ซื้อ : ${input.customerName}`,
    `เลขบัตรปชช : ${input.idCard}`,
    `เบอร์โทร : ${input.phone}`,
    `*จองรถยนต์ : ${money(input.bookingPrice)} บาท`,
    `ยี่ห้อรถยนต์ : ${input.brand}`,
    `รุ่น : ${input.model}`,
    `ปี : ${normalizeCarYear(input.year)}`,
    `สี : ${input.color}`,
    "",
    `ทะเบียน : ${input.plate}`,
    "",
    `ราคาตั้งขาย : ${money(input.salePrice)}`,
    `ราคาที่ขาย : ${finalPrice}`,
    `ส่วนลด : ${money(input.discount)}`,
    `การชำระเงิน : ${input.paymentType}`,
    `แหล่งที่มา : ${input.source}`,
    `กรรมสิทธิ์ : ${input.ownership}`,
    `Project : ${input.project}`,
    `Campaign : ${input.campaign}`,
    "",
    "*เงื่อนไข*",
    "",
    input.conditions,
    "",
    `Sale ${input.saleName} ทีม${input.teamName}`,
    "",
    "ที่อยู่จัดส่งเอกสาร",
    input.address,
    input.postalCode ? `รหัสไปรษณีย์ : ${input.postalCode}` : ""
  ].join("\n");
}
