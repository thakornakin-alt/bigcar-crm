import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/calculator/page.tsx", import.meta.url), "utf8");
const preview = await readFile(new URL("../app/calculator/CalculatorQuotePreview.tsx", import.meta.url), "utf8");
const renderer = await readFile(new URL("../lib/calculator-quote-canvas.ts", import.meta.url), "utf8");
const profile = await readFile(new URL("../lib/user-profile.ts", import.meta.url), "utf8");
const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("installment formula and 48/60/72/84 term contract remain unchanged", () => {
  assert.match(page, /\(\(financeAmount \* rate \* years \+ financeAmount\) \/ months\) \* 1\.07/);
  assert.match(page, /key: "months48", months: 48, years: 4/);
  assert.match(page, /key: "months60", months: 60, years: 5/);
  assert.match(page, /key: "months72", months: 72, years: 6/);
  assert.match(page, /key: "months84", months: 84, years: 7/);
  assert.match(page, /const downRates = \[0, 0\.05, 0\.1, 0\.15, 0\.2, 0\.25, 0\.3, 0\.35, 0\.4, 0\.45, 0\.5\]/);
});

test("known calculator baseline values remain exact", () => {
  const financeAmount = 684000;
  const payment = (rate, months, years) => Math.round((((financeAmount * rate * years + financeAmount) / months) * 1.07 + Number.EPSILON) * 100) / 100;
  assert.equal(Math.round(payment(0.0279, 48, 4)), 16949);
  assert.equal(Math.round(payment(0.0309, 60, 5)), 14083);
  assert.equal(Math.round(payment(0.0399, 72, 6)), 12599);
  assert.equal(Math.round(payment(0.0449, 84, 7)), 11451);
});

test("Preview and PNG export use the same model and canvas renderer", () => {
  assert.match(preview, /drawCalculatorQuote\(canvas, model, assets, scale\)/);
  assert.match(preview, /const canvas = await render\(2\)/);
  assert.match(page, /<CalculatorQuotePreview ref=\{quotePreviewRef\} model=\{quoteModel\}/);
  assert.doesNotMatch(page, /exportInstallmentImage/);
});

test("commercial export hierarchy and required disclaimer remain", () => {
  for (const copy of ["รถคันที่คุณสนใจ", "ราคารถ", "แผนที่เลือก", "เปรียบเทียบค่างวด", "สอบถามรายละเอียดและนัดดูรถ"]) {
    assert.ok(renderer.includes(copy), `missing hierarchy copy: ${copy}`);
  }
  assert.match(renderer, /ค่างวดเป็นการประมาณการ อัตราและผลอนุมัติขึ้นอยู่กับเงื่อนไขของสถาบันการเงิน/);
});

test("canonical profile phone remains a string through render and export", () => {
  assert.match(profile, /phone: normalizeProfilePhone\(user\?\.phone\)/);
  assert.match(renderer, /`โทร\. \$\{model\.profile\.phone \|\| "-"\}`/);
  assert.doesNotMatch(renderer, /Number\(model\.profile\.phone/);
  assert.doesNotMatch(renderer, /parseInt\(model\.profile\.phone/);
  const phone = "0917785117";
  assert.equal(`โทร. ${phone}`, "โทร. 0917785117");
});

test("avatar uses initials fallback and missing QR is hidden", () => {
  assert.match(renderer, /if \(image\) drawImageCover/);
  assert.match(renderer, /else \{/);
  assert.match(renderer, /if \(assets\.lineQr\) \{/);
  assert.doesNotMatch(renderer, /logo-rdd/);
  assert.doesNotMatch(renderer, /LINE QR/);
});

test("export dimensions are fixed high-resolution portrait", () => {
  assert.match(renderer, /CALCULATOR_EXPORT_WIDTH = 1080/);
  assert.match(renderer, /CALCULATOR_EXPORT_HEIGHT = 1600/);
  assert.match(styles, /aspect-ratio: 1080 \/ 1600/);
});
