import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { getDefaultDocumentV2Mapping } from "../lib/documents-v2/mapping-store.ts";
import { normalizeDocumentValueRecord } from "../lib/documents/value-integrity.ts";

const templateNames = [
  "contract-field.pdf",
  "temporary-receipt.pdf",
  "power-of-attorney.pdf",
  "transport-transfer-request.pdf",
  "vehicle-delivery-document.pdf"
] as const;

test("Documents V2 registry inventory has five readable AcroForm templates", async () => {
  const expectedCounts: Record<string, number> = {
    "contract-field.pdf": 15,
    "temporary-receipt.pdf": 73,
    "power-of-attorney.pdf": 14,
    "transport-transfer-request.pdf": 56,
    "vehicle-delivery-document.pdf": 14
  };
  for (const fileName of templateNames) {
    const bytes = await readFile(new URL(`../public/document-templates/${fileName}`, import.meta.url));
    const pdf = await PDFDocument.load(bytes);
    assert.equal(pdf.getForm().getFields().length, expectedCounts[fileName], fileName);
  }
});
test("remaining templates expose Thai-labelled document-local edit paths", async () => {
  const ui = await readFile(new URL("../components/documents/DocumentGeneratorV2.tsx", import.meta.url), "utf8");
  assert.match(ui, /ข้อมูลใบคำขอโอนขนส่ง/);
  assert.match(ui, /ข้อมูลเอกสารส่งมอบรถยนต์/);
  assert.equal((ui.match(/แก้ไขข้อมูลเอกสาร/g) || []).length, 2);
  for (const label of ["ชื่อผู้รับโอน", "บ้านเลขที่", "หมู่ที่", "ชนิดรถ", "ชนิดเครื่องยนต์", "ราคาซื้อขาย", "เลขบัตรประชาชน", "รหัสไปรษณีย์", "เลขตัวถัง"]) {
    assert.match(ui, new RegExp(label));
  }
  assert.match(ui, /setTransportTransferEditMode\(false\)/);
  assert.match(ui, /setVehicleDeliveryEditMode\(false\)/);
  assert.match(ui, /ใช้ข้อมูลเดิมจากระบบ/);
});

test("transport form maps every audited page-one AcroForm business field", () => {
  const mapping = getDefaultDocumentV2Mapping("transport-transfer-request");
  const expected = [
    "transfer_date_day", "transfer_date_month", "transfer_date_year", "vehicle_plate_no",
    "transferee_name", "transferee_age", "transferee_nationality", "transferee_address_no",
    "transferee_moo", "transferee_soi", "transferee_road", "transferee_subdistrict",
    "transferee_district", "transferee_province", "transferee_phone", "vehicle_chassis_no",
    "vehicle_engine_no"
  ];
  for (const field of expected) assert.equal(mapping[field], `raw:${field}`);
});

test("transport printed slots without AcroForm use audited overlays", async () => {
  const generator = await readFile(new URL("../lib/documents-v2/generator.ts", import.meta.url), "utf8");
  assert.match(generator, /drawTransportTransferPrintedSlots/);
  assert.match(generator, /data\.vehicle_type/);
  assert.match(generator, /data\.vehicle_engine_type/);
  assert.match(generator, /data\.transfer_sale_price/);
  assert.match(generator, /templateId === "transport-transfer-request"/);
});

test("power and transfer outputs replace template page two with source page index one", async () => {
  const generator = await readFile(new URL("../lib/documents-v2/generator.ts", import.meta.url), "utf8");
  assert.match(generator, /"power-of-attorney": "power-of-attorney-original-full\.pdf"/);
  assert.match(generator, /"transport-transfer-request": "transport-transfer-request-original-full\.pdf"/);
  assert.match(generator, /pdf\.copyPages\(sourcePdf, \[1\]\)/);
  assert.match(generator, /while \(pdf\.getPageCount\(\) > 1\) pdf\.removePage\(pdf\.getPageCount\(\) - 1\)/);
  assert.match(generator, /pdf\.addPage\(originalPageTwo\)/);

  for (const fileName of ["power-of-attorney-original-full.pdf", "transport-transfer-request-original-full.pdf"]) {
    const bytes = await readFile(new URL(`../public/document-templates/${fileName}`, import.meta.url));
    const source = await PDFDocument.load(bytes);
    assert.equal(source.getPageCount(), 2, fileName);
  }
});

test("transport sale price uses strict money normalization and preserves decimals", () => {
  assert.deepEqual(normalizeDocumentValueRecord({ transfer_sale_price: "504,000.50" }), { transfer_sale_price: "504,000.50" });
  assert.throws(() => normalizeDocumentValueRecord({ transfer_sale_price: "1,2,3" }), /รูปแบบจำนวนเงิน/);
});

test("remaining-template identifier fields stay strings and no business write route is introduced", async () => {
  const ui = await readFile(new URL("../components/documents/DocumentGeneratorV2.tsx", import.meta.url), "utf8");
  const overrideRoute = await readFile(new URL("../app/api/documents-v2/override/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(ui, /parseInt\(transportTransferExtras|Number\(transportTransferExtras|parseFloat\(vehicleDeliveryExtras/);
  assert.doesNotMatch(overrideRoute, /booking-delivery|sales-report|commission|stock/i);
  assert.match(ui, /templateData: \{ temporaryReceiptExtras, powerOfAttorneyExtras, transportTransferExtras, vehicleDeliveryExtras \}/);
});
