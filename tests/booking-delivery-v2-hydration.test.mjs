import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";

const baseUrl = process.env.HYDRATION_TEST_BASE_URL;

test("/booking-delivery-v2 hydrates without console errors in a fresh context", { skip: !baseUrl }, async () => {
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      const RealDate = Date;
      const offset = 60 * 60 * 1000;

      class ShiftedDate extends RealDate {
        constructor(...args) {
          super(...(args.length ? args : [RealDate.now() + offset]));
        }

        static now() {
          return RealDate.now() + offset;
        }
      }

      globalThis.Date = ShiftedDate;
    });

    const page = await context.newPage();
    const hydrationErrors = [];
    const isHydrationError = (message) => /hydration|hydrating|server-rendered html|text content did not match/i.test(message);

    page.on("console", (message) => {
      if (message.type() === "error" && isHydrationError(message.text())) {
        hydrationErrors.push(message.text());
      }
    });
    page.on("pageerror", (error) => {
      const message = error.stack || error.message;
      if (isHydrationError(message)) hydrationErrors.push(message);
    });

    await page.goto(`${baseUrl}/booking-delivery-v2`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1_000);

    assert.deepEqual(hydrationErrors, []);
    await context.close();
  } finally {
    await browser.close();
  }
});
