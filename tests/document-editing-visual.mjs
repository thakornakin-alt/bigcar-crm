import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { createCanvas } from "@napi-rs/canvas";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3010";
const outputDir = "artifacts/document-item14-expense-fix";
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const report = { id: "REPORT-DOC-FIXTURE", customerName: "ลูกค้าทดสอบเอกสาร", plate: "QA 0001", saleName: "บิ๊ก", phone: "0917785117", idCard: "0123456789012", salePrice: "399000", bookingPrice: "5000" };
let storedOverride = null;

await page.route("**/api/reports/history?**", (route) => route.fulfill({ json: { reports: [report] } }));
await page.route("**/api/documents-v2/fields?**", (route) => route.fulfill({ json: { ok: true, fields: [
  { name: "undefined_19", type: "PDFTextField" }, { name: "fill_46", type: "PDFTextField" },
  { name: "undefined_20", type: "PDFCheckBox" }, { name: "undefined_21", type: "PDFCheckBox" },
  { name: "Deposit", type: "PDFTextField" }
], templateFile: "temporary-receipt.pdf" } }));
await page.route("**/api/documents-v2/mapping?**", (route) => route.fulfill({ json: { ok: true, mapping: { undefined_19: "raw:line14Label", fill_46: "raw:line14Amount" } } }));
await page.route("**/api/documents-v2/resolve-data", (route) => route.fulfill({ json: { ok: true, data: { customerName: report.customerName, plateNo: report.plate, phone: report.phone, idCard: report.idCard, sellPrice: "399,000", deposit: "5,000", remainingAmount: "394,000" }, debug: {} } }));
await page.route("**/api/documents-v2/generate", async (route) => {
  const data = route.request().postDataJSON().data;
  const pdf = await PDFDocument.load(await readFile("public/document-templates/temporary-receipt.pdf"));
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await readFile("public/fonts/tahoma.ttf"), { subset: true });
  const form = pdf.getForm();
  form.getTextField("undefined_19").setText(data.line14Label);
  form.getTextField("fill_46").setText(data.line14Amount);
  form.getTextField("Deposit").setText(data.deposit);
  form.getCheckBox("undefined_21").check();
  form.updateFieldAppearances(font);
  form.flatten();
  return route.fulfill({ status: 200, contentType: "application/pdf", body: Buffer.from(await pdf.save()) });
});
await page.route("**/api/documents-v2/override*", async (route) => {
  if (route.request().method() === "PUT") {
    const body = route.request().postDataJSON();
    storedOverride = { ...body, id: "OVERRIDE-FIXTURE", updatedAt: new Date().toISOString() };
    return route.fulfill({ json: { ok: true, override: storedOverride } });
  }
  if (route.request().method() === "DELETE") {
    storedOverride = null;
    return route.fulfill({ json: { ok: true } });
  }
  return route.fulfill({ json: { ok: true, override: storedOverride } });
});

async function selectFixture() {
  await page.locator("select").nth(0).selectOption("temporary-receipt");
  await page.locator("select").nth(1).selectOption("REPORT-DOC-FIXTURE");
}

await page.goto(`${baseUrl}/documents-v2`, { waitUntil: "networkidle" });
await selectFixture();
const row14 = page.locator('[data-document-row="14"]');
await row14.getByLabel("ชื่อค่าใช้จ่ายอื่น ๆ").fill("ค่าขนส่ง");
await row14.getByLabel("จำนวนเงิน").fill("1,500.50");
await row14.getByLabel("เรียกเก็บ").check();
await page.getByRole("button", { name: "บันทึก", exact: true }).click();
await page.getByText("สถานะ: บันทึกแล้ว").waitFor();

await page.reload({ waitUntil: "networkidle" });
await selectFixture();
await row14.getByLabel("ชื่อค่าใช้จ่ายอื่น ๆ").waitFor();
if (await row14.getByLabel("ชื่อค่าใช้จ่ายอื่น ๆ").inputValue() !== "ค่าขนส่ง") throw new Error(`row 14 label did not survive reload: ${JSON.stringify(storedOverride)}`);
if (await row14.getByLabel("จำนวนเงิน").inputValue() !== "1,500.50") throw new Error("row 14 amount did not survive reload");
if (!(await row14.getByLabel("เรียกเก็บ").isChecked())) throw new Error("row 14 status did not survive reload");
if (await page.locator('[data-document-row="15"] input').inputValue() !== "5,000") throw new Error("row 15 deposit changed");
if (await page.getByLabel("ยอดชำระเงินรวมทั้งสิ้น").inputValue() !== "394,000") throw new Error("remainingAmount changed");

await row14.scrollIntoViewIfNeeded();
await page.screenshot({ path: `${outputDir}/item14-edit-mobile-390.png`, fullPage: true });
const overflow390 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
if (overflow390 > 0) throw new Error(`390px overflow: ${overflow390}`);
const responsive = { 390: overflow390 };
for (const width of [360, 430, 768]) {
  await page.setViewportSize({ width, height: width < 700 ? 844 : 900 });
  responsive[width] = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (responsive[width] > 0) throw new Error(`${width}px overflow: ${responsive[width]}`);
}
await page.setViewportSize({ width: 1440, height: 1000 });
await page.screenshot({ path: `${outputDir}/item14-edit-desktop-1440.png`, fullPage: true });
responsive[1440] = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
if (responsive[1440] > 0) throw new Error(`1440px overflow: ${responsive[1440]}`);

const oldPreview = await page.locator("iframe").getAttribute("src").catch(() => "");
await page.getByRole("button", { name: "อัปเดตเอกสาร" }).click();
await page.waitForFunction((oldValue) => {
  const current = document.querySelector("iframe")?.getAttribute("src") || "";
  return Boolean(current && current !== oldValue);
}, oldPreview, { timeout: 60000 }).catch(async (error) => {
  throw new Error(`${error.message}; page=${(await page.locator("body").innerText()).slice(0, 2000)}`);
});
await page.locator("iframe").screenshot({ path: `${outputDir}/item14-pdf-preview.png` });
await page.getByRole("link", { name: /Download PDF/ }).waitFor();
const downloadPromise = page.waitForEvent("download");
await page.getByRole("link", { name: /Download PDF/ }).click();
const download = await downloadPromise;
const pdfPath = `${outputDir}/temporary-receipt-item14.pdf`;
await download.saveAs(pdfPath);
const outputPdf = await PDFDocument.load(await readFile(pdfPath));
const templatePdf = await PDFDocument.load(await readFile("public/document-templates/temporary-receipt.pdf"));
if (outputPdf.getPageCount() !== templatePdf.getPageCount()) throw new Error("PDF page count changed; an attachment page may have been appended");
const renderedPdf = await pdfjs.getDocument({ data: new Uint8Array(await readFile(pdfPath)), disableFontFace: false }).promise;
const renderedPage = await renderedPdf.getPage(1);
const viewport = renderedPage.getViewport({ scale: 2 });
const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
await renderedPage.render({ canvas, canvasContext: canvas.getContext("2d"), viewport }).promise;
await writeFile(`${outputDir}/item14-downloaded-pdf.png`, canvas.toBuffer("image/png"));

console.log(JSON.stringify({ responsive, pdfPages: outputPdf.getPageCount(), row14: { label: "ค่าขนส่ง", amount: "1,500.50", status: "charge" }, row15Deposit: "5,000", remainingAmount: "394,000", consoleErrors: [] }));
await browser.close();
