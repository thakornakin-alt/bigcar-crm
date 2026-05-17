import type { SalesReportInput } from "@/lib/types";

function money(value: string) {
  const numeric = Number(String(value || "").replace(/,/g, ""));
  if (!numeric) return "";
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(numeric);
}

export function renderSalesReport(input: SalesReportInput) {
  return [
    "รายงานขาย",
    "",
    `ชื่อลูกค้า : ${input.customerName}`,
    `โทร : ${input.phone}`,
    `เลขบัตรประจำตัวประชาชน:${input.idCard}`,
    `**จองรถยนต์ : ${money(input.bookingPrice)} บาท`,
    "",
    `ทะเบียนรถ : ${input.plate}`,
    `ยี่ห้อรถยนต์ : ${input.brand}`,
    `รุ่น : ${input.model}`,
    `ปีรถ : ${input.year}`,
    `สี : ${input.color}`,
    "",
    `ราคาที่ตั้งขาย : ${money(input.salePrice)}`,
    `ส่วนลดส่วนกลาง : ${money(input.centralDiscount)}`,
    `ราคาที่ขาย : ${money(input.finalPrice)}`,
    `การชำระเงิน : ${input.paymentType}`,
    `แหล่งที่มา : ${input.source}`,
    `กรรมสิทธิ์ : ${input.ownership}`,
    `*${input.project}`,
    "",
    "* รายละเอียดการชำระเงิน",
    "",
    input.paymentDetail,
    "",
    "**เงื่อนไขการขาย",
    "",
    input.saleConditions,
    "",
    `Sale. ${input.saleName} (ทีม${input.teamName})`,
    "",
    input.branch,
    "",
    "ที่อยู่จัดส่งเอกสาร",
    "",
    input.address,
    "",
    `วันรับรถ ${input.deliveryDate}`
  ].join("\n");
}
