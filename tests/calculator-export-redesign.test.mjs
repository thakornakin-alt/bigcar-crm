import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const page = await readFile(new URL("../app/calculator/page.tsx", import.meta.url), "utf8");
const preview = await readFile(new URL("../app/calculator/CalculatorQuotePreview.tsx", import.meta.url), "utf8");
const renderer = await readFile(new URL("../lib/calculator-quote-canvas.ts", import.meta.url), "utf8");
const profile = await readFile(new URL("../lib/user-profile.ts", import.meta.url), "utf8");
const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const compiledRenderer = ts.transpileModule(renderer, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const rendererModule = { exports: {} };
new Function("exports", "module", "require", compiledRenderer)(rendererModule.exports, rendererModule, () => ({}));
const { createCalculatorQuoteGrid } = rendererModule.exports;

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
  for (const copy of ["รถคันที่คุณสนใจ", "ราคารถ", "ผ่อนเริ่มต้น", "เปรียบเทียบค่างวด", "สอบถามรายละเอียดและนัดดูรถ"]) {
    assert.ok(renderer.includes(copy), `missing hierarchy copy: ${copy}`);
  }
  assert.match(renderer, /ค่างวดเป็นการประมาณการ อัตราและผลอนุมัติขึ้นอยู่กับเงื่อนไขของสถาบันการเงิน/);
});

test("actual vehicle title and professional rough-quote fallback are explicit", () => {
  assert.match(renderer, /hasVehicleTitle \? model\.carModel\.trim\(\) : "คำนวณค่างวดเบื้องต้น"/);
  assert.match(renderer, /"อ้างอิงจากราคารถที่ระบุ"/);
  assert.doesNotMatch(renderer, /ยังไม่ระบุรุ่นรถ/);
});

test("selected payment hero shows the selected term rate while row emphasis remains authoritative", () => {
  assert.match(renderer, /ผ่อนเริ่มต้น/);
  assert.match(renderer, /บาท\/เดือน/);
  assert.match(renderer, /ดาวน์ \$\{selectedRow\?\.label \|\| "-"\} · \$\{selectedTerm\.months\} งวด/);
  assert.match(renderer, /const selectedInterestRate = model\.rate\[model\.selectedTermKey\]/);
  assert.match(renderer, /ดอกเบี้ย \$\{formatInterestRate\(selectedInterestRate\)\} ต่อปี/);
  assert.match(renderer, /const selected = row\.label === model\.selectedDownLabel/);
  assert.doesNotMatch(renderer, /selectedColumnIndex/);
  assert.doesNotMatch(renderer, /selectedColumn\.label/);
});

test("all installment headers render their actual model rates with a safe null fallback", () => {
  assert.match(renderer, /terms\.forEach\(\(term, termIndex\) => \{/);
  assert.match(renderer, /`ดอก \$\{formatInterestRate\(model\.rate\[term\.key\]\)\}`/);
  assert.match(renderer, /value === null \? "-" : `\$\{\(value \* 100\)\.toFixed\(2\)\}%`/);
  assert.match(renderer, /const headerHeight = 72/);
});

test("selected term no longer creates a special installment-column pill", () => {
  const tableRenderer = renderer.slice(renderer.indexOf("function drawInstallmentGrid"), renderer.indexOf("function drawGridText"));
  assert.doesNotMatch(tableRenderer, /selectedTermKey/);
  assert.doesNotMatch(tableRenderer, /roundRect\([^\n]*term/);
  assert.doesNotMatch(tableRenderer, /const active = selected/);
  assert.match(renderer, /ctx\.fillStyle = selected \? "#4b222b"/);
});

test("true grid contains exactly seven contiguous rectangles that sum to table width", () => {
  const grid = createCalculatorQuoteGrid(11);
  assert.equal(grid.columns.length, 7);
  assert.deepEqual(grid.columns.map((cell) => cell.width), [120, 160, 160, 136, 136, 136, 136]);
  grid.columns.forEach((cell) => {
    assert.ok(Number.isInteger(cell.left));
    assert.ok(Number.isInteger(cell.right));
    assert.ok(Number.isInteger(cell.width));
    assert.ok(Number.isInteger(cell.center));
  });
  assert.equal(grid.columns[0].left, grid.x);
  assert.equal(grid.columns.at(-1).right, grid.x + grid.width);
  for (let index = 1; index < grid.columns.length; index += 1) {
    assert.equal(grid.columns[index - 1].right, grid.columns[index].left, `gap or overlap before column ${index}`);
  }
  assert.equal(grid.columns.reduce((sum, cell) => sum + cell.width, 0), grid.width);
  assert.equal(grid.height, grid.headerHeight + grid.rowHeight * 11);
});

test("all term cells are equal width and every table layer consumes the same grid cells", () => {
  const grid = createCalculatorQuoteGrid(11);
  const termWidths = grid.columns.slice(3).map((cell) => cell.width);
  termWidths.forEach((width) => assert.equal(width, termWidths[0]));
  assert.match(renderer, /const \[downCell, downPaymentCell, financeCell, \.\.\.termCells\] = grid\.columns/);
  assert.match(renderer, /drawGridText\(ctx, cell, term\.label, grid\.y \+ 26\)/);
  assert.match(renderer, /drawGridText\(ctx, cell, `ดอก \$\{formatInterestRate\(model\.rate\[term\.key\]\)\}`, grid\.y \+ 50\)/);
  assert.match(renderer, /drawGridText\(ctx, termCells\[termIndex\], payment\(row\.payments\[term\.key\]\), rowCenterY\)/);
  assert.match(renderer, /ctx\.fillText\(text, cell\.center, centerY\)/);
  const tableRenderer = renderer.slice(renderer.indexOf("function drawInstallmentGrid"), renderer.indexOf("function drawGridText"));
  assert.doesNotMatch(tableRenderer, /"left"|"right"|cellPadding|cell\.right/);
});

test("full vertical, horizontal and outer grid borders derive only from the true grid", () => {
  assert.match(renderer, /ctx\.strokeStyle = "rgba\(255,255,255,0\.14\)"/);
  assert.match(renderer, /grid\.columns\.slice\(1\)\.forEach\(\(cell\) => \{/);
  assert.match(renderer, /ctx\.moveTo\(cell\.left \+ 0\.5, grid\.y\)/);
  assert.match(renderer, /for \(let rowBoundary = 0; rowBoundary <= model\.rows\.length; rowBoundary \+= 1\)/);
  assert.match(renderer, /grid\.y \+ grid\.headerHeight \+ rowBoundary \* grid\.rowHeight \+ 0\.5/);
  assert.match(renderer, /ctx\.strokeStyle = "rgba\(255,255,255,0\.16\)"/);
  assert.match(renderer, /ctx\.fillRect\(grid\.x, rowTop, grid\.width, grid\.rowHeight\)/);
  assert.match(renderer, /ctx\.fillRect\(grid\.x, rowTop, 5, grid\.rowHeight\)/);
});

test("every body value is centered horizontally and vertically in its real cell", () => {
  assert.match(renderer, /ctx\.textAlign = "center"/);
  assert.match(renderer, /ctx\.textBaseline = "middle"/);
  assert.match(renderer, /const rowCenterY = rowTop \+ grid\.rowHeight \/ 2/);
  for (const cellName of ["downCell", "downPaymentCell", "financeCell"]) {
    assert.match(renderer, new RegExp(`drawGridText\\(ctx, ${cellName}, [^\\n]+, rowCenterY\\)`));
  }
});

test("Calculator UI keeps all four hero-term selectors with the required label", () => {
  assert.match(page, /useState<\(typeof terms\)\[number\]\["key"\]>\("months84"\)/);
  assert.match(page, /เลือกงวดสำหรับยอดผ่อนด้านบน/);
  assert.match(page, /onClick=\{\(\) => setSelectedTermKey\(term\.key\)\}/);
  assert.match(page, /aria-pressed=\{selectedTermKey === term\.key\}/);
});

test("edge labels stay inside the 56px export safe area", () => {
  assert.match(renderer, /ctx\.fillText\("ข้อเสนอค่างวด", 1016, 82\)/);
  assert.match(renderer, /ctx\.fillText\("BIG CAR", 56, 1570\)/);
  assert.doesNotMatch(renderer, /ข้อเสนอค่างวดสำหรับคุณ/);
  assert.doesNotMatch(renderer, /BIG CAR • รถมือสองที่คุณวางใจ/);
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
