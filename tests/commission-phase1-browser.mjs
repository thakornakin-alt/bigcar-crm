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
    const isolatedView = { mode: "isolated_fixture", realWritesEnabled: false, pendingClosingCount: 2, snapshots: [{ id: "ISO-SNAP-1", bookingCaseId: "ISO-1" }], activity: [], canonicalDataVerified: false, candidateReadiness: {
      counts: { ready: 1, needsReview: 1, excluded: 1, blocked: 1 },
      candidates: [
        { bookingCaseId: "CANON-READY", vehiclePlate: "PREVIEW 2001", salespersonDisplayName: "เซลส์ตัวอย่าง", caseStatus: "delivered", quality: "READY", recognitionState: "eligible_for_recognition", needsReviewReasons: [], sourceTrace: { salespersonUserIdSource: { kind: "booking_delivery", reference: "salespersonUserId" }, commissionGroupSource: { kind: "booking_list", reference: "bookingCaseId" }, standardPriceSource: { kind: "booking_delivery", reference: "salePrice" }, salePriceSource: { kind: "booking_delivery", reference: "finalPrice" }, discountSource: { kind: "derived", reference: "standardPrice-salePrice" } } },
        { bookingCaseId: "CANON-REVIEW", vehiclePlate: "PREVIEW 2002", caseStatus: "waiting_delivery", quality: "NEEDS_REVIEW", recognitionState: "needs_review", needsReviewReasons: ["missing_salesperson_identity", "missing_commission_group"], sourceTrace: { salespersonUserIdSource: { kind: "unresolved" }, commissionGroupSource: { kind: "unresolved" }, standardPriceSource: { kind: "booking_delivery", reference: "salePrice" }, salePriceSource: { kind: "booking_delivery", reference: "finalPrice" }, discountSource: { kind: "derived", reference: "standardPrice-salePrice" } } },
        { bookingCaseId: "CANON-EXCLUDED", vehiclePlate: "PREVIEW QA", caseStatus: "waiting_delivery", quality: "EXCLUDED", recognitionState: "recognition_blocked", needsReviewReasons: ["qa_excluded"], sourceTrace: { salespersonUserIdSource: { kind: "unresolved" }, commissionGroupSource: { kind: "unresolved" }, standardPriceSource: { kind: "unresolved" }, salePriceSource: { kind: "unresolved" }, discountSource: { kind: "unresolved" } } },
        { bookingCaseId: "CANON-BLOCKED", vehiclePlate: "PREVIEW CANCEL", caseStatus: "cancelled", quality: "BLOCKED", recognitionState: "recognition_blocked", needsReviewReasons: ["cancelled_but_counted"], sourceTrace: { salespersonUserIdSource: { kind: "booking_delivery", reference: "salespersonUserId" }, commissionGroupSource: { kind: "booking_delivery", reference: "commissionGroup" }, standardPriceSource: { kind: "booking_delivery", reference: "salePrice" }, salePriceSource: { kind: "booking_delivery", reference: "finalPrice" }, discountSource: { kind: "derived", reference: "standardPrice-salePrice" } } }
      ]
    }, cases: [
      { bookingCaseId: "ISO-1", sourceMonth: "2026-07", vehiclePlate: "PREVIEW 1001", caseStatus: "delivered", discountAmount: 0, commissionGroup: "G1", assessment: { state: "eligible_for_recognition", reasons: [] } },
      { bookingCaseId: "ISO-2", sourceMonth: "2026-07", vehiclePlate: "PREVIEW 1002", caseStatus: "waiting_delivery", discountAmount: 8000, commissionGroup: "G2", assessment: { state: "working", reasons: ["not_delivered_or_cutoff"] } },
      { bookingCaseId: "ISO-3", sourceMonth: "2026-07", vehiclePlate: "PREVIEW 1003", caseStatus: "cancelled", discountAmount: 0, commissionGroup: "G1", assessment: { state: "recognition_blocked", reasons: ["cancelled"] } }
    ] };
    await context.route("**/api/commission-preview", (route) => {
      assert.ok(["GET", "POST"].includes(route.request().method()));
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(route.request().method() === "GET" ? isolatedView : { result: {}, view: isolatedView }) });
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
    assert.equal(await page.getByText("สถานะ fixture", { exact: true }).count(), 1);
    assert.equal(await page.getByRole("heading", { name: "ความพร้อมข้อมูลค่าคอม" }).count(), 1);
    assert.equal(await page.getByText("CODE READY · REAL DATA PENDING", { exact: true }).count(), 1);
    await page.getByRole("button", { name: "ต้องตรวจสอบ", exact: true }).click();
    assert.equal(await page.getByText("PREVIEW 2002", { exact: true }).count(), 1);
    assert.equal(await page.getByText("PREVIEW 2001", { exact: true }).count(), 0);
    await page.getByRole("button", { name: "ทั้งหมด", exact: true }).click();
    assert.equal(await page.getByText("COMMISSION_REAL_WRITES_ENABLED=false", { exact: false }).count(), 1);
    await page.getByText("Manual Adjustment · Admin fixture", { exact: true }).waitFor();
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
