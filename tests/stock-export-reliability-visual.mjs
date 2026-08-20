import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const outputDir = "artifacts/stock-export-reliability";
await mkdir(outputDir, { recursive: true });

const vehiclesA = [
  { plate: "1กก 1234", brand: "TOYOTA", model: "REVO", vehicleGroup: "กระบะ", status: "รอขาย", vin: "VIN-A", salePrice: "499000" },
  { plate: "2ขล 807", brand: "HONDA", model: "CITY", vehicleGroup: "เก๋ง", status: "รอขาย", vin: "VIN-B", salePrice: "399000" }
];
const vehiclesB = [vehiclesA[0]];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const consoleErrors = [];
const hydrationErrors = [];
page.on("console", (message) => {
  const text = message.text();
  if (/Extra attributes from the server|Hydration failed|did not match/i.test(text)) hydrationErrors.push(text);
  if (message.type() === "error" && !/Failed to load resource: the server responded with a status of 503/.test(text) && !/Extra attributes from the server/.test(text)) consoleErrors.push(text);
});

let stockMode = "initial-success";
let stockRequests = 0;
await page.route("**/api/stock/list*", async (route) => {
  stockRequests += 1;
  if (stockMode === "initial-success") {
    await new Promise((resolve) => setTimeout(resolve, 550));
    return route.fulfill({ json: { ok: true, vehicles: vehiclesA, total: 2, meta: { durationMs: 520, appsScriptDurationMs: 480, attempts: 1 } } });
  }
  if (stockMode === "failure") {
    await new Promise((resolve) => setTimeout(resolve, 350));
    return route.fulfill({ status: 503, json: { ok: false, errorCode: "timeout", message: "ระบบสต๊อกตอบกลับช้ากว่าปกติ กรุณาลองใหม่", retryable: true, meta: { durationMs: 30300, appsScriptDurationMs: 30000, attempts: 2 } } });
  }
  if (stockMode === "retry-success") {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return route.fulfill({ json: { ok: true, vehicles: vehiclesB, total: 1, meta: { durationMs: 280, appsScriptDurationMs: 250, attempts: 1 } } });
  }
  if (stockMode === "empty-success") return route.fulfill({ json: { ok: true, vehicles: [], total: 0, meta: { durationMs: 80, appsScriptDurationMs: 60, attempts: 1 } } });
  return route.fulfill({ status: 503, json: { ok: false, errorCode: "network_error", message: "เชื่อมต่อข้อมูลสต๊อกไม่สำเร็จ กรุณาลองใหม่", retryable: true } });
});
await page.route("**/api/line/groups", (route) => route.fulfill({ status: 503, json: { error: "optional unavailable" } }));
await page.route("**/api/reports/history*", (route) => route.fulfill({ status: 503, json: { error: "optional unavailable" } }));
await page.route("**/api/line/reservations", (route) => route.fulfill({ status: 503, json: { error: "optional unavailable" } }));

const initialStartedAt = Date.now();
await page.goto(`${baseUrl}/stock-export`);
await page.locator('[data-stock-state="initial"]').waitFor();
await page.screenshot({ path: `${outputDir}/stock-loading-mobile-390.png`, fullPage: true });
await page.locator('[data-stock-state="ready"]').waitFor();
const initialRenderMs = Date.now() - initialStartedAt;
if (!await page.getByText("2 คัน", { exact: true }).first().isVisible()) throw new Error("successful Stock count missing");
await page.getByRole("button", { name: "ดูรายการรถทั้งหมด" }).click();
await page.screenshot({ path: `${outputDir}/stock-ui-mobile-390.png`, fullPage: true });
await page.setViewportSize({ width: 1440, height: 1000 });
await page.screenshot({ path: `${outputDir}/stock-ui-desktop-1440.png`, fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });

stockMode = "failure";
const refreshStartedAt = Date.now();
await page.getByRole("button", { name: "อัปเดตข้อมูล" }).click();
await page.locator('[data-stock-state="refresh"]').waitFor();
await page.locator('[data-stock-state="stale"]').waitFor();
const refreshFailureMs = Date.now() - refreshStartedAt;
if (!await page.getByText("2 คัน", { exact: true }).first().isVisible()) throw new Error("refresh failure replaced previous count");
if (!await page.getByText(/ข้อมูลอาจไม่ใช่ล่าสุด/).isVisible()) throw new Error("stale indicator missing");
await page.screenshot({ path: `${outputDir}/stock-stale-mobile-390.png`, fullPage: true });

stockMode = "retry-success";
const beforeRetry = stockRequests;
const retryStartedAt = Date.now();
await page.getByRole("button", { name: "ลองใหม่" }).click();
await page.getByRole("button", { name: "กำลังลองใหม่..." }).waitFor();
if (!(await page.getByRole("button", { name: "กำลังลองใหม่..." }).isDisabled())) throw new Error("retry button not locked");
await page.locator('[data-stock-state="ready"]').waitFor();
const retrySuccessMs = Date.now() - retryStartedAt;
if (stockRequests !== beforeRetry + 1) throw new Error("retry issued duplicate requests");
if (!await page.getByText("1 คัน", { exact: true }).first().isVisible()) throw new Error("retry success did not replace Stock");
if (await page.getByText(/ข้อมูลอาจไม่ใช่ล่าสุด/).count()) throw new Error("stale indicator not cleared");

stockMode = "initial-failure";
await page.reload();
await page.locator('[data-stock-state="error"]').waitFor();
if (!await page.getByRole("button", { name: "ลองใหม่" }).isVisible()) throw new Error("initial error retry missing");
if (!await page.getByText("—", { exact: true }).first().isVisible()) throw new Error("initial failure was shown as zero Stock");
await page.screenshot({ path: `${outputDir}/stock-error-retry-mobile-390.png`, fullPage: true });

stockMode = "empty-success";
await page.getByRole("button", { name: "ลองใหม่" }).click();
await page.locator('[data-stock-state="ready"]').waitFor();
if (!await page.getByText("0 คัน", { exact: true }).first().isVisible()) throw new Error("legitimate empty Stock not shown as zero");

const overflow = {};
for (const width of [360, 390, 430, 768, 1440]) {
  await page.setViewportSize({ width, height: width < 700 ? 844 : 1000 });
  overflow[width] = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
}
if (Object.values(overflow).some(Boolean)) throw new Error(`horizontal overflow: ${JSON.stringify(overflow)}`);
if (hydrationErrors.length) throw new Error(`hydration errors: ${JSON.stringify(hydrationErrors)}`);
if (consoleErrors.length) throw new Error(`console errors: ${JSON.stringify(consoleErrors)}`);

console.log(JSON.stringify({ stockRequests, overflow, consoleErrors, hydrationErrors, initialRenderMs, refreshFailureMs, retrySuccessMs, optionalFailuresDidNotClearStock: true }));
await browser.close();
