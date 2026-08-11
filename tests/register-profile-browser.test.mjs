import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.PROFILE_TEST_BASE_URL;
const profile = {
  id: "USER-PROFILE-FIXTURE", createdAt: "", updatedAt: "", email: "big@example.com",
  firstName: "ฐากร", lastName: "กาญจนอังกูร", nickname: "บิ๊ก", phone: "0917785117",
  lineId: "@big", lineQrUrl: "", avatarUrl: "", position: "Sales", branch: "บางนา",
  role: "admin", locked: false
};

async function fixtureContext(browser, width) {
  const context = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 1000 } });
  await context.route("**/api/auth/me", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: profile }) }));
  return context;
}

for (const width of [360, 390, 430, 768, 1440]) {
  test(`Register and Profile remain responsive at ${width}px`, { skip: !baseUrl }, async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await fixtureContext(browser, width);
    const page = await context.newPage();
    const errors = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto(`${baseUrl}/auth`, { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Register", exact: true }).click();
      for (const label of ["รูปโปรไฟล์", "ชื่อจริง", "นามสกุล", "ชื่อเล่น", "เบอร์โทร", "Email", "Password", "ยืนยันรหัสผ่าน"]) {
        assert.ok(await page.getByText(label, { exact: false }).count());
      }
      assert.equal(await page.locator('[name="role"], [name="position"], [name="branch"]').count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
      if (width === 390 && process.env.PROFILE_SCREENSHOT_DIR) {
        await fs.mkdir(process.env.PROFILE_SCREENSHOT_DIR, { recursive: true });
        await page.screenshot({ path: path.join(process.env.PROFILE_SCREENSHOT_DIR, "register-390.png"), fullPage: true });
      }

      await page.goto(`${baseUrl}/profile`, { waitUntil: "networkidle" });
      assert.equal(await page.getByTestId("global-user-profile").getByText("บิ๊ก", { exact: true }).count(), 1);
      assert.equal(await page.getByLabel("อักษรย่อผู้ใช้งาน").count(), 1);
      assert.equal(await page.locator('[style*="logo-rdd"]').count(), 0);
      assert.equal(await page.getByText("Email:", { exact: false }).count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
      if (width === 390 && process.env.PROFILE_SCREENSHOT_DIR) {
        await page.screenshot({ path: path.join(process.env.PROFILE_SCREENSHOT_DIR, "profile-390.png"), fullPage: true });
      }
      assert.deepEqual(errors.filter((message) => /hydration|server-rendered html|text content did not match/i.test(message)), []);
    } finally {
      await context.close();
      await browser.close();
    }
  });
}

test("Profile save sends only self-editable identity fields and preserves phone", { skip: !baseUrl }, async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await fixtureContext(browser, 390);
  let payload;
  await context.route("**/api/profile", async (route) => {
    payload = route.request().postDataJSON();
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { ...profile, ...payload } }) });
  });
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/profile`, { waitUntil: "networkidle" });
    await page.getByLabel("ชื่อเล่น").fill("บิ๊กใหม่");
    await page.getByLabel("เบอร์โทร").fill("0990000001");
    await page.getByRole("button", { name: "บันทึกโปรไฟล์" }).click();
    await page.getByText("บันทึกโปรไฟล์แล้ว", { exact: false }).waitFor();
    assert.equal(payload.phone, "0990000001");
    assert.equal(payload.nickname, "บิ๊กใหม่");
    for (const field of ["role", "branch", "position", "locked", "email"]) assert.equal(field in payload, false);
  } finally {
    await context.close();
    await browser.close();
  }
});
