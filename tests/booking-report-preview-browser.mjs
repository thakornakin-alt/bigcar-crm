import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await page.route("**/api/line/groups", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ groups: [] }) }));
const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(error.message));

try {
  const response = await page.goto(`${baseUrl}/booking-reports`, { waitUntil: "networkidle" });
  if (!response?.ok()) throw new Error(`/booking-reports returned ${response?.status()}`);
  const preview = page.locator("pre");
  const text = await preview.textContent();
  if (!text?.startsWith("รายงานการจอง")) throw new Error("Preview title/order is incorrect");
  for (const required of ["วันที่จอง :", "*เงื่อนไข*", "Sale ", "ที่อยู่จัดส่งเอกสาร"]) {
    if (!text.includes(required)) throw new Error(`Preview missing ${required}`);
  }
  for (const removed of ["ข้อมูลเซลล์", "LINE ID :", "สาขา :", "ทีม/ตำแหน่ง :"]) {
    if (text.includes(removed)) throw new Error(`Preview retained ${removed}`);
  }
  const layout = await page.evaluate(() => ({ viewport: innerWidth, rootWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth }));
  if (layout.rootWidth > layout.viewport || layout.bodyWidth > layout.viewport) throw new Error(`horizontal overflow ${JSON.stringify(layout)}`);
  if (consoleErrors.length) throw new Error(`console errors: ${consoleErrors.join(" | ")}`);
  console.log(JSON.stringify({ route: "/booking-reports", layout, consoleErrors }));
} finally {
  await browser.close();
}
