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
