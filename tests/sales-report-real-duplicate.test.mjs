import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  copySalesReportForNewTransaction,
  normalizeSalesPlate,
  requiresSalesDuplicateConfirmation,
  resolveSalesCustomerIdentity
} from "../lib/sales-report-duplicate.ts";

const old = {
  customerName: " บริษัท ตัวอย่าง จำกัด ", idCard: "0123456789012", phone: "0917785117", address: "กรุงเทพฯ",
  plate: "1กก 1234", brand: "TOYOTA", model: "REVO", year: "2024", color: "ดำ", engineNo: "E1", chassisNo: "C1",
  salePrice: "500000", source: "หน้าร้าน", ownership: "บริษัท", project: "BIGCAR", saleName: "ฐากร", teamName: "ทีม A", branch: "สำนักงานใหญ่",
  bookingReportId: "BR-A", bookingPrice: "10000", centralDiscount: "5000", finalPrice: "495000", paymentType: "finance",
  transferFee: "2000", insuranceFee: "3000", downPayment: "100000", netPayment: "395000", deliveryDate: "2026-09-01",
  saleConditions: "old", reportText: "old", status: "draft", attachments: [{ name: "old" }], driveFolderUrl: "old"
};

test("customer identity prefers exact Citizen/Tax ID and preserves leading zero", () => {
  assert.deepEqual(resolveSalesCustomerIdentity(old), { type: "citizen_or_tax_id", value: "0123456789012" });
  assert.equal(resolveSalesCustomerIdentity({ idCard: "", customerName: "  นาย สมชาย  " }).value, "นาย สมชาย");
});

test("duplicate confirmation requires same proven customer and same normalized plate only", () => {
  assert.equal(normalizeSalesPlate("1กก 1234"), "1กก1234");
  assert.equal(requiresSalesDuplicateConfirmation(old, { ...old, plate: "1กก1234" }), true);
  assert.equal(requiresSalesDuplicateConfirmation(old, { ...old, idCard: "999", customerName: old.customerName }), false);
  assert.equal(requiresSalesDuplicateConfirmation(old, { ...old, plate: "2ขข 5678" }), false);
  assert.equal(requiresSalesDuplicateConfirmation({ ...old, idCard: "", customerName: "" }, { ...old, idCard: "", customerName: "" }), false);
});

test("create from existing copies allowlisted reference fields and clears transaction state", () => {
  const draft = copySalesReportForNewTransaction(old);
  for (const key of ["customerName","phone","idCard","address","plate","brand","model","year","color","engineNo","chassisNo","source","ownership","project","saleName","teamName","branch","salePrice"]) {
    assert.equal(draft[key], old[key], key);
  }
  for (const key of ["bookingReportId","bookingPrice","centralDiscount","finalPrice","paymentType","bookingDeduction","transferFee","insuranceFee","downPayment","netPayment","deliveryDate","saleConditions","reportText","driveFolderUrl"]) {
    assert.equal(draft[key], "", key);
  }
  assert.deepEqual(draft.attachments, []);
});

test("server and Apps Script enforce signed confirmation and durable idempotency", async () => {
  const route = await readFile(new URL("../app/api/sales-reports/route.ts", import.meta.url), "utf8");
  const apps = await readFile(new URL("../google-apps-script/Code.gs", import.meta.url), "utf8");
  assert.match(route, /status: "duplicate_plate_customer_confirmation_required"/);
  assert.match(route, /status: "idempotency_conflict"/);
  assert.match(apps, /computeHmacSha256Signature/);
  assert.match(apps, /expiresAt:Date\.now\(\)\+10\*60\*1000/);
  assert.match(apps, /fingerprint:salesReportFingerprint_\(report\)/);
  assert.match(apps, /actorId:String\(actorId\|\|""\)/);
  assert.match(apps, /LockService\.getScriptLock/);
  assert.match(apps, /SALES_CREATE_/);
  assert.match(apps, /SALES_REPORT_IDEMPOTENCY_CONFLICT/);
  assert.doesNotMatch(apps, /allowDuplicate/);
});

test("normal Sales UI has real create-new flow while fixture remains query-gated", async () => {
  const page = await readFile(new URL("../app/sales-reports/page.tsx", import.meta.url), "utf8");
  const fixture = await readFile(new URL("../components/sales-reports/DuplicateSalesReportFixture.tsx", import.meta.url), "utf8");
  assert.match(page, /สร้างรายงานใหม่จากข้อมูลนี้/);
  assert.match(page, /รายงานใหม่ — คัดลอกจากรายงานเดิม/);
  assert.match(page, /พบรายงานขายเดิม/);
  assert.match(page, /เปิดรายงานขายเดิม/);
  assert.match(page, /ยืนยันสร้างรายงานขายใหม่\?/);
  assert.match(fixture, /duplicateFixture/);
});

test("Apps Script mirrors remain exact and Sheet headers are unchanged", async () => {
  const canonical = await readFile(new URL("../google-apps-script/Code.gs", import.meta.url), "utf8");
  const compact = await readFile(new URL("../google-apps-script/Code.compact.gs", import.meta.url), "utf8");
  assert.equal(compact, canonical);
  assert.match(canonical, /SALES_HEADERS=\["Id","CreatedAt","UpdatedAt","Status","BookingReportId"/);
  assert.match(canonical, /bookingReportId:String\(r\[4\]\|\|""\)/);
});
