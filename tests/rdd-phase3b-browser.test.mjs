import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";

const baseUrl = process.env.RDD_PHASE3B_TEST_BASE_URL;
const cashRecord = {
  id: "CASE-3B", bookingId: "BK-3B", plate: "กข 5678", customerName: "ลูกค้าจำลอง",
  status: "ยอดจอง", workflowStatus: "รอส่งมอบ", purchaseType: "cash", caseStatus: "waiting_delivery",
  deliveryLocation: "โกดังบางนา", financeCaseNote: "", saleName: "ฝ่ายขาย", ownerUserId: "sales-1",
  bookingDate: "2026-08-01", createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z"
};
const qaRecord = { ...cashRecord, id: "CASE-QA-3B", bookingId: "BK-QA-3B", plate: "QA 3B", qaTestRecord: true, excludeFromMetrics: true };

async function contextFor(browser, width) {
  const context = await browser.newContext({ viewport: { width, height: width < 800 ? 844 : 1000 } });
  await context.route("**/api/auth/me", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { id: "sales-1", nickname: "ฝ่ายขาย", role: "sales", locked: false } }) }));
  await context.route("**/api/booking-delivery?scope=all", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ records: [cashRecord, qaRecord], revision: "rev-3b" }) }));
  return context;
}

for (const width of [360, 390, 430, 768, 1440]) {
  test(`Phase 3B controls remain responsive at ${width}px`, { skip: !baseUrl }, async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await contextFor(browser, width);
    const page = await context.newPage();
    const errors = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto(`${baseUrl}/booking-delivery-workspace`, { waitUntil: "networkidle" });
      const target = width >= 1024 ? page.getByRole("row", { name: /กข 5678/ }) : page.getByRole("button", { name: /กข 5678/ });
      await target.click();
      await page.getByTestId("workspace-edit-button").click();
      await page.getByTestId("purchase-type-select").selectOption("finance");
      assert.equal(await page.getByTestId("workflow-validation-error").count(), 1);
      assert.equal(await page.getByRole("button", { name: "บันทึก", exact: true }).isDisabled(), true);
      await page.getByTestId("case-status-select").selectOption("approved_waiting_delivery");
      await page.getByLabel("วันนัดส่งมอบ").fill("2026-08-18");
      await page.getByLabel("เวลานัดส่งมอบ").fill("15:30");
      await page.getByLabel("สถานที่ส่งมอบ").selectOption("นอกสถานที่");
      await page.getByLabel("รายละเอียดนอกสถานที่").fill("บ้านลูกค้า");
      assert.equal(await page.getByRole("button", { name: "บันทึก", exact: true }).isEnabled(), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
      assert.deepEqual(errors.filter((message) => /hydration|server-rendered html|text content did not match/i.test(message)), []);
    } finally { await context.close(); await browser.close(); }
  });
}

test("Phase 3B save is one atomic fixture request and preserves CAS", { skip: !baseUrl }, async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await contextFor(browser, 390);
  let requestBody;
  await context.route("**/api/booking-delivery-workspace", async (route) => {
    requestBody = route.request().postDataJSON();
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      record: { ...cashRecord, ...requestBody.changes }, revision: "rev-next", activityEventId: "ACT-3B"
    }) });
  });
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/booking-delivery-workspace`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /กข 5678/ }).click();
    await page.getByTestId("workspace-edit-button").click();
    await page.getByTestId("purchase-type-select").selectOption("finance");
    await page.getByTestId("case-status-select").selectOption("waiting_finance_result");
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "บันทึกแล้ว" }).waitFor();
    assert.equal(requestBody.expectedRevision, "rev-3b");
    assert.deepEqual(requestBody.changes, { purchaseType: "finance", caseStatus: "waiting_finance_result" });
  } finally { await context.close(); await browser.close(); }
});

test("Phase 3C unknown prep stays unset and unrelated save sends only the dirty field", { skip: !baseUrl }, async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await contextFor(browser, 390);
  let requestBody;
  let writeCount = 0;
  await context.route("**/api/booking-delivery-workspace", async (route) => {
    writeCount += 1;
    requestBody = route.request().postDataJSON();
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ record: { ...cashRecord, ...requestBody.changes }, revision: "rev-next" }) });
  });
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/booking-delivery-workspace`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /กข 5678/ }).click();
    await page.getByTestId("workspace-edit-button").click();
    for (const field of ["washStatus", "stickerStatus", "oilStatus", "batteryStatus", "taxStatus", "insuranceStatus"]) {
      assert.equal(await page.getByTestId(`prep-${field}`).inputValue(), "");
      assert.equal(await page.getByTestId(`prep-${field}`).locator("option:checked").textContent(), "ยังไม่ระบุ");
    }
    assert.equal(await page.getByText("หมายเหตุไฟแนนซ์", { exact: true }).count(), 0);
    assert.equal(await page.getByLabel("หมายเหตุ", { exact: true }).count(), 1);
    assert.ok((await page.getByTestId("workspace-note-textarea").boundingBox()).height <= 100);
    const dateBox = await page.locator('input[aria-label="วันนัดส่งมอบ"]').boundingBox();
    const timeBox = await page.locator('input[aria-label="เวลานัดส่งมอบ"]').boundingBox();
    assert.ok(timeBox.x - (dateBox.x + dateBox.width) >= 8);
    if (process.env.PHASE3C_REVIEW_SCREENSHOT) {
      await page.getByTestId("prep-status-controls").scrollIntoViewIfNeeded();
      await page.screenshot({ path: process.env.PHASE3C_REVIEW_SCREENSHOT });
    }
    await page.getByLabel("วันนัดส่งมอบ").fill("2026-08-19");
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "บันทึกแล้ว" }).waitFor();
    assert.deepEqual(requestBody.changes, { deliveryDate: "2026-08-19" });
    assert.equal(writeCount, 1);
  } finally { await context.close(); await browser.close(); }
});

test("Phase 3C explicit prep decision persists while Cancel performs no write", { skip: !baseUrl }, async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await contextFor(browser, 390);
  let requestBody;
  let writeCount = 0;
  await context.route("**/api/booking-delivery-workspace", async (route) => {
    writeCount += 1;
    requestBody = route.request().postDataJSON();
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ record: { ...cashRecord, ...requestBody.changes }, revision: "rev-next" }) });
  });
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/booking-delivery-workspace`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /กข 5678/ }).click();
    await page.getByTestId("workspace-edit-button").click();
    await page.getByTestId("prep-oilStatus").selectOption("no_change");
    await page.getByTestId("prep-batteryStatus").selectOption("good");
    await page.getByRole("button", { name: "ยกเลิก", exact: true }).click();
    assert.equal(writeCount, 0);
    await page.getByTestId("workspace-edit-button").click();
    await page.getByTestId("prep-oilStatus").selectOption("no_change");
    await page.getByTestId("prep-batteryStatus").selectOption("good");
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "บันทึกแล้ว" }).waitFor();
    assert.deepEqual(requestBody.changes, { oilStatus: "no_change", batteryStatus: "good" });
  } finally { await context.close(); await browser.close(); }
});
