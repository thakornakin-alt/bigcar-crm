import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";

const baseUrl = process.env.BOOKING_DELIVERY_TEST_BASE_URL;

const records = [
  {
    id: "mobile-detail-1",
    bookingId: "BK-MOBILE-1",
    customerName: "Mobile Test One",
    plate: "TEST 0001",
    status: "ยอดจอง",
    workflowStatus: "ยอดจอง",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z"
  },
  {
    id: "mobile-detail-2",
    bookingId: "BK-MOBILE-2",
    customerName: "Mobile Test Two",
    plate: "TEST 0002",
    status: "ยอดจอง",
    workflowStatus: "ยอดจอง",
    createdAt: "2026-08-02T00:00:00.000Z",
    updatedAt: "2026-08-02T00:00:00.000Z"
  }
];

async function openPage(browser, width) {
  const context = await browser.newContext({ viewport: { width, height: 844 } });
  const page = await context.newPage();
  await page.route("**/api/booking-delivery**", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ records }) });
    }
    return route.abort();
  });
  await page.goto(`${baseUrl}/booking-delivery`, { waitUntil: "networkidle" });
  return { context, page };
}

for (const width of [360, 390]) {
  test(`mobile detail closes and reopens cleanly at ${width}px`, { skip: !baseUrl }, async () => {
    const browser = await chromium.launch({ headless: true });
    const { context, page } = await openPage(browser, width);

    try {
      assert.equal(await page.getByTestId("booking-delivery-mobile-overlay").count(), 0);
      await page.getByRole("button", { name: /TEST 0001/ }).click();
      assert.equal(await page.getByTestId("booking-delivery-mobile-overlay").count(), 1);

      await page.getByRole("button", { name: "ปิดรายละเอียด" }).last().click();
      assert.equal(await page.getByTestId("booking-delivery-mobile-overlay").count(), 0);
      assert.notEqual(await page.evaluate(() => document.body.style.overflow), "hidden");

      await page.getByRole("button", { name: /TEST 0002/ }).click();
      assert.equal(await page.getByText("Mobile Test Two", { exact: true }).count(), 2);
      await page.getByTestId("booking-delivery-detail-panel").getByRole("button", { name: "ยกเลิก", exact: true }).click();
      assert.equal(await page.getByTestId("booking-delivery-mobile-overlay").count(), 0);
      assert.notEqual(await page.evaluate(() => document.body.style.overflow), "hidden");
    } finally {
      await context.close();
      await browser.close();
    }
  });
}

test("desktop detail remains visible without a mobile overlay", { skip: !baseUrl }, async () => {
  const browser = await chromium.launch({ headless: true });
  const { context, page } = await openPage(browser, 1440);

  try {
    assert.equal(await page.getByText("รายละเอียดงาน", { exact: true }).count(), 1);
    assert.equal(await page.getByTestId("booking-delivery-mobile-overlay").count(), 0);
  } finally {
    await context.close();
    await browser.close();
  }
});
