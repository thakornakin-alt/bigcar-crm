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
const resolvedData = {
  contractDate: "19/08/2026", paymentDate: "25/08/2026", customerName: report.customerName,
  customerAddress: "99 ถนนทดสอบ กรุงเทพฯ", idCard: report.idCard, phone: "0917785117",
  plateNo: report.plate, brand: "TOYOTA", model: "REVO", engineNo: "ENG-001", chassisNo: "VIN-001",
  sellPrice: "499,000", deposit: "5,000", remainingAmount: "494,000",
  discount: "-", rawUiOnly: "must-not-be-persisted"
};
let storedOverride = null;
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
const consoleErrors = [];
page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });

await page.route("**/api/reports/history*", (route) => route.fulfill({ json: { reports: [report] } }));
await page.route("**/api/documents-v2/fields*", (route) => route.fulfill({ json: { ok: true, fields: ["Text1", "Text3", "Text4", "Text6", "Text7", "Text8", "Text9", "Text10", "Text11", "Text13", "Text14", "Text15", "Text16", "Text17"].map((name) => ({ name, type: "PDFTextField" })), templateFile: "contract-field.pdf" } }));
await page.route("**/api/documents-v2/mapping*", (route) => route.fulfill({ json: { ok: true, mapping: {
  Text1: "paymentDate", Text3: "remainingAmount", Text4: "sellPrice", Text6: "chassisNo",
  Text7: "contractDate", Text8: "contractDate", Text9: "customerName", Text10: "customerAddress",
  Text11: "idCard", Text13: "brand", Text14: "model", Text15: "plateNo", Text16: "engineNo", Text17: "deposit"
} } }));
await page.route("**/api/documents-v2/resolve-data", (route) => route.fulfill({ json: { ok: true, data: resolvedData, debug: {} } }));
await page.route("**/api/documents-v2/override*", async (route) => {
  if (route.request().method() === "PUT") {
    const body = route.request().postDataJSON();
    const expectedKeys = ["brand", "chassisNo", "contractDate", "customerAddress", "customerName", "deposit", "engineNo", "idCard", "model", "paymentDate", "plateNo", "remainingAmount", "sellPrice"];
    if (JSON.stringify(Object.keys(body.data).sort()) !== JSON.stringify(expectedKeys)) {
      return route.fulfill({ status: 400, json: { ok: false, error: "unsupported Sales Contract fields" } });
    }
    storedOverride = { ...body, id: "OVERRIDE-CONTRACT-FIXTURE", updatedAt: new Date().toISOString() };
    return route.fulfill({ json: { ok: true, override: storedOverride } });
  }
  if (route.request().method() === "DELETE") {
    storedOverride = null;
    return route.fulfill({ json: { ok: true } });
  }
  return route.fulfill({ json: { ok: true, override: storedOverride } });
});
await page.route("**/api/documents-v2/generate", async (route) => {
  const data = route.request().postDataJSON().data;
  const path = data.customerName === "ผู้ซื้อทดสอบสัญญา" ? editedFixturePath : initialFixturePath;
  return route.fulfill({ status: 200, contentType: "application/pdf", path });
});

async function selectContractFixture() {
  if (await page.locator("select").nth(0).inputValue() !== "contract-field") {
    await page.locator("select").nth(0).selectOption("contract-field");
  }
  await page.locator("select").nth(1).selectOption(report.id);
}

await page.goto(`${baseUrl}/documents-v2`, { waitUntil: "networkidle" });
await selectContractFixture();
await page.getByRole("button", { name: "แก้ไขข้อมูลสัญญา" }).click();
await page.getByLabel("ชื่อผู้ซื้อ / นิติบุคคล").fill("ผู้ซื้อทดสอบสัญญา");
await page.getByLabel("เลขบัตรประชาชน / เลขผู้เสียภาษี").fill("0123456789012");
await page.getByLabel("ราคาขาย").fill("504,000.50");
await page.getByLabel("ราคาขาย").blur();
await page.getByRole("button", { name: "บันทึก", exact: true }).click();
await page.getByRole("button", { name: "แก้ไขข้อมูลสัญญา" }).waitFor();

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

const oldPreview = await page.locator("iframe").getAttribute("src").catch(() => "");
const updateButton = page.getByRole("button", { name: "อัปเดตเอกสาร" });
await updateButton.click();
await page.waitForFunction((oldValue) => {
  const current = document.querySelector("iframe")?.getAttribute("src") || "";
  return Boolean(current && current !== oldValue);
}, oldPreview);
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
await page.getByRole("button", { name: "ใช้ข้อมูลเดิมจากระบบ" }).click();
await page.getByRole("button", { name: "แก้ไขข้อมูลสัญญา" }).click();
if (await page.getByLabel("ชื่อผู้ซื้อ / นิติบุคคล").inputValue() !== "ผู้ซื้อเดิม") throw new Error("Reset did not restore source data");

console.log(JSON.stringify({ responsive, persisted: { customerName: "ผู้ซื้อทดสอบสัญญา", idCard: "0123456789012", sellPrice: "504,000.50" }, saveReload: true, cancel: true, reset: true, pdfVerified: true, consoleErrors }));
await browser.close();
