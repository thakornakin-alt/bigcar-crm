import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { BookingDeliveryRecord, BookingReport, BookingReportInput } from "../lib/types.ts";

import {
  listBookingDeliveryRecords,
  upsertBookingDeliveryFromBookingReport
} from "../lib/booking-delivery.ts";
import {
  bookingFoundationFromReport,
  mergeBookingFoundation,
  preserveCreatedAt,
  resolveBookingLifecycleTimestamps
} from "../lib/booking-delivery-foundation.ts";
import { saveBookingReportAndMaster } from "../lib/booking-report-persistence.ts";

const bookingInput: BookingReportInput = {
  bookingDate: "2026-07-23",
  customerName: "ลูกค้าทดสอบ",
  idCard: "",
  phone: "0800000000",
  address: "",
  buyerType: "individual",
  bookingPrice: "10000",
  plate: "TEST 1234",
  brand: "Test",
  model: "Model",
  year: "2024",
  color: "Black",
  salePrice: "500000",
  finalPrice: "490000",
  finalPriceNote: "",
  discount: "10000",
  paymentType: "เงินสด",
  source: "",
  ownership: "",
  project: "",
  campaign: "",
  saleName: "Tester",
  teamName: "QA",
  conditions: "",
  emailSubject: "",
  emailTo: "",
  emailCc: "",
  emailBcc: "",
  reportText: "",
  status: "draft"
};

const report: BookingReport = {
  ...bookingInput,
  id: "BR-TEST",
  createdAt: "2026-07-23T01:00:00.000Z",
  updatedAt: "2026-07-23T01:00:00.000Z"
};

test("new Booking Report sends bookingDate to Master foundation and defaults isCounted to true", () => {
  const foundation = bookingFoundationFromReport(report.bookingDate);
  assert.equal(foundation.bookingDate, "2026-07-23");
  assert.equal(foundation.isCounted, true);
});

test("existing upsert preserves createdAt", () => {
  assert.equal(
    preserveCreatedAt("2026-07-23T01:00:00.000Z", "2026-07-01T01:00:00.000Z"),
    "2026-07-01T01:00:00.000Z"
  );
});

test("existing upsert does not lose bookingDate when incoming value is blank", () => {
  const foundation = mergeBookingFoundation(
    { bookingDate: "" },
    { bookingDate: "2026-07-10", isCounted: false }
  );
  assert.equal(foundation.bookingDate, "2026-07-10");
  assert.equal(foundation.isCounted, false);
});

test("delivery transition uses deliveryDate for deliveredAt", () => {
  const timestamps = resolveBookingLifecycleTimestamps({
    workflowStatus: "ยอดส่งมอบ",
    status: "ยอดจอง",
    deliveryDate: "2026-07-30",
    now: "2026-07-31T01:00:00.000Z"
  });
  assert.equal(timestamps.deliveredAt, "2026-07-30");
  assert.equal(timestamps.cancelledAt, undefined);
});

test("delivery transition uses current time when deliveryDate is missing", () => {
  const timestamps = resolveBookingLifecycleTimestamps({
    workflowStatus: "ยอดส่งมอบ",
    status: "ยอดจอง",
    now: "2026-07-31T01:00:00.000Z"
  });
  assert.equal(timestamps.deliveredAt, "2026-07-31T01:00:00.000Z");
});

test("cancel transition sets cancelledAt", () => {
  const timestamps = resolveBookingLifecycleTimestamps({
    workflowStatus: "ยกเลิก",
    status: "ยกเลิก",
    now: "2026-07-31T02:00:00.000Z"
  });
  assert.equal(timestamps.cancelledAt, "2026-07-31T02:00:00.000Z");
});

test("Master failure is returned as partial success without losing saved Booking Report", async () => {
  const result = await saveBookingReportAndMaster(bookingInput, {
    saveReport: async () => report,
    upsertMaster: async () => {
      throw new Error("master unavailable");
    }
  });

  assert.equal(result.partialSuccess, true);
  assert.equal(result.report.id, "BR-TEST");
  assert.equal(result.bookingDelivery, null);
  assert.match(result.warning, /master unavailable/);
});

test("successful persistence returns the Master record", async () => {
  const master = { id: "BR-TEST" } as BookingDeliveryRecord;
  const result = await saveBookingReportAndMaster(bookingInput, {
    saveReport: async () => report,
    upsertMaster: async () => master
  });

  assert.equal(result.partialSuccess, false);
  assert.equal(result.bookingDelivery, master);
});

test("two new Booking Reports create separate Master records with different bookingId values", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "booking-delivery-test-"));
  const previousDataDir = process.env.BIG_CAR_DATA_DIR;
  const previousProvider = process.env.DATA_PROVIDER;
  process.env.BIG_CAR_DATA_DIR = dataDir;
  process.env.DATA_PROVIDER = "json";

  try {
    const first = await upsertBookingDeliveryFromBookingReport({
      ...report,
      id: "BR-TEST-001",
      plate: "TEST 1001"
    });
    const second = await upsertBookingDeliveryFromBookingReport({
      ...report,
      id: "BR-TEST-002",
      customerName: "ลูกค้าทดสอบ 2",
      plate: "TEST 1002"
    });
    const records = await listBookingDeliveryRecords();

    assert.notEqual(first.bookingId, second.bookingId);
    assert.equal(records.length, 2);
    assert.ok(records.some((record) => record.bookingReportId === "BR-TEST-001"));
    assert.ok(records.some((record) => record.bookingReportId === "BR-TEST-002"));
  } finally {
    if (previousDataDir === undefined) delete process.env.BIG_CAR_DATA_DIR;
    else process.env.BIG_CAR_DATA_DIR = previousDataDir;
    if (previousProvider === undefined) delete process.env.DATA_PROVIDER;
    else process.env.DATA_PROVIDER = previousProvider;
    await rm(dataDir, { recursive: true, force: true });
  }
});
