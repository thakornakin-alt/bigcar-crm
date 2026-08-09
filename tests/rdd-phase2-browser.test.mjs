import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";

const baseUrl = process.env.RDD_PHASE2_TEST_BASE_URL;

const records = [
  {
    id: "rdd-e2e-1", bookingId: "BK-RDD-1", bookingReportId: "BR-1", salesReportId: "", bookingDate: "2026-08-02",
    plate: "กข 1234", customerName: "ลูกค้าทดสอบหนึ่ง", brand: "Toyota", model: "Camry", year: "2022", color: "ดำ",
    paymentType: "ไฟแนนซ์", workflowStatus: "รอผลไฟแนนซ์", status: "ยอดจอง", ownerUserId: "sales-1", ownerName: "ฝ่ายขาย",
    saleName: "เซลล์เดิม", deliveryDate: "2026-08-20", deliveryLocation: "สาขาหลัก", financeCaseSubmitted: true,
    financeCaseNote: "รอผล", financeAttachmentIds: [], spaFullSystemDone: true, oilChangeDone: false, decalRemovalDone: false, insuranceDone: false,
    createdAt: "2026-08-02T00:00:00.000Z", updatedAt: "2026-08-03T00:00:00.000Z"
  },
  {
    id: "rdd-e2e-2", bookingId: "BK-RDD-2", bookingReportId: "", salesReportId: "SR-2", bookingDate: undefined,
    plate: "TEST 0002", customerName: "ลูกค้าทดสอบสอง", brand: "Honda", model: "Civic", year: "2021", color: "ขาว",
    paymentType: "ซื้อสด", workflowStatus: "รอส่งมอบ", status: "ยอดจอง", saleName: "เซลล์เดิม", deliveryDate: "2026-08-21",
    financeAttachmentIds: [], spaFullSystemDone: false, oilChangeDone: false, decalRemovalDone: false, insuranceDone: false,
    createdAt: "2026-08-02T00:00:00.000Z", updatedAt: "2026-08-04T00:00:00.000Z"
  },
  {
    id: "rdd-e2e-qa", bookingId: "BK-RDD-QA", bookingReportId: "BR-QA", salesReportId: "", bookingDate: "2026-08-04",
    plate: "QA 9999", customerName: "QA FIXTURE", brand: "TEST", model: "QA", year: "2026", color: "แดง",
    paymentType: "ซื้อสด", workflowStatus: "รอส่งมอบ", status: "ยอดจอง", saleName: "QA", deliveryDate: "2026-08-22",
    financeAttachmentIds: [], spaFullSystemDone: false, oilChangeDone: false, decalRemovalDone: false, insuranceDone: false,
    qaTestRecord: true, excludeFromMetrics: true,
    createdAt: "2026-08-04T00:00:00.000Z", updatedAt: "2026-08-04T00:00:00.000Z"
  }
];

async function contextFor(browser, width) {
  const context = await browser.newContext({ viewport: { width, height: width < 800 ? 844 : 1000 } });
  await context.route("**/api/auth/me", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { id: "sales-1", nickname: "ฝ่ายขาย", role: "sales", locked: false } }) }));
  await context.route("**/api/booking-delivery?scope=all", (route) => {
    assert.equal(route.request().method(), "GET");
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ records }) });
  });
  return context;
}

for (const width of [360, 390, 430, 768, 1440]) {
  test(`Phase 2 routes render without body overflow at ${width}px`, { skip: !baseUrl }, async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await contextFor(browser, width);
    const page = await context.newPage();
    const errors = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto(`${baseUrl}/rdd-home`, { waitUntil: "networkidle" });
      assert.equal(await page.getByText("วันนี้ต้องเร่งงานไหน", { exact: true }).count(), 1);
      assert.equal(await page.getByText("ผู้ใช้งาน", { exact: true }).count(), 0);
      assert.equal(await page.getByTestId("authenticated-global-header").count(), 1);
      assert.equal(await page.getByTestId("global-user-profile").count(), 1);
      assert.equal(await page.getByTestId("global-user-initials").count(), 1);
      assert.equal(await page.getByTestId("global-crm-title").getAttribute("href"), "/rdd-home");
      assert.equal(await page.getByTestId("authenticated-global-header").locator('[style*="logo-rdd"]').count(), 0);
      const headerBox = await page.getByTestId("authenticated-global-header").boundingBox();
      const titleBox = await page.getByTestId("global-crm-title").boundingBox();
      assert.ok(Math.abs((titleBox.x + titleBox.width / 2) - (headerBox.x + headerBox.width / 2)) <= 1);
      assert.ok(await page.getByTestId("historical-data-notice").count() >= 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
      await page.goto(`${baseUrl}/booking-delivery-workspace`, { waitUntil: "networkidle" });
      assert.equal(await page.getByText("Booking Delivery Workspace", { exact: true }).count(), 1);
      assert.equal(await page.getByText("ผู้ใช้งาน", { exact: true }).count(), 0);
      assert.equal(await page.getByTestId("workspace-scope-controls").getByRole("button").count(), 3);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
      assert.deepEqual(errors.filter((message) => /hydration|server-rendered html|text content did not match/i.test(message)), []);
    } finally {
      await context.close();
      await browser.close();
    }
  });
}

test("Global CRM header preserves utilities and menu navigation", { skip: !baseUrl }, async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await contextFor(browser, 390);
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/rdd-home`, { waitUntil: "networkidle" });
    const header = page.getByTestId("authenticated-global-header");
    assert.equal(await header.getByRole("link", { name: "แจ้งเตือน" }).count(), 1);
    assert.equal(await header.getByRole("link", { name: "Settings" }).count(), 1);
    await header.getByRole("button", { name: "เปิดเมนู" }).click();
    assert.equal(await page.getByRole("link", { name: "Workspace", exact: true }).count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
  } finally {
    await context.close();
    await browser.close();
  }
});

for (const width of [360, 390, 430]) {
  test(`Workspace mobile chrome and vehicle cards stay compact at ${width}px`, { skip: !baseUrl }, async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await contextFor(browser, width);
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/booking-delivery-workspace`, { waitUntil: "networkidle" });
      await page.getByTestId("workspace-mobile-summary").waitFor();
      assert.ok((await page.getByTestId("workspace-header").boundingBox()).height < 330);
      assert.equal(await page.getByTestId("workspace-mobile-filters").locator(":scope > select").count(), 3);
      assert.ok((await page.getByTestId("workspace-mobile-card").first().boundingBox()).height <= 120);
      await page.getByRole("button", { name: /TEST 0002/ }).click();
      assert.ok(await page.getByTestId("workspace-empty-detail-group").count() >= 1);
      const documents = page.getByTestId("case-document-manifest");
      assert.equal(await documents.getByText("เอกสารของเคส", { exact: true }).count(), 1);
      assert.equal(await documents.getByText("รายงานขาย", { exact: true }).count(), 1);
      assert.equal(await documents.getByText("รายงานจอง", { exact: true }).count(), 1);
      assert.equal(await page.getByTestId("workspace-detail-panel").getByRole("link", { name: "เอกสาร", exact: true }).count(), 0);
      assert.ok((await documents.boundingBox()).width <= width - 24);
    } finally {
      await context.close();
      await browser.close();
    }
  });
}

test("Home historical notice remains compact and lower priority on mobile", { skip: !baseUrl }, async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await contextFor(browser, 390);
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/rdd-home`, { waitUntil: "networkidle" });
    const urgent = page.getByRole("heading", { name: "งานที่ต้องตาม" });
    const notice = page.getByTestId("historical-data-notice");
    assert.ok((await urgent.boundingBox()).y < (await notice.boundingBox()).y);
    assert.ok((await notice.boundingBox()).height <= 60);
  } finally {
    await context.close();
    await browser.close();
  }
});

for (const width of [360, 390]) {
  test(`Workspace detail closes and reopens without stale overlay at ${width}px`, { skip: !baseUrl }, async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await contextFor(browser, width);
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/booking-delivery-workspace`, { waitUntil: "networkidle" });
      await page.getByRole("button", { name: /กข 1234/ }).click();
      assert.equal(await page.getByTestId("workspace-detail-overlay").count(), 1);
      await page.getByRole("button", { name: "ปิดรายละเอียด" }).click();
      assert.equal(await page.getByTestId("workspace-detail-overlay").count(), 0);
      assert.notEqual(await page.evaluate(() => document.body.style.overflow), "hidden");
      await page.getByRole("button", { name: /TEST 0002/ }).click();
      assert.ok(await page.getByTestId("workspace-detail-panel").getByText("ลูกค้าทดสอบสอง", { exact: true }).count() >= 1);
      await page.getByTestId("workspace-detail-panel").getByRole("button", { name: "ปิด", exact: true }).click();
      assert.equal(await page.getByTestId("workspace-detail-overlay").count(), 0);
    } finally {
      await context.close();
      await browser.close();
    }
  });
}

test("Workspace desktop overlay click closes detail", { skip: !baseUrl }, async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await contextFor(browser, 1440);
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/booking-delivery-workspace`, { waitUntil: "networkidle" });
    await page.getByRole("row", { name: /กข 1234/ }).click();
    await page.getByTestId("workspace-detail-overlay").click({ position: { x: 4, y: 4 } });
    assert.equal(await page.getByTestId("workspace-detail-overlay").count(), 0);
  } finally {
    await context.close();
    await browser.close();
  }
});

test("Workspace hides QA by default and shows a TEST/QA badge only when explicitly enabled", { skip: !baseUrl }, async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await contextFor(browser, 1440);
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/booking-delivery-workspace`, { waitUntil: "networkidle" });
    assert.equal(await page.getByText("QA 9999", { exact: true }).count(), 0);
    assert.ok((await page.getByTestId("workspace-scope-controls").getByRole("button", { name: /^ทั้งหมด/ }).textContent()).includes("2"));
    await page.getByTestId("include-qa-toggle-desktop").check();
    const qaRow = page.getByRole("row", { name: /QA 9999/ });
    assert.equal(await qaRow.count(), 1);
    assert.equal(await qaRow.getByTestId("qa-record-badge").count(), 1);
  } finally {
    await context.close();
    await browser.close();
  }
});
