import type { RealtimeBookingV2QueueItem } from "@/lib/realtime-booking-v2";

function parseDiscountFromRemark(remark: string) {
  const cleaned = String(remark || "").replace(/,/g, "");
  const matches = cleaned.match(/(\d+(?:\.\d+)?)/g);
  if (!matches?.length) return 0;
  const value = Number(matches[matches.length - 1]);
  return Number.isFinite(value) ? Math.max(Math.round(value), 0) : 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(Math.max(Math.round(value), 0));
}

export function formatThaiPlate(value: string) {
  const normalized = String(value || "").replace(/\s+/g, "");
  const match = normalized.match(/^([0-9ก-๙a-zA-Z]{1,3})([0-9]{4})$/);
  if (match) {
    return `${match[1]} ${match[2]}`;
  }
  return value;
}

export function formatRealtimeBookingV2LineText(item: Pick<
  RealtimeBookingV2QueueItem,
  "customerName" | "plate" | "paymentType" | "saleName" | "remark" | "discount" | "rtPrice"
>) {
  const standardPrice = typeof item.rtPrice === "number" ? item.rtPrice : 0;
  const remarkDiscount = parseDiscountFromRemark(item.remark || "");
  const discount = Number.isFinite(item.discount) && Number(item.discount || 0) > 0 ? Math.max(Number(item.discount || 0), 0) : remarkDiscount;
  const sellingPrice = Math.max(standardPrice - discount, 0);
  const paymentLabel = item.paymentType === "cash" ? "เงินสด" : "ไฟแนนซ์";
  const lines = [
    "ช่องทางขาย : Retail ทีมบางนา",
    `ชื่อ-นามสกุล : ${item.customerName}`,
    `ทะเบียนรถ : ${formatThaiPlate(item.plate)}`,
    `ราคามาตรฐาน : ${formatCurrency(standardPrice)}`,
    `ราคาตั้งขาย : ${formatCurrency(sellingPrice)}`
  ];

  if (item.remark?.trim()) {
    lines.push(item.remark.trim());
  }

  lines.push(
    `ช่องทางชำระเงิน : ${paymentLabel}`,
    `เซลส์เจ้าของเคส : ${item.saleName || "บิ๊ก"}`
  );

  return lines.join("\n");
}
