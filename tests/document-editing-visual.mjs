import { chromium } from "playwright";
import { mkdir, readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3010";
const outputDir = "artifacts/document-editing-expenses";
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const report = { id: "REPORT-DOC-FIXTURE", customerName: "ลูกค้าทดสอบเอกสาร", plate: "QA 0001", saleName: "บิ๊ก", phone: "0917785117", idCard: "0123456789012", salePrice: "399000", bookingPrice: "5000" };

await page.route("**/api/reports/history?**", (route) => route.fulfill({ json: { reports: [report] } }));
await page.route("**/api/documents-v2/fields?**", (route) => route.fulfill({ json: { ok: true, fields: [{ name: "fill_46", type: "PDFTextField" }], templateFile: "temporary-receipt.pdf" } }));
await page.route("**/api/documents-v2/mapping?**", (route) => route.fulfill({ json: { ok: true, mapping: { fill_46: "raw:line14Amount" } } }));
await page.route("**/api/documents-v2/resolve-data", (route) => route.fulfill({ json: { ok: true, data: { customerName: report.customerName, plateNo: report.plate, phone: report.phone, idCard: report.idCard, sellPrice: "399,000", deposit: "5,000", remainingAmount: "394,000" }, debug: {} } }));
await page.route("**/api/documents-v2/override?**", (route) => route.fulfill({ json: { ok: true, override: null } }));

await page.goto(`${baseUrl}/documents-v2`, { waitUntil: "networkidle" });
await page.locator("select").nth(0).selectOption("temporary-receipt");
await page.locator("select").nth(1).selectOption("REPORT-DOC-FIXTURE");
await page.getByRole("button", { name: "+ เพิ่มค่าใช้จ่าย" }).click();
await page.getByRole("button", { name: "+ เพิ่มค่าใช้จ่าย" }).click();
await page.locator("label").filter({ hasText: "ชื่อรายการ" }).nth(0).locator("input").fill("ค่าโอน");
await page.locator('input[inputmode="decimal"]').nth(0).fill("1,500.50");
await page.locator("label").filter({ hasText: "ชื่อรายการ" }).nth(1).locator("input").fill("ค่าขนส่ง");
await page.locator('input[inputmode="decimal"]').nth(1).fill("2,350.75");
await page.screenshot({ path: `${outputDir}/document-edit-mobile-390.png`, fullPage: true });
const overflow390 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
if (overflow390 > 0) throw new Error(`390px overflow: ${overflow390}`);

const responsive = { 390: overflow390 };
for (const width of [360, 430, 768]) {
  await page.setViewportSize({ width, height: width < 700 ? 844 : 900 });
  responsive[width] = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (responsive[width] > 0) throw new Error(`${width}px overflow: ${responsive[width]}`);
}
await page.setViewportSize({ width: 1440, height: 1000 });
await page.screenshot({ path: `${outputDir}/document-edit-desktop-1440.png`, fullPage: true });
const overflow1440 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
if (overflow1440 > 0) throw new Error(`1440px overflow: ${overflow1440}`);
responsive[1440] = overflow1440;

const oldPreview = await page.locator("iframe").getAttribute("src").catch(() => "");
await page.getByRole("button", { name: "อัปเดตเอกสาร" }).click();
await page.waitForFunction((oldValue) => {
  const current = document.querySelector("iframe")?.getAttribute("src") || "";
  return Boolean(current && current !== oldValue);
}, oldPreview);
await page.getByRole("link", { name: /Download PDF/ }).waitFor();
const downloadPromise = page.waitForEvent("download");
await page.getByRole("link", { name: /Download PDF/ }).click();
const download = await downloadPromise;
const pdfPath = `${outputDir}/document-expenses-preview.pdf`;
await download.saveAs(pdfPath);
const pdf = await PDFDocument.load(await readFile(pdfPath));
if (pdf.getPageCount() < 2) throw new Error("custom expenses attachment page missing");

console.log(JSON.stringify({ responsive, pdfPages: pdf.getPageCount(), consoleErrors: [] }));
await browser.close();
