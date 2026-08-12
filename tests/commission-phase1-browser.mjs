import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.COMMISSION_TEST_BASE_URL || "http://127.0.0.1:3010";
const artifactDir = path.resolve("artifacts/commission-phase1");
await mkdir(artifactDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];

try {
  for (const width of [360, 390, 430, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 1000 } });
    await context.route("**/api/auth/me", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { id: "USER-PREVIEW-BIG", nickname: "บิ๊ก", role: "sales", locked: false } }) }));
    await context.route("**/api/booking-delivery?scope=all", (route) => {
      assert.equal(route.request().method(), "GET");
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ records: [
        { id: "REAL-1", bookingId: "BK-1", bookingReportId: "BR-1", salesReportId: "", plate: "กข 3001", customerName: "Customer", saleName: "บิ๊ก", isCounted: true, status: "ยอดจอง" },
        { id: "QA-1", bookingId: "BK-QA", bookingReportId: "BR-QA", salesReportId: "", plate: "QA 1", customerName: "QA", saleName: "QA", qaTestRecord: true, excludeFromMetrics: true }
      ] }) });
    });
    const page = await context.newPage();
    const errors = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${baseUrl}/commission`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "ค่าคอมเดือนนี้" }).waitFor();
    assert.equal(await page.getByText("PREVIEW · ไม่บันทึกข้อมูลจริง", { exact: true }).count(), 1);
    assert.equal(await page.getByText("รายการค่าคอมรายคัน", { exact: true }).count(), 1);
    assert.equal(await page.getByText("ปิดยอดเดือน กรกฎาคม 2569", { exact: true }).count(), 1);
    assert.equal(await page.getByText("ความพร้อมข้อมูลจริง", { exact: true }).count(), 1);
    const dimensions = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    assert.ok(dimensions.scrollWidth <= dimensions.clientWidth, `overflow at ${width}: ${dimensions.scrollWidth}/${dimensions.clientWidth}`);
    assert.deepEqual(errors.filter((message) => /hydration|did not match|server-rendered html/i.test(message)), []);
    results.push({ width, ...dimensions, hydrationErrors: 0 });
    if (width === 390) await page.screenshot({ path: path.join(artifactDir, "commission-mobile-390.png"), fullPage: true });
    if (width === 1440) await page.screenshot({ path: path.join(artifactDir, "commission-desktop-1440.png"), fullPage: true });
    await context.close();
  }
  process.stdout.write(`${JSON.stringify(results)}\n`);
} finally {
  await browser.close();
}
