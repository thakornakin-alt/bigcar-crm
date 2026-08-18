import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { formatDocumentMoney, identifierText, normalizeOtherExpenses, parseDocumentMoney } from "../lib/documents/value-integrity.ts";

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

test("multiple document-local expenses normalize independently", () => {
  assert.deepEqual(normalizeOtherExpenses([
    { id: "a", label: "ค่าโอน", amount: "500" },
    { id: "b", label: "ค่าขนส่ง", amount: "1,500.50", note: "ส่งต่างจังหวัด" }
  ]), [
    { id: "a", label: "ค่าโอน", amount: 500 },
    { id: "b", label: "ค่าขนส่ง", amount: 1500.5, note: "ส่งต่างจังหวัด" }
  ]);
});

test("override persistence is keyed by template and report", async () => {
  const source = await readFile(new URL("../lib/documents-v2/override-store.ts", import.meta.url), "utf8");
  assert.match(source, /`\$\{identifierText\(templateId\)\}::\$\{identifierText\(reportId\)\}`/);
});

test("document override route and UI do not mutate business modules", async () => {
  const route = await readFile(new URL("../app/api/documents-v2/override/route.ts", import.meta.url), "utf8");
  const ui = await readFile(new URL("../components/documents/DocumentGeneratorV2.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(route, /booking-delivery|sales-report|commission|stock/i);
  assert.match(ui, /otherExpensesJson/);
  assert.match(ui, /ไม่เปลี่ยนยอดชำระเงินรวม/);
});

test("PDF generator appends every custom expense and retains legacy line14", async () => {
  const source = await readFile(new URL("../lib/documents-v2/generator.ts", import.meta.url), "utf8");
  assert.match(source, /expenses\.forEach/);
  assert.match(source, /line14Amount/);
  assert.match(source, /appendOtherExpensesPage/);
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
