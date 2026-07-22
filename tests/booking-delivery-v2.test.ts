import assert from "node:assert/strict";
import test from "node:test";
import type { BookingDeliveryRecord } from "../lib/types.ts";
import {
  bookingDeliveryRecordsToCsv,
  buildBookingDeliveryView,
  calculateMonthlySummary,
  getBangkokMonthRange
} from "../lib/booking-delivery-v2.ts";

const july = getBangkokMonthRange(2026, 7);

function record(input: Partial<BookingDeliveryRecord> = {}) {
  return {
    id: input.id || Math.random().toString(36),
    bookingId: input.bookingId || "BK-TEST",
    bookingDate: input.bookingDate,
    deliveredAt: input.deliveredAt,
    cancelledAt: input.cancelledAt,
    isCounted: input.isCounted,
    status: input.status || "ยอดจอง",
    workflowStatus: input.workflowStatus || "รอส่งมอบ",
    customerName: input.customerName || "ลูกค้าทดสอบ",
    plate: input.plate || "กข 1234",
    brand: input.brand || "Toyota",
    model: input.model || "Camry",
    year: input.year || "2024",
    color: input.color || "ดำ",
    saleName: input.saleName || "ฐากร",
    teamName: input.teamName || "ทีม A",
    finalPrice: input.finalPrice || "900000",
    salePrice: input.salePrice || "950000",
    deliveryDate: input.deliveryDate || "",
    createdAt: input.createdAt || "2026-07-01T00:00:00.000Z"
  } as BookingDeliveryRecord;
}

test("new booking inside selected month is counted", () => {
  const summary = calculateMonthlySummary([record({ bookingDate: "2026-07-10" })], july);
  assert.equal(summary.newBookings, 1);
});

test("booking before month and still open is carry in", () => {
  const summary = calculateMonthlySummary([record({ bookingDate: "2026-06-20" })], july);
  assert.equal(summary.carryIn, 1);
});

test("delivery before month is not carry in", () => {
  const summary = calculateMonthlySummary([
    record({ bookingDate: "2026-06-10", deliveredAt: "2026-06-30", workflowStatus: "ยอดส่งมอบ" })
  ], july);
  assert.equal(summary.carryIn, 0);
  assert.equal(summary.totalTracking, 0);
});

test("delivery inside month is counted", () => {
  const summary = calculateMonthlySummary([
    record({ bookingDate: "2026-06-10", deliveredAt: "2026-07-15", workflowStatus: "ยอดส่งมอบ" })
  ], july);
  assert.equal(summary.delivered, 1);
});

test("cancellation inside month is counted", () => {
  const summary = calculateMonthlySummary([
    record({ bookingDate: "2026-07-01", cancelledAt: "2026-07-20", status: "ยกเลิก", workflowStatus: "ยกเลิก" })
  ], july);
  assert.equal(summary.cancelled, 1);
});

test("open booking carries out to next month", () => {
  const summary = calculateMonthlySummary([record({ bookingDate: "2026-07-31" })], july);
  assert.equal(summary.carryOut, 1);
});

test("missing bookingDate is legacy unknown data", () => {
  const summary = calculateMonthlySummary([record({ bookingDate: undefined })], july);
  assert.equal(summary.unknownDate, 1);
  assert.equal(summary.totalTracking, 1);
});

test("createdAt is never used as bookingDate", () => {
  const summary = calculateMonthlySummary([
    record({ bookingDate: undefined, createdAt: "2026-07-10T00:00:00.000Z" })
  ], july);
  assert.equal(summary.newBookings, 0);
  assert.equal(summary.unknownDate, 1);
});

test("isCounted false is excluded from monthly KPI", () => {
  const summary = calculateMonthlySummary([
    record({ bookingDate: "2026-07-10", isCounted: false })
  ], july);
  assert.equal(summary.newBookings, 0);
  assert.equal(summary.totalTracking, 0);
  assert.equal(summary.carryOut, 0);
});

test("undefined isCounted is treated as true", () => {
  const summary = calculateMonthlySummary([
    record({ bookingDate: "2026-07-10", isCounted: undefined })
  ], july);
  assert.equal(summary.newBookings, 1);
});

test("CSV keeps Thai and escapes comma quote and newline", () => {
  const csv = bookingDeliveryRecordsToCsv([
    record({ customerName: "คุณก้อง, \"ฝ่ายขาย\"\nกรุงเทพ" })
  ]);
  assert.equal(csv.startsWith("\uFEFF"), true);
  assert.match(csv, /คุณก้อง, ""ฝ่ายขาย""\r?\nกรุงเทพ/);
});

test("filters and summary use exactly the same dataset", () => {
  const source = [
    record({ id: "a", bookingDate: "2026-07-10", saleName: "ฐากร" }),
    record({ id: "b", bookingDate: "2026-07-11", saleName: "กันตา" }),
    record({ id: "c", bookingDate: undefined, saleName: "ฐากร" })
  ];
  const view = buildBookingDeliveryView(source, july, {
    saleName: "ฐากร",
    date: "selected_month"
  });
  assert.deepEqual(view.records.map((item) => item.id), ["a"]);
  assert.equal(view.summary.newBookings, 1);
  assert.equal(view.summary.unknownDate, 0);
});
