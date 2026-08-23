import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:4100";
const outputDir = "artifacts/document-report-first-brand";
await mkdir(outputDir, { recursive: true });

const reports = [
  { id: "REPORT-A", type: "sales", customerName: "นายสมชาย ใจดี", plate: "3ฒม 2182", brand: "TOYOTA", model: "REVO", saleName: "บิ๊ก", createdAt: "2026-08-18T09:00:00.000Z", updatedAt: "2026-08-18T09:00:00.000Z", status: "completed", phone: "0917785117", idCard: "0123456789012", year: "2022", color: "ดำ", teamName: "", emailSubject: "", emailTo: "", emailCc: "", emailStatus: "", lineStatus: "", ocrStatus: "", emailDraftId: "", driveFolderUrl: "", attachments: [], reportText: "" },
  { id: "REPORT-B", type: "sales", customerName: "บริษัท บี จำกัด", plate: "2ขล 807", brand: "HONDA", model: "CIVIC", saleName: "เมย์", createdAt: "2026-08-19T09:00:00.000Z", updatedAt: "2026-08-19T09:00:00.000Z", status: "completed", phone: "0812345678", idCard: "0990000000001", year: "2021", color: "ขาว", teamName: "", emailSubject: "", emailTo: "", emailCc: "", emailStatus: "", lineStatus: "", ocrStatus: "", emailDraftId: "", driveFolderUrl: "", attachments: [], reportText: "" }
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const counts = { resolve: 0, override: 0, generate: 0 };
const timings = [];
const consoleErrors = [];
page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
await page.route("**/api/reports/history*", (route) => route.fulfill({ json: { reports } }));
await page.route("**/api/documents-v2/resolve-data", async (route) => {
  counts.resolve += 1;
  const report = route.request().postDataJSON().report;
  await new Promise((resolve) => setTimeout(resolve, 160));
  await route.fulfill({ json: { ok: true, data: { customerName: report.customerName, phone: report.phone, idCard: report.idCard, plateNo: report.plate, brand: report.brand, model: report.model, year: report.year, color: report.color, sellPrice: "504,000.50", customerAddress: "98 ถนนทดสอบ กรุงเทพมหานคร", engineNo: "ENG-001", chassisNo: "VIN-001" }, debug: {} } });
});
await page.route("**/api/documents-v2/override*", async (route) => {
  if (route.request().method() === "GET") counts.override += 1;
  await route.fulfill({ json: { ok: true, override: null } });
});
page.on("request", (request) => { if (request.url().includes("/api/documents-v2/generate") && request.method() === "POST") counts.generate += 1; });
await page.route("**/api/documents-v2/generate", async (route) => {
  const templateId = route.request().postDataJSON().templateId || "contract-field";
  const pdf = await readFile(`public/document-templates/${templateId}.pdf`);
  await new Promise((resolve) => setTimeout(resolve, 90));
  await route.fulfill({ status: 200, contentType: "application/pdf", body: pdf });
});

await page.goto(`${baseUrl}/documents-v2`, { waitUntil: "domcontentloaded" });
await page.getByTestId("documents-report-selector").locator('option[value="REPORT-A"]').waitFor({ state: "attached" });
await page.getByText(/ข้อมูลพร้อมแล้ว/).waitFor({ timeout: 30000 });
await page.screenshot({ path: `${outputDir}/after-mobile-390.png`, fullPage: true });

for (const templateId of ["temporary-receipt", "power-of-attorney", "transport-transfer-request", "vehicle-delivery-document"]) {
  const before = { ...counts };
  const started = performance.now();
  await page.getByTestId("documents-template-selector").selectOption(templateId);
  await page.getByText(/กำลังสร้างตัวอย่างเอกสาร/).first().waitFor({ timeout: 30000 });
  try {
    await page.getByText(/ข้อมูลพร้อมแล้ว/).waitFor({ timeout: 30000 });
  } catch (error) {
    console.error(await page.locator("body").innerText());
    throw error;
  }
  timings.push({ scenario: `same-report:${templateId}`, ms: Math.round(performance.now() - started), calls: { resolve: counts.resolve - before.resolve, override: counts.override - before.override, generate: counts.generate - before.generate } });
}

const beforeReportSwitch = { ...counts };
const reportStarted = performance.now();
await page.getByTestId("documents-report-selector").selectOption("REPORT-B");
await page.getByText(/กำลังโหลดข้อมูลรายงานขาย/).waitFor();
await page.screenshot({ path: `${outputDir}/loading-mobile-390.png`, fullPage: true });
await page.getByText(/ข้อมูลพร้อมแล้ว/).waitFor({ timeout: 30000 });
timings.push({ scenario: "report:A-to-B", ms: Math.round(performance.now() - reportStarted), calls: { resolve: counts.resolve - beforeReportSwitch.resolve, override: counts.override - beforeReportSwitch.override, generate: counts.generate - beforeReportSwitch.generate } });
await page.screenshot({ path: `${outputDir}/after-load-mobile-390.png`, fullPage: true });

const responsive = {};
for (const width of [360, 390, 430, 768, 1440]) {
  await page.setViewportSize({ width, height: width < 700 ? 844 : 1000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 0) throw new Error(`${width}px horizontal overflow ${overflow}`);
  responsive[width] = overflow;
}
await page.setViewportSize({ width: 1440, height: 1000 });
await page.screenshot({ path: `${outputDir}/after-desktop-1440.png`, fullPage: true });
if (counts.resolve !== 2) throw new Error(`expected exactly two report resolutions, got ${counts.resolve}`);
if (timings.filter((entry) => entry.scenario.startsWith("same-report:")).some((entry) => entry.calls.resolve !== 0 || entry.calls.override !== 1 || entry.calls.generate !== 1)) throw new Error(`same-report request contract failed: ${JSON.stringify(timings)}`);
if (consoleErrors.length) throw new Error(`console errors: ${consoleErrors.join(" | ")}`);
await writeFile(`${outputDir}/measurements.json`, JSON.stringify({ counts, timings, responsive, consoleErrors }, null, 2));
console.log(JSON.stringify({ counts, timings, responsive, consoleErrors }));
await browser.close();
