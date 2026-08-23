import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createCanvas } from "@napi-rs/canvas";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3031";
const outputDir = "artifacts/document-power-of-attorney-address";
await mkdir(outputDir, { recursive: true });

const reportA = { id: "REPORT-POA-A", customerName: "ผู้มอบอำนาจเดิม", customerAddress: "ที่อยู่เดิมแบบรวม", plate: "QA 1234", saleName: "บิ๊ก", type: "sales" };
const reportB = { ...reportA, id: "REPORT-POA-B", customerName: "ผู้มอบอำนาจราย B", plate: "QA 5678" };
const resolved = { customerName: reportA.customerName, customerAddress: reportA.customerAddress, plateNo: reportA.plate };
const fields = ["Customer_name", "customer_age", "customer_race", "customer_nationality", "customer_house_no", "customer_soi", "customer_road", "cusyomer_subdistrict", "customer_district", "customer_province", "vehicle_plate", "DOCUMENT_DAY", "DOCUMENT_MONTH", "DOCUMENT_YEAR"];
const mapping = {
  DOCUMENT_DAY: "raw:document_day", DOCUMENT_MONTH: "raw:document_month", DOCUMENT_YEAR: "raw:document_year",
  Customer_name: "customerName", customer_age: "raw:customer_age", customer_race: "raw:customer_race",
  customer_nationality: "raw:customer_nationality", customer_house_no: "raw:customer_house_no",
  customer_soi: "raw:customer_soi", customer_road: "raw:customer_road", cusyomer_subdistrict: "raw:cusyomer_subdistrict",
  customer_district: "raw:customer_district", customer_province: "raw:customer_province", vehicle_plate: "raw:vehicle_plate"
};
const overrides = new Map();
const sequence = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const consoleErrors = [];
page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
page.on("request", (request) => {
  if (request.url().includes("/api/documents-v2/override") && request.method() === "PUT") sequence.push("PUT override");
  if (request.url().includes("/api/documents-v2/generate") && request.method() === "POST") sequence.push("POST generate");
  if (request.url().includes("/api/documents-v2/override") && request.method() === "DELETE") sequence.push("DELETE override");
});

await page.route("**/api/reports/history*", (route) => route.fulfill({ json: { reports: [reportA, reportB] } }));
await page.route("**/api/documents-v2/fields*", (route) => route.fulfill({ json: { ok: true, fields: fields.map((name) => ({ name, type: "PDFTextField" })), templateFile: "power-of-attorney.pdf" } }));
await page.route("**/api/documents-v2/mapping*", (route) => route.fulfill({ json: { ok: true, mapping } }));
await page.route("**/api/documents-v2/resolve-data", async (route) => {
  const body = route.request().postDataJSON();
  const report = body.report?.id === reportB.id ? reportB : reportA;
  return route.fulfill({ json: { ok: true, data: { ...resolved, customerName: report.customerName, plateNo: report.plate }, debug: {} } });
});
await page.route("**/api/documents-v2/override*", async (route) => {
  const request = route.request();
  if (request.method() === "PUT") {
    const body = request.postDataJSON();
    const stored = { ...body, id: `OVERRIDE-${body.reportId}`, updatedAt: new Date().toISOString() };
    overrides.set(body.reportId, stored);
    return route.fulfill({ json: { ok: true, override: stored } });
  }
  const url = new URL(request.url());
  const reportId = url.searchParams.get("reportId");
  if (request.method() === "DELETE") {
    overrides.delete(reportId);
    return route.fulfill({ json: { ok: true } });
  }
  return route.fulfill({ json: { ok: true, override: overrides.get(reportId) || null } });
});

async function selectPowerOfAttorney(reportId = reportA.id) {
  await page.getByTestId("documents-report-selector").locator(`option[value="${reportId}"]`).waitFor({ state: "attached" });
  if (await page.getByTestId("documents-report-selector").inputValue() !== reportId) await page.getByTestId("documents-report-selector").selectOption(reportId);
  await page.getByText(/● ข้อมูลพร้อมแล้ว/).waitFor();
  await page.getByTestId("documents-template-selector").selectOption("power-of-attorney");
  await page.getByText(/กำลังสร้างตัวอย่างเอกสาร/).first().waitFor();
  await page.getByText(/● ข้อมูลพร้อมแล้ว/).waitFor();
}

async function chooseAddress(label, search, exact) {
  const input = page.getByLabel(label, { exact: true });
  await input.fill(search);
  await page.getByRole("option", { name: exact, exact: true }).click();
}

await page.goto(`${baseUrl}/documents-v2`, { waitUntil: "networkidle" });
await selectPowerOfAttorney();
await page.getByRole("button", { name: "แก้ไขข้อมูลหนังสือมอบอำนาจ" }).click();

// Manual fallback is always available and can switch back without losing editability.
await page.getByRole("button", { name: "กรอกเอง", exact: true }).click();
await page.getByLabel("จังหวัด", { exact: true }).fill("จังหวัดเดิมไม่มาตรฐาน");
await page.getByRole("button", { name: "เลือกจากรายการ", exact: true }).click();

await page.getByLabel("บ้านเลขที่", { exact: true }).fill("98");
await page.getByLabel("หมู่ที่", { exact: true }).fill("23");
await page.getByLabel("อายุ", { exact: true }).fill("35");
await page.getByLabel("เชื้อชาติ", { exact: true }).fill("ไทย");
await page.getByLabel("สัญชาติ", { exact: true }).fill("ไทย");
await chooseAddress("จังหวัด", "กรุง", "กรุงเทพมหานคร");
await chooseAddress("เขต", "ดอน", "ดอนเมือง");
await chooseAddress("แขวง", "ดอน", "ดอนเมือง");
await page.screenshot({ path: `${outputDir}/power-of-attorney-edit-390.png`, fullPage: true });
await page.getByLabel("แขวง", { exact: true }).click();
await page.screenshot({ path: `${outputDir}/thai-address-selector-390.png`, fullPage: true });
await page.keyboard.press("Escape");

const saveStart = sequence.length;
await page.getByRole("button", { name: "บันทึก", exact: true }).click();
await page.getByRole("button", { name: "แก้ไขข้อมูลหนังสือมอบอำนาจ" }).waitFor();
const saveSequence = sequence.slice(saveStart);
if (saveSequence[0] !== "PUT override" || saveSequence[1] !== "POST generate") throw new Error(`Unexpected save sequence: ${JSON.stringify(saveSequence)}`);

await page.reload({ waitUntil: "networkidle" });
await selectPowerOfAttorney();
await page.getByRole("button", { name: "แก้ไขข้อมูลหนังสือมอบอำนาจ" }).click();
for (const [label, expected] of [["บ้านเลขที่", "98"], ["หมู่ที่", "23"], ["จังหวัด", "กรุงเทพมหานคร"], ["เขต", "ดอนเมือง"], ["แขวง", "ดอนเมือง"]]) {
  if (await page.getByLabel(label, { exact: true }).inputValue() !== expected) throw new Error(`${label} did not survive reload`);
}
await page.getByRole("button", { name: "ยกเลิก", exact: true }).click();

// Report B must not inherit report A's address override.
await page.getByTestId("documents-report-selector").selectOption(reportB.id);
await page.getByText(/● ข้อมูลพร้อมแล้ว/).waitFor();
await page.getByRole("button", { name: "แก้ไขข้อมูลหนังสือมอบอำนาจ" }).click();
if (await page.getByLabel("หมู่ที่", { exact: true }).inputValue()) throw new Error("Report A Moo leaked into report B");
await page.getByRole("button", { name: "ยกเลิก", exact: true }).click();
await page.getByTestId("documents-report-selector").selectOption(reportA.id);
await page.getByText(/● ข้อมูลพร้อมแล้ว/).waitFor();

const downloadPromise = page.waitForEvent("download");
await page.getByRole("link", { name: /Download PDF/ }).click();
const download = await downloadPromise;
const pdfPath = `${outputDir}/power-of-attorney-address.pdf`;
await download.saveAs(pdfPath);
const pdf = await pdfjs.getDocument({ data: new Uint8Array(await readFile(pdfPath)), disableFontFace: false }).promise;
const firstPage = await pdf.getPage(1);
const text = (await firstPage.getTextContent()).items.map((item) => item.str || "").join(" ");
for (const expected of ["98", "23", "ดอนเมือง", "กรุงเทพมหานคร"]) if (!text.includes(expected)) throw new Error(`PDF missing ${expected}`);
const viewport = firstPage.getViewport({ scale: 2 });
const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
await firstPage.render({ canvas, canvasContext: canvas.getContext("2d"), viewport }).promise;
await writeFile(`${outputDir}/power-of-attorney-address.png`, canvas.toBuffer("image/png"));

const responsive = {};
for (const width of [360, 390, 430, 768, 1440]) {
  await page.setViewportSize({ width, height: width < 700 ? 844 : 1000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 0) throw new Error(`${width}px overflow: ${overflow}`);
  responsive[width] = overflow;
}

await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole("button", { name: "แก้ไขข้อมูลหนังสือมอบอำนาจ" }).click();
page.once("dialog", (dialog) => dialog.accept());
const resetStart = sequence.length;
await page.getByRole("button", { name: "ใช้ข้อมูลเดิมจากระบบ", exact: true }).click();
await page.getByRole("button", { name: "แก้ไขข้อมูลหนังสือมอบอำนาจ" }).waitFor();
const resetSequence = sequence.slice(resetStart);
if (resetSequence[0] !== "DELETE override" || resetSequence[1] !== "POST generate") throw new Error(`Unexpected reset sequence: ${JSON.stringify(resetSequence)}`);

console.log(JSON.stringify({ saveSequence, resetSequence, responsive, pdfVerified: true, reloadVerified: true, crossReportLeakage: false, consoleErrors }));
await browser.close();
