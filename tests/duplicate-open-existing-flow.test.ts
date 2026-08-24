import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { salesReportsForExactBooking } from "../lib/report-transaction-identity.ts";
import type { ReportHistoryItem } from "../lib/types.ts";

function report(id: string, type: "booking" | "sales", bookingReportId = "", createdAt = "2026-08-24 00:00:00"): ReportHistoryItem {
  return {
    id, type, bookingReportId, createdAt, updatedAt: createdAt, status: "draft",
    customerName: "นายก", phone: "", idCard: "", plate: "1กก 1234", brand: "", model: "", year: "", color: "",
    saleName: "ฐากร", teamName: "", emailSubject: "", emailTo: "", emailCc: "", emailStatus: "", lineStatus: "",
    ocrStatus: "", emailDraftId: "", driveFolderUrl: "", attachments: [], reportText: ""
  };
}

test("exact bookingReportId returns only linked Sales Reports and orders newest first", () => {
  const reports = [
    report("BR-A", "booking"),
    report("SR-A-OLD", "sales", "BR-A", "2026-08-24 00:45:00"),
    report("SR-B", "sales", "BR-B", "2026-08-24 00:50:00"),
    report("SR-A-NEW", "sales", "BR-A", "2026-08-24 00:55:00")
  ];
  assert.deepEqual(salesReportsForExactBooking(reports, "BR-A").map((item) => item.id), ["SR-A-NEW", "SR-A-OLD"]);
  assert.deepEqual(salesReportsForExactBooking(reports, "BR-C"), []);
});

test("Booking duplicate UX opens existing first and gates exceptional create", () => {
  const source = readFileSync(new URL("../app/booking-reports/page.tsx", import.meta.url), "utf8");
  assert.match(source, />เปิดรายงานเดิม</);
  assert.match(source, />สร้างเป็นเคสใหม่</);
  assert.match(source, /ยืนยันสร้างรายงานจองใหม่\?/);
  assert.match(source, /setConfirmExceptionalCreate\(true\)/);
  assert.match(source, /confirmDuplicateCreate/);
});

test("Sales flow resolves exact booking before customer-plate duplicate and keeps signed exceptional create", () => {
  const route = readFileSync(new URL("../app/api/sales-reports/route.ts", import.meta.url), "utf8");
  const page = readFileSync(new URL("../app/sales-reports/page.tsx", import.meta.url), "utf8");
  assert.ok(route.indexOf("salesReportsForExactBooking") < route.indexOf("const duplicate = await checkSalesReportDuplicate(report, actor.id)"));
  assert.match(route, /status: "existing_sales_report_for_booking"/);
  assert.match(route, /relationship: "verified_booking_report"/);
  assert.match(page, />เปิดรายงานขายเดิม</);
  assert.match(page, /duplicatePrompt\.confirmationToken \|\| ""/);
  assert.match(page, /ยืนยันสร้างรายงานขายใหม่\?/);
});

