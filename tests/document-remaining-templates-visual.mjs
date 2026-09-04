import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createCanvas } from "@napi-rs/canvas";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const outputDir = "artifacts/document-remaining-templates";
await mkdir(outputDir, { recursive: true });

const reportA = { id: "REPORT-REMAINING-A", customerName: "ลูกค้าทดสอบ", customerAddress: "98 ถนนทดสอบ กรุงเทพมหานคร", plate: "0กก 00123", phone: "0917785117", idCard: "0123456789012", finalPrice: "504000.50", type: "sales" };
const reportB = { ...reportA, id: "REPORT-REMAINING-B", customerName: "ลูกค้าราย B", plate: "2ขล 807" };
const overrides = new Map();
const sequence = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await page.addInitScript(() => {
  window.__documentShareCalls = [];
  Object.defineProperty(navigator, "canShare", { configurable: true, value: ({ files }) => Array.isArray(files) && files.length > 0 });
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value: async ({ files }) => {
      const summary = await Promise.all((files || []).map(async (file) => {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const bitmap = await createImageBitmap(file);
        const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
          .map((value) => value.toString(16).padStart(2, "0")).join("").toUpperCase();
        const sample = document.createElement("canvas");
        sample.width = 320;
        sample.height = Math.round(320 * bitmap.height / bitmap.width);
        const sampleContext = sample.getContext("2d");
        sampleContext.drawImage(bitmap, 0, 0, sample.width, sample.height);
        const pixels = sampleContext.getImageData(0, 0, sample.width, sample.height).data;
        let nonWhite = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          if (pixels[index] < 250 || pixels[index + 1] < 250 || pixels[index + 2] < 250) nonWhite += 1;
        }
        return { name: file.name, type: file.type, size: file.size, signature: Array.from(bytes.slice(0, 8)), width: bitmap.width, height: bitmap.height, digest, nonWhite };
      }));
      window.__documentShareCalls.push(summary);
    }
  });
});
const consoleErrors = [];
page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
page.on("request", (request) => {
  if (request.url().includes("/api/documents-v2/override") && request.method() === "PUT") sequence.push("PUT override");
  if (request.url().includes("/api/documents-v2/generate") && request.method() === "POST") sequence.push("POST generate");
  if (request.url().includes("/api/documents-v2/override") && request.method() === "DELETE") sequence.push("DELETE override");
});

await page.route("**/api/reports/history*", (route) => route.fulfill({ json: { reports: [reportA, reportB] } }));
await page.route("**/api/documents-v2/resolve-data", async (route) => {
  const body = route.request().postDataJSON();
  const report = body.report?.id === reportB.id ? reportB : reportA;
  return route.fulfill({ json: { ok: true, data: {
    customerName: report.customerName, customerAddress: report.customerAddress, idCard: report.idCard,
    phone: report.phone, plateNo: report.plate, brand: "TOYOTA", model: "REVO", year: "2022",
    color: "ดำ", chassisNo: "VIN-001", engineNo: "ENG-001", sellPrice: "504,000.50"
  }, debug: {} } });
});
await page.route("**/api/documents-v2/override*", async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  const reportId = url.searchParams.get("reportId");
  if (request.method() === "PUT") {
    const body = request.postDataJSON();
    const saved = { ...body, updatedAt: new Date().toISOString() };
    overrides.set(body.reportId, saved);
    return route.fulfill({ json: { ok: true, override: saved } });
  }
  if (request.method() === "DELETE") {
    overrides.delete(reportId);
    return route.fulfill({ json: { ok: true } });
  }
  return route.fulfill({ json: { ok: true, override: overrides.get(reportId) || null } });
});

async function selectTemplate(templateId) {
  await page.getByTestId("documents-report-selector").locator(`option[value="${reportA.id}"]`).waitFor({ state: "attached" });
  if (await page.getByTestId("documents-report-selector").inputValue() !== reportA.id) await page.getByTestId("documents-report-selector").selectOption(reportA.id);
  await page.getByText(/● ข้อมูลพร้อมแล้ว/).waitFor({ timeout: 30000 });
  await page.getByTestId("documents-template-selector").selectOption(templateId);
  await page.getByText(/กำลังสร้างตัวอย่างเอกสาร/).first().waitFor({ timeout: 30000 });
  await page.getByText(/● ข้อมูลพร้อมแล้ว/).waitFor({ timeout: 30000 });
}

async function downloadAndVerify(fileStem, expectedText) {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: /Download PDF/ }).click();
  const download = await downloadPromise;
  const pdfPath = `${outputDir}/${fileStem}.pdf`;
  await download.saveAs(pdfPath);
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await readFile(pdfPath)), disableFontFace: false }).promise;
  const firstPage = await pdf.getPage(1);
  const text = (await firstPage.getTextContent()).items.map((item) => item.str || "").join(" ");
  for (const value of expectedText) if (!text.includes(value)) throw new Error(`${fileStem} PDF missing ${value}`);
  const viewport = firstPage.getViewport({ scale: 2 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  await firstPage.render({ canvas, canvasContext: canvas.getContext("2d"), viewport }).promise;
  await writeFile(`${outputDir}/${fileStem}.png`, canvas.toBuffer("image/png"));
}

await page.goto(`${baseUrl}/documents-v2`, { waitUntil: "networkidle" });
await selectTemplate("transport-transfer-request");
const transportInput = (label) => page.locator("label").filter({ hasText: label }).locator("input").last();
for (let attempt = 0; attempt < 3 && !(await transportInput("หมู่ที่").count()); attempt += 1) {
  await page.getByRole("button", { name: "แก้ไขข้อมูลเอกสาร" }).click();
  await page.waitForTimeout(500);
}
if (!(await transportInput("หมู่ที่").count())) throw new Error("transport edit form did not open");
await transportInput("หมู่ที่").fill("03");
await transportInput("ชนิดรถ").fill("รถยนต์นั่งส่วนบุคคล");
await transportInput("ชนิดเครื่องยนต์").fill("เบนซิน");
await transportInput("ราคาซื้อขาย").fill("504,000.50");
await page.screenshot({ path: `${outputDir}/transport-transfer-edit-390.png`, fullPage: true });
const transportSaveStart = sequence.length;
await page.getByRole("button", { name: "บันทึก", exact: true }).click();
await page.getByRole("button", { name: "แก้ไขข้อมูลเอกสาร" }).waitFor();
const transportSaveSequence = sequence.slice(transportSaveStart);
if (transportSaveSequence[0] !== "PUT override" || transportSaveSequence[1] !== "POST generate") throw new Error(`transport sequence ${JSON.stringify(transportSaveSequence)}`);
await downloadAndVerify("transport-transfer", ["03", "รถยนต์นั่งส่วนบุคคล", "เบนซิน", "504,000.50"]);
await page.getByRole("button", { name: "แชร์/บันทึกรูป" }).click();
await page.waitForFunction(() => window.__documentShareCalls.length === 1);

await selectTemplate("power-of-attorney");
await page.getByRole("button", { name: "แชร์/บันทึกรูป" }).click();
await page.waitForFunction(() => window.__documentShareCalls.length === 2);

await selectTemplate("vehicle-delivery-document");
const deliveryInput = (label) => page.locator("label").filter({ hasText: label }).locator("input").last();
for (let attempt = 0; attempt < 3 && !(await deliveryInput("เลขบัตรประชาชน").count()); attempt += 1) {
  await page.getByRole("button", { name: "แก้ไขข้อมูลเอกสาร" }).click();
  await page.waitForTimeout(500);
}
await deliveryInput("เลขบัตรประชาชน").fill("0123456789012");
await deliveryInput("โทรศัพท์").fill("0917785117");
await deliveryInput("รหัสไปรษณีย์").fill("00123");
await page.screenshot({ path: `${outputDir}/vehicle-delivery-edit-390.png`, fullPage: true });
const deliverySaveStart = sequence.length;
await page.getByRole("button", { name: "บันทึก", exact: true }).click();
await page.getByRole("button", { name: "แก้ไขข้อมูลเอกสาร" }).waitFor();
const deliverySaveSequence = sequence.slice(deliverySaveStart);
if (deliverySaveSequence[0] !== "PUT override" || deliverySaveSequence[1] !== "POST generate") throw new Error(`delivery sequence ${JSON.stringify(deliverySaveSequence)}`);
await downloadAndVerify("vehicle-delivery", ["0123456789012", "0917785117", "00123"]);
await page.getByRole("button", { name: "แชร์/บันทึกรูป" }).click();
await page.waitForFunction(() => window.__documentShareCalls.length === 3);
const shareCalls = await page.evaluate(() => window.__documentShareCalls);
for (const [index, expectedCount] of [2, 2, 1].entries()) {
  const files = shareCalls[index];
  if (files.length !== expectedCount) throw new Error(`share ${index} expected ${expectedCount} files, got ${files.length}`);
  for (const file of files) {
    if (file.type !== "image/png" || file.size <= 0) throw new Error(`invalid PNG ${JSON.stringify(file)}`);
    if (file.signature.join(",") !== "137,80,78,71,13,10,26,10") throw new Error(`invalid PNG signature ${file.name}`);
    if (file.width <= 0 || file.height <= 0) throw new Error(`invalid PNG dimensions ${file.name}`);
    if (file.nonWhite < 500) throw new Error(`blank or near-blank PNG ${file.name}: ${file.nonWhite}`);
  }
}
if (shareCalls[1][1].digest !== "95AAD576757F6B74F9FE51D0E98B0837FF592129FE462340B5885EE8A68F223E") {
  throw new Error(`Power page 2 did not use the static source asset: ${shareCalls[1][1].digest}`);
}
for (const files of shareCalls.slice(0, 2)) {
  if (!files[0].name.endsWith("-page-1.png") || !files[1].name.endsWith("-page-2.png")) {
    throw new Error(`two-page filenames invalid ${JSON.stringify(files.map((file) => file.name))}`);
  }
}
if (/page-[12]\.png$/.test(shareCalls[2][0].name)) throw new Error("single-page template filename changed");

const responsive = {};
for (const width of [360, 390, 430, 768, 1440]) {
  await page.setViewportSize({ width, height: width < 700 ? 844 : 1000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 0) throw new Error(`${width}px overflow ${overflow}`);
  responsive[width] = overflow;
}
const overlay = await page.locator("[data-nextjs-dialog]").count();
if (overlay) throw new Error("Next.js error overlay detected");
console.log(JSON.stringify({ transportSaveSequence, deliverySaveSequence, responsive, consoleErrors, pdfVerified: true, shareCalls }));
await browser.close();
