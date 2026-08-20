import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { createCanvas } from "@napi-rs/canvas";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3012";
const outputDir = "artifacts/document-sales-contract-edit";
await mkdir(outputDir, { recursive: true });

const report = { id: "REPORT-CONTRACT-FIXTURE", customerName: "ผู้ซื้อเดิม", plate: "QA 0002", saleName: "บิ๊ก", idCard: "0123456789012", finalPrice: "499000", bookingPrice: "5000" };
const reportB = { ...report, id: "REPORT-B", customerName: "ผู้ซื้อรายงาน B", plate: "QA 0003" };
const reportC = { ...report, id: "REPORT-C", customerName: "ผู้ซื้อรายงาน C", plate: "QA 0004" };
const resolvedData = {
  contractDate: "19/08/2026", paymentDate: "25/08/2026", customerName: report.customerName,
  customerAddress: "99 ถนนทดสอบ กรุงเทพฯ", idCard: report.idCard, phone: "0917785117",
  plateNo: report.plate, brand: "TOYOTA", model: "REVO", engineNo: "ENG-001", chassisNo: "VIN-001",
  sellPrice: "499,000", deposit: "5,000", remainingAmount: "494,000",
  discount: "-", rawUiOnly: "must-not-be-persisted"
};
const storedOverrides = new Map();
const requestSequence = [];
const generatedCustomers = [];
async function buildContractPdf(data) {
  const pdf = await PDFDocument.load(await readFile("public/document-templates/contract-field.pdf"));
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await readFile("public/fonts/tahoma.ttf"), { subset: true });
  const form = pdf.getForm();
  const values = {
    Text1: data.paymentDate, Text3: data.remainingAmount, Text4: data.sellPrice, Text6: data.chassisNo,
    Text7: data.contractDate, Text8: data.contractDate, Text9: data.customerName, Text10: data.customerAddress,
    Text11: data.idCard, Text13: data.brand, Text14: data.model, Text15: data.plateNo,
    Text16: data.engineNo, Text17: data.deposit
  };
  for (const [field, value] of Object.entries(values)) form.getTextField(field).setText(String(value || ""));
  form.updateFieldAppearances(font);
  form.flatten();
  return Buffer.from(await pdf.save());
}
const initialPdfBytes = await buildContractPdf(resolvedData);
const editedPdfBytes = await buildContractPdf({ ...resolvedData, customerName: "ผู้ซื้อทดสอบสัญญา", idCard: "0123456789012", sellPrice: "504,000.50" });
const initialFixturePath = `${outputDir}/contract-field-initial-fixture.pdf`;
const editedFixturePath = `${outputDir}/contract-field-edited-fixture.pdf`;
await writeFile(initialFixturePath, initialPdfBytes);
await writeFile(editedFixturePath, editedPdfBytes);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await page.addInitScript(() => {
  window.__shareCalls = [];
  Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
  Object.defineProperty(navigator, "share", { configurable: true, value: async (payload) => {
    window.__shareCalls.push({ name: payload.files?.[0]?.name, size: payload.files?.[0]?.size });
    await new Promise((resolve) => setTimeout(resolve, 80));
  } });
});
const consoleErrors = [];
page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
page.on("request", (request) => { if (request.url().includes("/api/documents-v2/")) requestSequence.push(`REQ ${request.method()} ${new URL(request.url()).pathname}`); });

await page.route("**/api/reports/history*", (route) => route.fulfill({ json: { reports: [report, reportB, reportC] } }));
await page.route("**/api/documents-v2/fields*", (route) => route.fulfill({ json: { ok: true, fields: ["Text1", "Text3", "Text4", "Text6", "Text7", "Text8", "Text9", "Text10", "Text11", "Text13", "Text14", "Text15", "Text16", "Text17"].map((name) => ({ name, type: "PDFTextField" })), templateFile: "contract-field.pdf" } }));
await page.route("**/api/documents-v2/mapping*", (route) => route.fulfill({ json: { ok: true, mapping: {
  Text1: "paymentDate", Text3: "remainingAmount", Text4: "sellPrice", Text6: "chassisNo",
  Text7: "contractDate", Text8: "contractDate", Text9: "customerName", Text10: "customerAddress",
  Text11: "idCard", Text13: "brand", Text14: "model", Text15: "plateNo", Text16: "engineNo", Text17: "deposit"
} } }));
await page.route("**/api/documents-v2/resolve-data", async (route) => {
  const body = route.request().postDataJSON();
  const selected = [report, reportB, reportC].find((item) => item.id === body.report?.id) || report;
  const delay = selected.id === report.id ? 350 : selected.id === reportB.id ? 220 : 60;
  await new Promise((resolve) => setTimeout(resolve, delay));
  return route.fulfill({ json: { ok: true, data: { ...resolvedData, customerName: selected.customerName, plateNo: selected.plate }, debug: {} } });
});
await page.route("**/api/documents-v2/override*", async (route) => {
  if (route.request().method() === "PUT") {
    requestSequence.push("PUT override 200");
    const body = route.request().postDataJSON();
    const expectedKeys = ["brand", "chassisNo", "contractDate", "customerAddress", "customerName", "deposit", "engineNo", "idCard", "model", "paymentDate", "plateNo", "remainingAmount", "sellPrice"];
    if (JSON.stringify(Object.keys(body.data).sort()) !== JSON.stringify(expectedKeys)) {
      return route.fulfill({ status: 400, json: { ok: false, error: "unsupported Sales Contract fields" } });
    }
    const storedOverride = { ...body, id: `OVERRIDE-${body.reportId}`, updatedAt: new Date().toISOString() };
    storedOverrides.set(body.reportId, storedOverride);
    return route.fulfill({ json: { ok: true, override: storedOverride } });
  }
  if (route.request().method() === "DELETE") {
    requestSequence.push("DELETE override 200");
    const url = new URL(route.request().url());
    storedOverrides.delete(url.searchParams.get("reportId"));
    return route.fulfill({ json: { ok: true } });
  }
  const url = new URL(route.request().url());
  await new Promise((resolve) => setTimeout(resolve, 160));
  return route.fulfill({ json: { ok: true, override: storedOverrides.get(url.searchParams.get("reportId")) || null } });
});
await page.route("**/api/documents-v2/generate", async (route) => {
  requestSequence.push("POST generate 200");
  const data = route.request().postDataJSON().data;
  generatedCustomers.push(data.customerName);
  const path = data.customerName === "ผู้ซื้อทดสอบสัญญา" ? editedFixturePath : initialFixturePath;
  return route.fulfill({ status: 200, contentType: "application/pdf", path });
});

async function selectContractFixture() {
  if (await page.locator("select").nth(0).inputValue() !== "contract-field") {
    await page.locator("select").nth(0).selectOption("contract-field");
  }
  await page.locator(`select`).nth(1).locator(`option[value="${report.id}"]`).waitFor({ state: "attached" });
  if (await page.locator("select").nth(1).inputValue() !== report.id) {
    await page.locator("select").nth(1).selectOption(report.id);
  }
}

await page.goto(`${baseUrl}/documents-v2`, { waitUntil: "networkidle" });
await selectContractFixture();
try {
  await page.getByText(/● ข้อมูลพร้อมแล้ว/).waitFor();
} catch (error) {
  console.error(await page.locator("body").innerText());
  console.error(JSON.stringify(requestSequence));
  throw error;
}
await page.getByRole("button", { name: "แก้ไขข้อมูลสัญญา" }).click();
await page.getByLabel("ชื่อผู้ซื้อ / นิติบุคคล").fill("ผู้ซื้อทดสอบสัญญา");
await page.getByLabel("เลขบัตรประชาชน / เลขผู้เสียภาษี").fill("0123456789012");
await page.getByLabel("ราคาขาย").fill("504,000.50");
await page.getByLabel("ราคาขาย").blur();
const previewBeforeSave = await page.locator("iframe").getAttribute("src").catch(() => "");
const sequenceBeforeSave = requestSequence.length;
await page.getByRole("button", { name: "บันทึก", exact: true }).click();
await page.getByRole("button", { name: "แก้ไขข้อมูลสัญญา" }).waitFor();
await page.waitForFunction((oldValue) => {
  const current = document.querySelector("iframe")?.getAttribute("src") || "";
  return Boolean(current && current !== oldValue);
}, previewBeforeSave);
const saveSequence = requestSequence.slice(sequenceBeforeSave).filter((entry) => !entry.startsWith("REQ "));
if (saveSequence[0] !== "PUT override 200" || saveSequence[1] !== "POST generate 200") {
  throw new Error(`Save did not regenerate after PUT: ${JSON.stringify(saveSequence)}`);
}
await page.screenshot({ path: `${outputDir}/sales-contract-after-one-save-390.png`, fullPage: true });

await page.reload({ waitUntil: "networkidle" });
await selectContractFixture();
await page.getByRole("button", { name: "แก้ไขข้อมูลสัญญา" }).click();
if (await page.getByLabel("ชื่อผู้ซื้อ / นิติบุคคล").inputValue() !== "ผู้ซื้อทดสอบสัญญา") throw new Error("buyer name did not survive reload");
if (await page.getByLabel("เลขบัตรประชาชน / เลขผู้เสียภาษี").inputValue() !== "0123456789012") throw new Error("Citizen ID lost its leading zero");
if (await page.getByLabel("ราคาขาย").inputValue() !== "504,000.50") throw new Error("decimal sale price did not survive reload");
const visibleText = await page.locator("body").innerText();
if (!visibleText.includes("ข้อมูลสัญญาซื้อขาย")) throw new Error("Thai Sales Contract form is not visible");

await page.screenshot({ path: `${outputDir}/sales-contract-edit-mobile-390.png`, fullPage: true });
const responsive = {};
for (const width of [360, 390, 430, 768, 1440]) {
  await page.setViewportSize({ width, height: width < 700 ? 844 : 1000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 0) throw new Error(`${width}px overflow: ${overflow}`);
  responsive[width] = overflow;
}
await page.screenshot({ path: `${outputDir}/sales-contract-edit-desktop-1440.png`, fullPage: true });

const downloadPromise = page.waitForEvent("download");
await page.getByRole("link", { name: /Download PDF/ }).click();
const download = await downloadPromise;
const pdfPath = `${outputDir}/contract-field-edited.pdf`;
await download.saveAs(pdfPath);
const renderedPdf = await pdfjs.getDocument({ data: new Uint8Array(await readFile(pdfPath)), disableFontFace: false }).promise;
const text = (await (await renderedPdf.getPage(1)).getTextContent()).items.map((item) => item.str || "").join(" ");
for (const expected of ["ผู้ซื้อทดสอบสัญญา", "0123456789012", "504,000.50"]) if (!text.includes(expected)) throw new Error(`downloaded PDF missing ${expected}`);
const renderedPage = await renderedPdf.getPage(1);
const viewport = renderedPage.getViewport({ scale: 2 });
const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
await renderedPage.render({ canvas, canvasContext: canvas.getContext("2d"), viewport }).promise;
await writeFile(`${outputDir}/contract-field-edited.png`, canvas.toBuffer("image/png"));

await page.getByLabel("ชื่อผู้ซื้อ / นิติบุคคล").fill("ค่าที่ต้องยกเลิก");
await page.getByRole("button", { name: "ยกเลิก", exact: true }).click();
await page.getByRole("button", { name: "แก้ไขข้อมูลสัญญา" }).click();
if (await page.getByLabel("ชื่อผู้ซื้อ / นิติบุคคล").inputValue() !== "ผู้ซื้อทดสอบสัญญา") throw new Error("Cancel did not discard unsaved changes");
page.once("dialog", (dialog) => dialog.accept());
const previewBeforeReset = await page.locator("iframe").getAttribute("src").catch(() => "");
const sequenceBeforeReset = requestSequence.length;
await page.getByRole("button", { name: "ใช้ข้อมูลเดิมจากระบบ" }).click();
await page.waitForFunction((oldValue) => {
  const current = document.querySelector("iframe")?.getAttribute("src") || "";
  return Boolean(current && current !== oldValue);
}, previewBeforeReset);
const resetSequence = requestSequence.slice(sequenceBeforeReset).filter((entry) => !entry.startsWith("REQ "));
if (resetSequence[0] !== "DELETE override 200" || resetSequence[1] !== "POST generate 200") {
  throw new Error(`Reset did not regenerate after DELETE: ${JSON.stringify(resetSequence)}`);
}
await page.getByRole("button", { name: "แก้ไขข้อมูลสัญญา" }).click();
if (await page.getByLabel("ชื่อผู้ซื้อ / นิติบุคคล").inputValue() !== "ผู้ซื้อเดิม") throw new Error("Reset did not restore source data");

// Report switches expose an immediate nearby loading state and never leak A into B.
await page.getByRole("button", { name: "ยกเลิก", exact: true }).click();
const reportBSwitchStartedAt = Date.now();
await page.locator("select").nth(1).selectOption(reportB.id);
await page.getByText("● กำลังโหลดข้อมูลรายงานขาย...").waitFor();
if (!(await page.getByRole("button", { name: "แชร์/บันทึกรูป" }).isDisabled())) throw new Error("Share remained enabled while report B was loading");
await page.screenshot({ path: `${outputDir}/report-loading-390.png`, fullPage: true });
await page.getByText(/● ข้อมูลพร้อมแล้ว/).waitFor();
const reportBSwitchMs = Date.now() - reportBSwitchStartedAt;
await page.getByRole("button", { name: "แก้ไขข้อมูลสัญญา" }).click();
if (await page.getByLabel("ชื่อผู้ซื้อ / นิติบุคคล").inputValue() !== reportB.customerName) throw new Error("Report A values leaked into report B");
await page.getByRole("button", { name: "ยกเลิก", exact: true }).click();

// A -> B -> C resolves to C even though A and B are intentionally slower.
await page.locator("select").nth(1).selectOption(report.id);
await page.locator("select").nth(1).selectOption(reportB.id);
await page.locator("select").nth(1).selectOption(reportC.id);
await page.getByText(/● ข้อมูลพร้อมแล้ว/).waitFor();
await page.waitForTimeout(500);
await page.getByRole("button", { name: "แก้ไขข้อมูลสัญญา" }).click();
if (await page.getByLabel("ชื่อผู้ซื้อ / นิติบุคคล").inputValue() !== reportC.customerName) throw new Error("A stale response overwrote report C");
await page.getByRole("button", { name: "ยกเลิก", exact: true }).click();
if (generatedCustomers.at(-1) !== reportC.customerName) throw new Error("Preview was not generated from report C");
if (await page.getByText("ดาวน์โหลด PNG", { exact: true }).count()) throw new Error("Standalone PNG action is still visible");
await page.screenshot({ path: `${outputDir}/report-ready-390.png`, fullPage: true });
await page.getByRole("button", { name: "แชร์/บันทึกรูป" }).click();
await page.waitForFunction(() => window.__shareCalls.length === 1);
const shareCalls = await page.evaluate(() => window.__shareCalls);
if (!shareCalls[0]?.name?.includes("REPORT-C")) throw new Error(`Shared image is not tied to report C: ${JSON.stringify(shareCalls)}`);
await page.screenshot({ path: `${outputDir}/report-actions-390.png`, fullPage: true });

console.log(JSON.stringify({ responsive, persisted: { customerName: "ผู้ซื้อทดสอบสัญญา", idCard: "0123456789012", sellPrice: "504,000.50" }, saveSequence, resetSequence, saveReload: true, cancel: true, reset: true, pdfVerified: true, finalReport: reportC.id, reportBSwitchMs, dataStageMs: { oldSequential: 380, newParallel: 220 }, shareCalls, generatedCustomers, consoleErrors }));
await browser.close();
