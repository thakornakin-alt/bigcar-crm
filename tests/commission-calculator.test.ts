import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateMonthlyCommission,
  calculateQuarterlyBonus,
  getCommissionMonthKey,
  isCommissionEligible,
  resolveBaseCommission,
  resolveFixedBonus,
  resolveQuarterlyBonus,
  resolveStepBonus,
} from "../lib/commission-calculator.ts";
import type { BookingDeliveryRecord } from "../lib/types.ts";

const makeRecord = (
  overrides: Partial<BookingDeliveryRecord> & { ownerForCommission?: string } = {},
): BookingDeliveryRecord =>
  ({
    bookingId: "BD-001",
    status: "ส่งมอบแล้ว",
    deliveryCompletedDate: "2026-06-12",
    ownerForCommission: "MAY",
    commissionGrade: "G1",
    countForCommission: true,
    commissionVersion: "2026",
    commissionNote: "",
    ...overrides,
  }) as BookingDeliveryRecord;

test("resolveBaseCommission maps G1/G2/G3", () => {
  assert.equal(resolveBaseCommission("G1"), 5000);
  assert.equal(resolveBaseCommission("G2"), 6000);
  assert.equal(resolveBaseCommission("G3"), 7000);
  assert.equal(resolveBaseCommission(""), 0);
});

test("resolveStepBonus uses highest step less than or equal to count", () => {
  const cases: Array<[number, number]> = [
    [0, 0],
    [3, 0],
    [4, 5000],
    [5, 10000],
    [6, 15000],
    [7, 23000],
    [8, 31000],
    [9, 38000],
    [10, 45000],
    [11, 55000],
    [12, 55000],
    [13, 67000],
    [14, 67000],
    [15, 77000],
    [19, 77000],
    [20, 88000],
    [25, 88000],
  ];

  for (const [count, expected] of cases) {
    assert.equal(resolveStepBonus(count), expected);
  }
});

test("resolveFixedBonus applies only from 3 cars up", () => {
  assert.equal(resolveFixedBonus(0), 0);
  assert.equal(resolveFixedBonus(1), 0);
  assert.equal(resolveFixedBonus(2), 0);
  assert.equal(resolveFixedBonus(3), 10000);
  assert.equal(resolveFixedBonus(10), 10000);
});

test("resolveQuarterlyBonus follows quarterly bonus table", () => {
  const cases: Array<[number, number]> = [
    [9, 0],
    [10, 5000],
    [14, 5000],
    [15, 10000],
    [29, 10000],
    [30, 15000],
  ];

  for (const [count, expected] of cases) {
    assert.equal(resolveQuarterlyBonus(count), expected);
  }
});

test("isCommissionEligible rejects missing grade, owner, date, and cancelled records", () => {
  assert.equal(isCommissionEligible(makeRecord()), true);
  assert.equal(isCommissionEligible(makeRecord({ commissionGrade: "" })), false);
  assert.equal(isCommissionEligible(makeRecord({ ownerForCommission: "-" })), false);
  assert.equal(isCommissionEligible(makeRecord({ deliveryCompletedDate: "" })), false);
  assert.equal(isCommissionEligible(makeRecord({ status: "ยกเลิก" })), false);
  assert.equal(isCommissionEligible(makeRecord({ countForCommission: false })), false);
  assert.equal(isCommissionEligible(makeRecord({ status: "รอส่งมอบ" })), false);
});

test("getCommissionMonthKey returns year-month from deliveryCompletedDate", () => {
  assert.deepEqual(getCommissionMonthKey("2026-06-12"), {
    year: "2026",
    month: "06",
    monthKey: "2026-06",
  });
  assert.equal(getCommissionMonthKey(""), null);
});

test("calculateMonthlyCommission aggregates eligible deliveries and applies deduction rules", () => {
  const records = [
    makeRecord({ bookingId: "A1", ownerForCommission: "MAY", commissionGrade: "G1" }),
    makeRecord({ bookingId: "A2", ownerForCommission: "MAY", commissionGrade: "G2" }),
    makeRecord({ bookingId: "A3", ownerForCommission: "MAY", commissionGrade: "G3" }),
    makeRecord({
      bookingId: "A4",
      ownerForCommission: "MAY",
      commissionGrade: "G1",
      countForCommission: false,
    }),
    makeRecord({
      bookingId: "B1",
      ownerForCommission: "LEE",
      commissionGrade: "G1",
    }),
    makeRecord({
      bookingId: "B2",
      ownerForCommission: "LEE",
      commissionGrade: "G1",
      status: "ยกเลิก",
    }),
    makeRecord({
      bookingId: "B3",
      ownerForCommission: "LEE",
      commissionGrade: "",
    }),
  ];

  const result = calculateMonthlyCommission(records, 6, 2026);
  assert.equal(result.length, 2);

  const may = result.find((row) => row.ownerForCommission === "MAY");
  assert.ok(may);
  assert.equal(may?.month, "06");
  assert.equal(may?.year, "2026");
  assert.equal(may?.totalCars, 3);
  assert.equal(may?.g1Count, 1);
  assert.equal(may?.g2Count, 1);
  assert.equal(may?.g3Count, 1);
  assert.equal(may?.baseCommissionTotal, 18000);
  assert.equal(may?.stepBonus, 0);
  assert.equal(may?.fixedBonus, 10000);
  assert.equal(may?.deductionBase, 18000);
  assert.equal(may?.deductionAmount, 540);
  assert.equal(may?.netMonthlyCommission, 27460);
  assert.equal(may?.quarterlyBonus, 0);
  assert.equal(may?.totalCommission, 27460);
  assert.deepEqual(may?.excludedRecords.map((r) => r.bookingId).sort(), ["A4", "B2"]);

  const lee = result.find((row) => row.ownerForCommission === "LEE");
  assert.ok(lee);
  assert.equal(lee?.totalCars, 1);
  assert.equal(lee?.missingGradeRecords.length, 1);
  assert.equal(lee?.excludedRecords.length, 2);
});

test("calculateQuarterlyBonus applies quarterly threshold and ignores ineligible rows", () => {
  const records = [
    ...Array.from({ length: 12 }, (_, index) =>
      makeRecord({
        bookingId: `Q-${index + 1}`,
        ownerForCommission: "MAY",
        commissionGrade: "G1",
        deliveryCompletedDate: "2026-05-01",
      }),
    ),
    makeRecord({
      bookingId: "Q-X",
      ownerForCommission: "MAY",
      commissionGrade: "G1",
      deliveryCompletedDate: "2026-05-01",
      status: "ยกเลิก",
    }),
  ];

  const result = calculateQuarterlyBonus(records, 2, 2026);
  assert.equal(result.quarter, 2);
  assert.equal(result.year, "2026");
  assert.equal(result.quarterCount, 12);
  assert.equal(result.bonus, 5000);
  assert.equal(result.excludedRecords.length, 1);
});
