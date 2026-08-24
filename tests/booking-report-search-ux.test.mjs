import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  formatThaiReportDate,
  formatThaiReportDateTime,
  latestBookingReportId
} from "../lib/booking-report-display.ts";

const older = {
  id: "BR-20260824-004537-280",
  bookingDate: "Mon Aug 24 2026 00:00:00 GMT+0700 (เวลาอินโดจีน)",
  createdAt: "Mon Aug 24 2026 00:45:37 GMT+0700 (เวลาอินโดจีน)"
};
const newer = {
  id: "BR-20260824-004824-115",
  bookingDate: "Mon Aug 24 2026 00:00:00 GMT+0700 (เวลาอินโดจีน)",
  createdAt: "Mon Aug 24 2026 00:48:24 GMT+0700 (เวลาอินโดจีน)"
};

test("Thai Booking dates use Buddhist year and readable month", () => {
  assert.equal(formatThaiReportDate(older.bookingDate), "24 ส.ค. 2569");
  assert.match(formatThaiReportDateTime(newer.createdAt), /^24 ส\.ค\. 2569.*00:48$/);
});

test("latest badge is derived from actual createdAt, not response order", () => {
  assert.equal(latestBookingReportId([newer, older]), newer.id);
  assert.equal(latestBookingReportId([older, newer]), newer.id);
});

test("Booking search UX exposes differentiating transaction context", async () => {
  const page = await readFile(new URL("../app/sales-reports/page.tsx", import.meta.url), "utf8");
  for (const label of ["วันที่จอง", "สร้างเมื่อ", "เซลส์", "สถานะ", "ล่าสุด"]) assert.match(page, new RegExp(label));
  assert.match(page, /latestBookingReportId\(results\)/);
});

test("Booking duplicate confirmation uses the shared Thai date formatter", async () => {
  const page = await readFile(new URL("../app/booking-reports/page.tsx", import.meta.url), "utf8");
  assert.match(page, /formatThaiReportDate\(match\.bookingDate\)/);
  assert.match(page, /พบรายงานจองเดิม/);
  assert.match(page, /เปิดรายงานเดิม/);
});
