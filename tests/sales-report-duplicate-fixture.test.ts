import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DUPLICATE_UX_FIXTURE_REPORTS,
  createFixtureDraftFromExisting,
  findDuplicateTransactions,
  fixtureDraftId
} from "../lib/sales-report-duplicate-fixture.ts";

const original = DUPLICATE_UX_FIXTURE_REPORTS[0];

test("same normalized plate and same customer requires duplicate confirmation", () => {
  assert.equal(findDuplicateTransactions({ plate: "1กก1234", customerName: "ลูกค้าตัวอย่าง" }, DUPLICATE_UX_FIXTURE_REPORTS).length, 1);
  assert.equal(findDuplicateTransactions({ plate: "1กก 1234", customerName: "ลูกค้าคนใหม่" }, DUPLICATE_UX_FIXTURE_REPORTS).length, 0);
  assert.equal(findDuplicateTransactions({ plate: "2ขข 5678", customerName: "ลูกค้าตัวอย่าง" }, DUPLICATE_UX_FIXTURE_REPORTS).length, 0);
});

test("create-from-existing copies only the approved allowlist and leaves original unchanged", () => {
  const before = structuredClone(original);
  const draft = createFixtureDraftFromExisting(original);
  assert.equal(draft.customerName, original.customerName);
  assert.equal(draft.phone, original.phone);
  assert.equal(draft.idCard, original.idCard);
  assert.equal(draft.plate, original.plate);
  assert.equal(draft.engineNo, original.engineNo);
  assert.equal(draft.chassisNo, original.chassisNo);
  assert.equal(draft.salePrice, original.salePrice);
  assert.equal(draft.saleName, original.saleName);
  assert.deepEqual(original, before);
});

test("transaction-specific and system fields are cleared in the new fixture draft", () => {
  const draft = createFixtureDraftFromExisting(original);
  assert.equal(draft.bookingReportId, "");
  assert.equal(draft.bookingPrice, "");
  assert.equal(draft.centralDiscount, "");
  assert.equal(draft.finalPrice, "");
  assert.equal(draft.paymentType, "");
  assert.equal(draft.transferFee, "");
  assert.equal(draft.downPayment, "");
  assert.equal(draft.netPayment, "");
  assert.equal(draft.deliveryDate, "");
  assert.equal(draft.reportText, "");
  assert.equal(draft.status, "draft");
  assert.equal("id" in draft, false);
  assert.equal("createdAt" in draft, false);
  assert.equal("updatedAt" in draft, false);
  assert.equal("attachments" in draft, false);
  assert.equal("driveFolderUrl" in draft, false);
});

test("fixture draft identity is new and cannot reuse the original report id", () => {
  assert.notEqual(fixtureDraftId(original.id), original.id);
  assert.match(fixtureDraftId(original.id), /^NEW-FIXTURE-FROM-/);
});

test("fixture component has no real create API call", async () => {
  const source = await readFile(new URL("../components/sales-reports/DuplicateSalesReportFixture.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\/api\/sales-reports|method:\s*["']POST["']/);
  assert.match(source, /รายงานใหม่ — คัดลอกจากรายงานเดิม/);
  assert.match(source, /ไม่เรียก Sales Report POST/);
});
