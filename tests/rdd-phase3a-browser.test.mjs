import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";

const baseUrl = process.env.RDD_PHASE3A_TEST_BASE_URL;
const baseRecord = { id: "CASE-EDIT", bookingId: "BK-EDIT", plate: "กข 1234", customerName: "ลูกค้าทดสอบ", status: "ยอดจอง", workflowStatus: "รอส่งมอบ", deliveryLocation: "", financeCaseNote: "เดิม", saleName: "ฝ่ายขาย", ownerUserId: "sales-1", bookingDate: "2026-08-01", createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z" };
const qaRecord = { ...baseRecord, id: "CASE-QA", bookingId: "BK-QA", plate: "QA 9999", qaTestRecord: true, excludeFromMetrics: true };

async function contextFor(browser, width, role = "sales") {
  const context = await browser.newContext({ viewport: { width, height: width < 800 ? 844 : 1000 } });
  await context.route("**/api/auth/me", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { id: "sales-1", nickname: "ฝ่ายขาย", role, locked: false } }) }));
  await context.route("**/api/booking-delivery?scope=all", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ records: [baseRecord, qaRecord], revision: "rev-1" }) }));
  return context;
}

for (const width of [360, 390, 430, 768, 1440]) {
  test(`Phase 3A edit mode remains responsive at ${width}px`, { skip: !baseUrl }, async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await contextFor(browser, width);
    const page = await context.newPage();
    const errors = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto(`${baseUrl}/booking-delivery-workspace`, { waitUntil: "networkidle" });
      const target = width >= 1024 ? page.getByRole("row", { name: /กข 1234/ }) : page.getByRole("button", { name: /กข 1234/ });
      await target.click();
      await page.getByTestId("workspace-edit-button").click();
      assert.equal(await page.getByTestId("workspace-edit-fields").count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
      assert.deepEqual(errors.filter((message) => /hydration|server-rendered html|text content did not match/i.test(message)), []);
    } finally { await context.close(); await browser.close(); }
  });
}

test("save, cancel, dirty guard and conflict UX are server-confirmed", { skip: !baseUrl }, async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await contextFor(browser, 390);
  let conflict = false;
  let patchCount = 0;
  await context.route("**/api/booking-delivery-workspace", async (route) => {
    patchCount += 1;
    const body = route.request().postDataJSON();
    assert.deepEqual(Object.keys(body.changes), ["financeCaseNote"]);
    if (conflict) return route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "ข้อมูลเคสนี้มีการเปลี่ยนแปลงจากผู้ใช้อื่น", current: { record: { ...baseRecord, financeCaseNote: "ผู้ใช้อื่นแก้แล้ว" }, revision: "rev-2" } }) });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ record: { ...baseRecord, financeCaseNote: body.changes.financeCaseNote }, revision: "rev-2", activityEventId: "ACT-1" }) });
  });
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/booking-delivery-workspace`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /กข 1234/ }).click();
    await page.getByTestId("workspace-edit-button").click();
    const note = page.getByLabel("หมายเหตุ", { exact: true });
    await note.fill("ยกเลิกก่อน");
    await page.getByRole("button", { name: "ยกเลิก", exact: true }).click();
    assert.equal(patchCount, 0);
    await page.getByTestId("workspace-edit-button").click();
    await note.fill("ยังไม่บันทึก");
    await page.getByRole("button", { name: "ปิดรายละเอียด" }).click();
    assert.equal(await page.getByTestId("workspace-dirty-confirmation").count(), 1);
    await page.getByRole("button", { name: "กลับไปแก้" }).click();
    await note.fill("บันทึกจริง");
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await page.getByTestId("workspace-detail-panel").getByText("บันทึกจริง", { exact: true }).waitFor();
    conflict = true;
    await page.getByTestId("workspace-edit-button").click();
    await note.fill("ข้อมูลชนกัน");
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    assert.equal(await page.getByTestId("workspace-load-latest").count(), 1);
    await page.getByTestId("workspace-load-latest").click();
    await page.getByTestId("workspace-detail-panel").getByText("ผู้ใช้อื่นแก้แล้ว", { exact: true }).waitFor();
  } finally { await context.close(); await browser.close(); }
});

test("QA and viewer never receive edit controls", { skip: !baseUrl }, async () => {
  const browser = await chromium.launch({ headless: true });
  const salesContext = await contextFor(browser, 390);
  const salesPage = await salesContext.newPage();
  try {
    await salesPage.goto(`${baseUrl}/booking-delivery-workspace`, { waitUntil: "networkidle" });
    await salesPage.getByText("ตัวกรอง", { exact: true }).click();
    await salesPage.getByTestId("include-qa-toggle").check();
    await salesPage.getByRole("button", { name: /QA 9999/ }).click();
    assert.equal(await salesPage.getByTestId("workspace-qa-read-only").count(), 1);
    assert.equal(await salesPage.getByTestId("workspace-edit-button").count(), 0);
  } finally { await salesContext.close(); }
  const viewerContext = await contextFor(browser, 390, "viewer");
  const viewerPage = await viewerContext.newPage();
  try {
    await viewerPage.goto(`${baseUrl}/booking-delivery-workspace`, { waitUntil: "networkidle" });
    await viewerPage.getByRole("button", { name: /กข 1234/ }).click();
    assert.equal(await viewerPage.getByTestId("workspace-edit-button").count(), 0);
  } finally { await viewerContext.close(); await browser.close(); }
});
