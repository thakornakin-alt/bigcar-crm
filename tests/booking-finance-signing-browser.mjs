import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL || "http://localhost:3100";
const browser = await chromium.launch({ headless: true });

try {
  for (const width of [360, 390, 430]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/line/groups", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ groups: [] }) }));
    await page.route("**/api/stock/lookup**", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ vehicle: { plate: "กก 1234", brand: "TOYOTA", model: "CAMRY", year: "2024", color: "ดำ", salePrice: "389000", source: "", ownership: "", project: "", campaign: "" } })
    }));

    const response = await page.goto(`${baseUrl}/booking-reports`, { waitUntil: "networkidle" });
    assert(response?.ok(), `page status at ${width}px`);
    await page.getByRole("button", { name: "ซื้อสด", exact: true }).click();
    assert(await page.getByText("ข้อมูลส่งงานเซ็นไฟแนนซ์", { exact: true }).count() === 0, "cash hides finance fields");
    assert(await page.getByText("Preview ส่งงานเซ็นไฟแนนซ์", { exact: true }).count() === 0, "cash hides finance preview");

    await page.getByRole("button", { name: "ไฟแนนซ์", exact: true }).click();
    await page.getByLabel("ทะเบียนรถ").fill("กก 1234");
    await page.waitForTimeout(700);
    for (const label of ["ไฟแนนซ์", "สถานที่นัดเซ็น", "อาชีพ", "อายุงาน", "รายได้", "เงินดาวน์", "ยอดจัด (ก่อน VAT)"]) {
      assert(await page.getByLabel(label, { exact: true }).count() === 1, `${label} visible at ${width}px`);
    }
    assert(await page.getByRole("combobox", { name: "ลูกค้ามีเครดิตหรือไม่", exact: true }).count() === 1, `credit selector visible at ${width}px`);
    await page.getByLabel("เงินดาวน์", { exact: true }).fill("50000");
    assert((await page.getByLabel("ยอดจัด (ก่อน VAT)", { exact: true }).inputValue()) === "339,000", "finance amount uses Stock price");
    assert(await page.getByText("Preview ส่งงานเซ็นไฟแนนซ์", { exact: true }).count() === 1, "finance preview visible");
    const layout = await page.evaluate(() => ({ viewport: innerWidth, root: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
    assert(layout.root <= width && layout.body <= width, `no horizontal overflow at ${width}px: ${JSON.stringify(layout)}`);
    assert(errors.length === 0, `no console errors at ${width}px: ${errors.join(" | ")}`);
    console.log(JSON.stringify({ width, layout, errors }));
    await page.close();
  }
} finally {
  await browser.close();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
