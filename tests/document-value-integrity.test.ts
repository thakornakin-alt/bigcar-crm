import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { formatDocumentMoney, identifierText, normalizeDocumentValueRecord, parseDocumentMoney, salesContractOverrideData } from "../lib/documents/value-integrity.ts";

test("identifier strings preserve leading zero exactly", () => {
  for (const value of ["0917785117", "0812345678", "0990000001", "0123456789012", "01010"]) {
    assert.equal(identifierText(value), value);
  }
});

test("strict money parser accepts commas and satang without truncation", () => {
  const cases = new Map<string, number>([["1500", 1500], ["1,500", 1500], ["1500.50", 1500.5], ["1,500.50", 1500.5], ["1250.75", 1250.75]]);
  for (const [input, expected] of cases) {
    const parsed = parseDocumentMoney(input);
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(parsed.value, expected);
  }
});

test("strict money parser rejects malformed input", () => {
  for (const input of ["1,2,3", "1..50", "abc1500", "1,50", "1,500.500"]) {
    assert.equal(parseDocumentMoney(input).ok, false, input);
  }
});

test("money formatter keeps meaningful decimals", () => {
  assert.equal(formatDocumentMoney(1500), "1,500");
  assert.equal(formatDocumentMoney(1500.5), "1,500.50");
  assert.equal(formatDocumentMoney("1,500.50"), "1,500.50");
  assert.equal(formatDocumentMoney(1250.75), "1,250.75");
});

test("Sales Contract PUT data contains supported override fields only", () => {
  const payload = salesContractOverrideData({
    customerName: "ผู้ซื้อทดสอบ",
    idCard: "0123456789012",
    sellPrice: "504,000.50",
    discount: "-",
    rawUiOnly: "ignore"
  });
  assert.deepEqual(payload, {
    customerName: "ผู้ซื้อทดสอบ",
    idCard: "0123456789012",
    sellPrice: "504,000.50"
  });
  assert.deepEqual(normalizeDocumentValueRecord(payload), payload);
});

test("malformed Sales Contract money remains a validation error", () => {
  assert.throws(
    () => normalizeDocumentValueRecord(salesContractOverrideData({ sellPrice: "1,2,3" })),
    /รูปแบบจำนวนเงินใน sellPrice ไม่ถูกต้อง/
  );
});

test("override persistence is keyed by template and report", async () => {
  const source = await readFile(new URL("../lib/documents-v2/override-store.ts", import.meta.url), "utf8");
  assert.match(source, /`\$\{identifierText\(templateId\)\}::\$\{identifierText\(reportId\)\}`/);
});

test("document override route and UI do not mutate business modules", async () => {
  const route = await readFile(new URL("../app/api/documents-v2/override/route.ts", import.meta.url), "utf8");
  const ui = await readFile(new URL("../components/documents/DocumentGeneratorV2.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(route, /booking-delivery|sales-report|commission|stock/i);
  assert.match(ui, /line14Label/);
  assert.doesNotMatch(ui, /\+ เพิ่มค่าใช้จ่าย/);
  assert.doesNotMatch(ui, /แสดงแยกในเอกสารแนบท้าย/);
});

test("temporary receipt maps the custom expense into existing PDF row 14", async () => {
  const source = await readFile(new URL("../lib/documents-v2/generator.ts", import.meta.url), "utf8");
  assert.match(source, /\["line14Label", \["undefined_19"\]\]/);
  assert.match(source, /\["line14Amount", \["fill_46"\]\]/);
  assert.match(source, /line14Amount/);
  assert.match(source, /yes: "undefined_20", no: "undefined_21"/);
  assert.doesNotMatch(source, /appendOtherExpensesPage/);
});

test("row 14 is rendered before unchanged row 15 and total", async () => {
  const ui = await readFile(new URL("../components/documents/DocumentGeneratorV2.tsx", import.meta.url), "utf8");
  const row14 = ui.indexOf('data-document-row={idx}');
  const row15 = ui.indexOf('data-document-row="15"');
  const total = ui.indexOf("ยอดชำระเงินรวมทั้งสิ้น", row15);
  assert.ok(row14 >= 0 && row15 > row14 && total > row15);
  assert.match(ui, /\.deposit \|\| ""/);
  assert.match(ui, /\.remainingAmount \|\| ""/);
});

test("sales contract uses the audited AcroForm business mapping", async () => {
  const source = await readFile(new URL("../lib/documents-v2/mapping-store.ts", import.meta.url), "utf8");
  for (const mapping of [
    'Text1: "paymentDate"', 'Text3: "remainingAmount"', 'Text4: "sellPrice"',
    'Text6: "chassisNo"', 'Text7: "contractDate"', 'Text8: "contractDate"',
    'Text9: "customerName"', 'Text10: "customerAddress"', 'Text11: "idCard"',
    'Text13: "brand"', 'Text14: "model"', 'Text15: "plateNo"',
    'Text16: "engineNo"', 'Text17: "deposit"'
  ]) assert.match(source, new RegExp(mapping.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("sales contract exposes Thai edit controls without raw AcroForm diagnostics", async () => {
  const ui = await readFile(new URL("../components/documents/DocumentGeneratorV2.tsx", import.meta.url), "utf8");
  assert.match(ui, /ข้อมูลสัญญาซื้อขาย/);
  assert.match(ui, /แก้ไขข้อมูลสัญญา/);
  assert.match(ui, /ชื่อผู้ซื้อ \/ นิติบุคคล/);
  assert.match(ui, /เลขบัตรประชาชน \/ เลขผู้เสียภาษี/);
  assert.match(ui, /ใช้ข้อมูลเดิมจากระบบ/);
  assert.match(ui, /setSettingsMode\(isDev &&/);
});

test("identifier paths do not use numeric coercion", async () => {
  const files = [
    "../lib/documents-v2/types.ts",
    "../lib/documents/pdf-generator.ts",
    "../lib/documents/pdf-placeholder-replacer.ts"
  ];
  for (const file of files) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /(?:phone|idCard|customer_id_no|postal)[^\n]{0,80}(?:parseInt|parseFloat)/i);
  }
});

test("report switching is latest-request-only and resolves source plus override together", async () => {
  const ui = await readFile(new URL("../components/documents/DocumentGeneratorV2.tsx", import.meta.url), "utf8");
  assert.match(ui, /const token = \+\+reportRequestSeqRef\.current/);
  assert.match(ui, /new AbortController\(\)/);
  assert.match(ui, /Promise\.all\(\[/);
  assert.match(ui, /token !== reportRequestSeqRef\.current/);
  assert.match(ui, /requestReportId !== selectedReportId/);
  assert.match(ui, /pendingReportGenerationRef/);
  assert.match(ui, /กำลังโหลดข้อมูล/);
  assert.match(ui, /กำลังสร้างตัวอย่างเอกสาร/);
  assert.match(ui, /ข้อมูลพร้อมแล้ว/);
});

test("document actions cannot use a stale preview or image", async () => {
  const ui = await readFile(new URL("../components/documents/DocumentGeneratorV2.tsx", import.meta.url), "utf8");
  assert.match(ui, /previewSourceKey\.startsWith\(`\$\{templateId\}::\$\{selectedReportId\}::`\)/);
  assert.match(ui, /pngSourceKey === previewSourceKey/);
  assert.match(ui, /setPngSourceKey\(""\)/);
  assert.match(ui, /URL\.revokeObjectURL/);
  assert.match(ui, /shareState === "preparing"/);
  assert.match(ui, /nav\.canShare/);
  assert.match(ui, /กำลังเตรียมรูป/);
  assert.doesNotMatch(ui, />\s*ดาวน์โหลด PNG\s*</);
});

test("report switching has distinct recoverable data and preview errors", async () => {
  const ui = await readFile(new URL("../components/documents/DocumentGeneratorV2.tsx", import.meta.url), "utf8");
  assert.match(ui, /โหลดข้อมูลรายงานขายไม่สำเร็จ กรุณาลองใหม่/);
  assert.match(ui, /ข้อมูลโหลดแล้ว แต่สร้างตัวอย่างเอกสารไม่สำเร็จ/);
  assert.match(ui, /บันทึกแล้ว แต่แสดงตัวอย่างเอกสารไม่สำเร็จ กรุณากดอัปเดตเอกสาร/);
  assert.match(ui, /ลองใหม่/);
});
