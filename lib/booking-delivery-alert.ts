import type { BookingDeliveryRecord, BookingDeliveryStatus } from "@/lib/types";

function text(value: unknown) {
  return String(value ?? "").trim();
}

function boolValue(value: unknown) {
  if (typeof value === "boolean") return value;
  const normalized = text(value).toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "y";
}

function workflowMissingLabels(record?: Partial<BookingDeliveryRecord> | null) {
  const missing: string[] = [];
  if (!text(record?.garageOutDate)) missing.push("ยังไม่ระบุวันส่งอู่");
  if (text(record?.garageOutDate) && !text(record?.garageReturnDate)) missing.push("ยังไม่ระบุวันรถกลับ");
  if (!boolValue(record?.spaFullSystemDone)) missing.push("รอสปาเต็มระบบ");
  if (!boolValue(record?.oilChangeDone)) missing.push("รอเปลี่ยนน้ำมันเครื่อง");
  if (!boolValue(record?.decalRemovalDone)) missing.push("รอลอกลาย");
  if (!boolValue(record?.insuranceDone)) missing.push("รอประกัน");
  return missing;
}

export function buildBookingDeliveryAlertSummary(record: Partial<BookingDeliveryRecord> & { status: BookingDeliveryStatus }) {
  if (record.status === "ยกเลิก") return "รายการถูกยกเลิก";
  if (record.status === "ยอดส่งมอบ") return "ยอดส่งมอบครบแล้ว";
  if (record.status === "รอผลไฟแนนซ์") {
    const parts = ["รอผลไฟแนนซ์"];
    if (record.financeCaseSubmitted) parts.push("ส่งเคสแล้ว");
    if (record.financeCaseNote) parts.push(record.financeCaseNote);
    return parts.join(" · ");
  }

  const missing = workflowMissingLabels(record);
  if (!missing.length) {
    if (record.status === "รอส่งมอบ") return "รอส่งมอบ";
    return "ยอดจอง";
  }

  const prefix =
    record.status === "รอส่งมอบ" ? "รอส่งมอบ" : record.status === "ยอดจอง" ? "ยอดจอง" : record.status;
  return `${prefix} · ${missing.slice(0, 4).join(" / ")}`;
}
