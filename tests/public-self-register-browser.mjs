import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(error.message));

try {
  const response = await page.goto(`${baseUrl}/register`, { waitUntil: "networkidle" });
  if (!response?.ok()) throw new Error(`/register returned ${response?.status()}`);
  for (const name of ["firstName", "lastName", "nickname", "phone", "email", "password", "confirmPassword", "avatar"]) {
    if (await page.locator(`[name="${name}"]`).count() !== 1) throw new Error(`missing field ${name}`);
  }
  if (await page.getByRole("button", { name: "สมัครสมาชิก", exact: true }).count() !== 1) throw new Error("missing registration action");
  if (await page.getByRole("link", { name: /กลับไป Login/ }).count() !== 1) throw new Error("missing Login return link");
  const layout = await page.evaluate(() => ({
    viewport: window.innerWidth,
    rootWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth
  }));
  if (layout.rootWidth > layout.viewport || layout.bodyWidth > layout.viewport) throw new Error(`horizontal overflow ${JSON.stringify(layout)}`);
  if (consoleErrors.length) throw new Error(`console errors: ${consoleErrors.join(" | ")}`);
  console.log(JSON.stringify({ route: "/register", layout, consoleErrors }));
} finally {
  await browser.close();
}
