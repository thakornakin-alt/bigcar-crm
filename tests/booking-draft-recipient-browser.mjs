import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL || "http://localhost:3100";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
page.on("pageerror", (error) => errors.push(error.message));
await page.route("**/api/line/groups", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ groups: [] }) }));

try {
  await page.goto(`${baseUrl}/booking-reports`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("bigcar-booking-email"));
  await page.reload({ waitUntil: "networkidle" });
  assert(await page.getByLabel("To", { exact: true }).inputValue() === "RDDUsedcarBooked@segroup.co.th", "default To");
  assert(await page.getByLabel("CC", { exact: true }).inputValue() === "rongsarit.s@tgh.co.th", "default CC");
  assert(await page.getByLabel("BCC", { exact: true }).inputValue() === "", "default BCC");

  await page.evaluate(() => localStorage.setItem("bigcar-booking-email", JSON.stringify({
    emailTo: "Thakornakin@gmail.com",
    emailCc: "team@example.com",
    emailBcc: "audit@example.com"
  })));
  await page.reload({ waitUntil: "networkidle" });
  assert(await page.getByLabel("To", { exact: true }).inputValue() === "Thakornakin@gmail.com", "saved To survives reload");
  assert(await page.getByLabel("CC", { exact: true }).inputValue() === "team@example.com", "saved CC survives reload");
  assert(await page.getByLabel("BCC", { exact: true }).inputValue() === "audit@example.com", "saved BCC survives reload");
  const layout = await page.evaluate(() => ({ viewport: innerWidth, root: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  assert(layout.root <= layout.viewport && layout.body <= layout.viewport, `no 390px overflow: ${JSON.stringify(layout)}`);
  assert(errors.length === 0, `no console errors: ${errors.join(" | ")}`);
  console.log(JSON.stringify({ layout, errors, savedTo: await page.getByLabel("To", { exact: true }).inputValue() }));
} finally {
  await browser.close();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
