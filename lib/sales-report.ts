import type { SalesReportInput } from "@/lib/types";
import { normalizeCarYear } from "@/lib/format";

function money(value: string) {
  const numeric = Number(String(value || "").replace(/,/g, ""));
  if (!numeric) return "";
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(numeric);
}

function line(label: string, value: string) {
  return value ? `-${label} ${money(value)}` : `-${label}`;
}

export function buildSalesPaymentDetail(input: SalesReportInput) {
  const paymentType = String(input.paymentType || "").toLowerCase();

  if (paymentType.includes("สด")) {
    return [
      line("ราคารถ", input.carPrice),
      line("หักเงินจอง", input.bookingDeduction),
      line("ค่าโอน", input.transferFee),
      line("จ่ายสุทธิ", input.netPayment)
    ].join("\n");
  }

  if (paymentType.includes("ไฟแนนซ์") || paymentType.includes("finance")) {
    return [
      line("เงินดาวน์", input.downPayment),
      line("ค่าเบี้ยประกันรถ", input.insuranceFee),
      line("หักเงินจอง", input.bookingDeduction),
      line("จ่ายสุทธิ", input.netPayment)
    ].join("\n");
  }

  return input.paymentDetail;
}

export function renderSalesReport(input: SalesReportInput) {
  const paymentDetail = buildSalesPaymentDetail(input);

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
    `ปีรถ : ${normalizeCarYear(input.year)}`,
    `สี : ${input.color}`,
    `เลขเครื่อง : ${input.engineNo}`,
    `เลขตัวถัง : ${input.chassisNo}`,
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
    paymentDetail,
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
