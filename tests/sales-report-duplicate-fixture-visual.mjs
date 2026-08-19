import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3017";
const outputDir = path.resolve("artifacts/sales-report-duplicate-fixture");
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [360, 390, 430, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 1000 } });
    const page = await context.newPage();
    const errors = [];
    const realCreateRequests = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => { if (request.method() === "POST" && request.url().includes("/api/sales-reports")) realCreateRequests.push(request.url()); });
    await page.route("**/api/profile", (route) => route.fulfill({ json: { user: null } }));
    await page.route("**/api/line/groups", (route) => route.fulfill({ json: { groups: [] } }));
    await page.goto(`${baseUrl}/sales-reports?duplicateFixture=1`, { waitUntil: "networkidle" });
    await page.getByTestId("fixture-check-duplicate").click();
    await page.getByTestId("duplicate-dialog").waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.equal(overflow, 0, `${width}px must not overflow`);
    assert.equal(errors.length, 0, `${width}px browser errors: ${errors.join(" | ")}`);
    assert.equal(realCreateRequests.length, 0, `${width}px fixture must not POST Sales Report`);
    if (width === 390) await page.screenshot({ path: path.join(outputDir, "duplicate-dialog-390.png"), fullPage: true });
    await page.getByTestId("duplicate-view-existing").click();
    await page.getByTestId("fixture-existing-report").waitFor();
    assert.match(await page.getByTestId("fixture-existing-report").innerText(), /SR-FIXTURE-20260801-001/);
    await page.getByTestId("fixture-check-duplicate").click();
    await page.getByTestId("duplicate-cancel").click();
    assert.equal(realCreateRequests.length, 0, `${width}px cancel must create nothing`);
    await page.getByTestId("fixture-check-duplicate").click();
    await page.getByTestId("duplicate-create-new").click();
    await page.getByTestId("fixture-new-draft").waitFor();
    await page.getByTestId("fixture-draft-save").click();
    await page.getByTestId("duplicate-dialog").waitFor();
    assert.equal(realCreateRequests.length, 0, `${width}px fixture confirmation must not POST Sales Report`);
    if (width === 390) {
      await page.getByTestId("duplicate-cancel").click();
      await page.screenshot({ path: path.join(outputDir, "create-new-draft-390.png"), fullPage: true });
    }
    results.push({ width, overflow, errors: errors.length, realCreateRequests: realCreateRequests.length });
    await context.close();
  }
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
