import { lookupStockByPlateDetailed } from "@/lib/apps-script";
import { buildBookingDeliveryAlertSummary } from "@/lib/booking-delivery-alert";
import { mergeStockExtraFields } from "@/lib/stock-extra-fields";
import { upsertBookingDeliveryRecordByPlate } from "@/lib/booking-delivery";
import type { BookingDeliveryRecord } from "@/lib/types";
import type { RealtimeBookingV2QueueItem } from "@/lib/realtime-booking-v2";

function text(value: unknown) {
  return String(value ?? "").trim();
}

function money(value: unknown) {
  const numeric = Number(String(value ?? "").replace(/,/g, "").replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(numeric)) return "";
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(numeric);
}

function stockPick(source: Record<string, unknown>, keys: string[]) {
  const extra = source.extraFields && typeof source.extraFields === "object" ? (source.extraFields as Record<string, unknown>) : {};
  for (const key of keys) {
    const value = source[key] ?? extra[key];
    if (value !== undefined && value !== null && text(value)) return text(value);
  }
  return "";
}

async function resolveStockSnapshot(plate: string) {
  const stockResult = await lookupStockByPlateDetailed(plate).catch(() => null);
  const stock = stockResult?.vehicle || null;
  if (!stock) return null;

  const [merged] = await mergeStockExtraFields([stock]);
  const raw = (merged || stock) as Record<string, unknown>;
  return {
    brand: stockPick(raw, ["brand", "ยี่ห้อ", "ยี่ห้อรถ"]),
    model: stockPick(raw, ["model", "รุ่นรถยนต์", "รุ่น"]),
    year: stockPick(raw, ["year", "ปีจด", "ปีรถ"]),
    color: stockPick(raw, ["color", "สี"]),
    engineNo: stockPick(raw, ["engineNo", "engineNumber", "engine", "เลขเครื่อง", "เลขเครื่องยนต์", "MotorNo", "Motor No"]),
    chassisNo: stockPick(raw, ["vin", "chassisNo", "chassisNumber", "เลขตัวถัง", "เลขตัวรถ", "VIN", "Chassis"]),
    parkingLocation: stockPick(raw, ["parkingLocation", "ParkingLocation", "location", "สถานที่จอด", "สถานที่ส่งมอบ"]),
    ownership: stockPick(raw, ["ownership", "กรรมสิทธิ์"]),
    project: stockPick(raw, ["project", "PROJECT"]),
    campaign: stockPick(raw, ["campaign", "CAMPAIGN"]),
    salePrice: stockPick(raw, ["salePrice", "price", "ราคาเสนอขายRT", "ราคาตั้งขาย"])
  };
}

function buildSummary(item: RealtimeBookingV2QueueItem, stock: Awaited<ReturnType<typeof resolveStockSnapshot>>) {
  const parts = [item.plate, item.customerName, stock?.model || ""].filter(Boolean);
  return `รอเตรียมรถ · ${parts.join(" / ")}`;
}

function toPaymentLabel(value: RealtimeBookingV2QueueItem["paymentType"]) {
  return value === "cash" ? "เงินสด" : "ไฟแนนซ์";
}

export async function upsertBookingDeliveryFromRealtimeBookingV2(item: RealtimeBookingV2QueueItem) {
  const salePrice = item.rtPrice ? Math.round(item.rtPrice) : 0;
  const discount = Math.max(0, Math.round(item.discount || 0));
  const finalPrice = Math.max(0, salePrice - discount);
  const stock = await resolveStockSnapshot(item.plate);

  const record: BookingDeliveryRecord = {
    id: `rb2-${item.id}`,
    bookingId: `RB2-${item.id}`,
    bookingReportId: `RTB2-${item.id}`,
    salesReportId: `RTB2-${item.id}`,
    plate: item.plate,
    customerName: item.customerName,
    brand: stock?.brand || "",
    model: stock?.model || "",
    year: stock?.year || "",
    color: stock?.color || "",
    engineNo: stock?.engineNo || "",
    chassisNo: stock?.chassisNo || "",
    saleName: item.saleName || "บิ๊ก",
    teamName: "Realtime Booking",
    teamId: "realtime-booking",
    source: "realtime-booking",
    ownership: stock?.ownership || "",
    project: stock?.project || "",
    campaign: stock?.campaign || "",
    bookingPrice: money(item.rtPrice),
    salePrice: money(salePrice),
    finalPrice: money(finalPrice),
    centralDiscount: money(discount),
    bookingDeduction: money(discount),
    downPayment: "",
    netPayment: money(finalPrice),
    paymentType: toPaymentLabel(item.paymentType),
    deliveryDate: "",
    deliveryLocation: stock?.parkingLocation || "",
    garageOutDate: "",
    garageReturnDate: "",
    spaFullSystemDone: false,
    oilChangeDone: false,
    decalRemovalDone: false,
    insuranceDone: false,
    workflowStatus: "รอส่งมอบ",
    financeCaseSubmitted: false,
    financeCaseSubmittedAt: "",
    financeCaseNote: item.remark || "",
    financeAttachmentIds: [],
    status: "ยอดจอง",
    statusSource: "auto",
    summary: buildSummary(item, stock),
    alertSummary: buildBookingDeliveryAlertSummary({
      status: "รอส่งมอบ",
      garageOutDate: "",
      garageReturnDate: "",
      spaFullSystemDone: false,
      oilChangeDone: false,
      decalRemovalDone: false,
      insuranceDone: false,
      alertSummary: item.remark || ""
    }),
    cancelReason: "",
    createdAt: item.bookingConfirmedAt || item.bookedAt || item.lineSentAt || item.createdAt,
    updatedAt: new Date().toISOString()
  };

  const saved = await upsertBookingDeliveryRecordByPlate(record);
  return { record: saved, stockFound: Boolean(stock) };
}
