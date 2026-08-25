import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { filterDocumentSalesReports } from "../lib/documents-v2/report-search.ts";
import type { ReportHistoryItem } from "../lib/types.ts";

function report(overrides: Partial<ReportHistoryItem>): ReportHistoryItem {
  return {
    id: "SR-001",
    type: "sales",
    createdAt: "2026-08-26T00:00:00.000Z",
    updatedAt: "2026-08-26T00:00:00.000Z",
    status: "active",
    customerName: "สมชาย ใจดี",
    phone: "081 234 5678",
    idCard: "",
    plate: "กข 1234",
    brand: "Toyota",
    model: "Camry",
    year: "2024",
    color: "black",
    saleName: "บิ๊ก",
    teamName: "",
    emailSubject: "",
    emailTo: "",
    emailCc: "",
    emailStatus: "",
    lineStatus: "",
    ocrStatus: "",
    emailDraftId: "",
    driveFolderUrl: "",
    attachments: [],
    reportText: "",
    ...overrides
  };
}

const reports = [
  report({ id: "SR-20260826-001", customerName: "สมชาย ใจดี", phone: "081 234 5678", plate: "กข 1234", saleName: "บิ๊ก" }),
  report({ id: "SR-20260826-002", customerName: "วิภา แสงทอง", phone: "0899990000", plate: "3กก 9876", saleName: "แอน" })
];

test("filters the already-loaded reports by exact and partial plate with ordinary spacing tolerance", () => {
  assert.deepEqual(filterDocumentSalesReports(reports, "กข 1234").map((item) => item.id), ["SR-20260826-001"]);
  assert.deepEqual(filterDocumentSalesReports(reports, "กข12").map((item) => item.id), ["SR-20260826-001"]);
});

test("filters by Thai customer name, phone, stable report id, and sale name", () => {
  assert.deepEqual(filterDocumentSalesReports(reports, "ชาย ใจ").map((item) => item.id), ["SR-20260826-001"]);
  assert.deepEqual(filterDocumentSalesReports(reports, "081234").map((item) => item.id), ["SR-20260826-001"]);
  assert.deepEqual(filterDocumentSalesReports(reports, "999900").map((item) => item.id), ["SR-20260826-002"]);
  assert.deepEqual(filterDocumentSalesReports(reports, "sr-20260826-002").map((item) => item.id), ["SR-20260826-002"]);
  assert.deepEqual(filterDocumentSalesReports(reports, "แอน").map((item) => item.id), ["SR-20260826-002"]);
});

test("trimmed empty search restores all reports and an unknown term returns no result", () => {
  assert.deepEqual(filterDocumentSalesReports(reports, "   ").map((item) => item.id), reports.map((item) => item.id));
  assert.deepEqual(filterDocumentSalesReports(reports, "ไม่มีรายงานนี้"), []);
});

test("Documents V2 keeps exact stable-id selection and performs no search request per keystroke", async () => {
  const ui = await readFile(new URL("../components/documents/DocumentGeneratorV2.tsx", import.meta.url), "utf8");
  assert.match(ui, /filterDocumentSalesReports\(reports, reportSearch\)/);
  assert.match(ui, /value=\{selectedReportId\}/);
  assert.match(ui, /setSelectedReportId\(e\.target\.value\)/);
  assert.match(ui, /placeholder="ค้นหาทะเบียน \/ ชื่อลูกค้า \/ เบอร์โทร"/);
  assert.doesNotMatch(ui, /useEffect\([^]*reportSearch[^]*fetch/);
});
