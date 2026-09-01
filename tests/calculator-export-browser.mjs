import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.CALCULATOR_TEST_BASE_URL || "http://127.0.0.1:3001";
const artifactDir = path.resolve("artifacts/calculator-export-redesign");
await mkdir(artifactDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const errors = [];
const networkWarnings = [];
const results = [];

try {
  for (const width of [360, 390, 430, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: width < 768 ? 844 : 1000 } });
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const detail = `${width}: ${message.text()}`;
      if (message.text().includes("Failed to load resource")) networkWarnings.push(detail);
      else errors.push(detail);
    });
    page.on("pageerror", (error) => errors.push(`${width}: ${error.message}`));
    await page.goto(`${baseUrl}/calculator`, { waitUntil: "networkidle" });
    await page.getByLabel("ตัวอย่างรูปค่างวด BIG CAR").waitFor();
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    }));
    results.push({ width, ...dimensions });
    assert.ok(
      dimensions.scrollWidth <= dimensions.clientWidth,
      `horizontal overflow at ${width}px (${dimensions.scrollWidth}/${dimensions.clientWidth})`
    );
    if (width === 390) {
      await page.getByTestId("calculator-quote-preview").screenshot({ path: path.join(artifactDir, "calculator-rough-quote-fallback.png") });
      await page.getByRole("textbox", { name: "รุ่นรถ" }).fill("TOYOTA HILUX REVO 2.4 MID AT");
      await page.getByRole("textbox", { name: "ปีรถ" }).fill("2020");
      await page.getByRole("textbox", { name: "สีรถ" }).fill("ขาว");
      await page.getByRole("textbox", { name: "เลขไมล์" }).fill("68,000 กม.");
      for (const downLabel of ["0%", "20%", "50%"]) {
        await page.getByRole("button", { name: downLabel, exact: true }).first().click();
        let tableBaseline = "";
        for (const months of [48, 60, 72, 84]) {
          await page.getByRole("button", { name: `${months} งวด`, exact: true }).click();
          await page.waitForTimeout(150);
          const tableImage = await page.getByLabel("ตัวอย่างรูปค่างวด BIG CAR").evaluate((canvas) => {
            const crop = document.createElement("canvas");
            crop.width = 984;
            crop.height = 666;
            crop.getContext("2d").drawImage(canvas, 48, 538, 984, 666, 0, 0, 984, 666);
            return crop.toDataURL("image/png");
          });
          if (!tableBaseline) tableBaseline = tableImage;
          else assert.equal(tableImage, tableBaseline, `table geometry/style changed for ${downLabel} down at ${months} months`);
        }
        const png = await page.getByLabel("ตัวอย่างรูปค่างวด BIG CAR").evaluate((canvas) => canvas.toDataURL("image/png"));
        await writeFile(
          path.join(artifactDir, `calculator-grid-down-${downLabel.replace("%", "")}.png`),
          Buffer.from(png.split(",")[1], "base64")
        );
      }
      await page.getByTestId("calculator-quote-preview").screenshot({ path: path.join(artifactDir, "calculator-fallback-no-avatar-qr.png") });
      await page.screenshot({ path: path.join(artifactDir, "calculator-preview-mobile-390-local.png"), fullPage: true });
      const png = await page.getByLabel("ตัวอย่างรูปค่างวด BIG CAR").evaluate((canvas) => canvas.toDataURL("image/png"));
      await writeFile(path.join(artifactDir, "bigcar-installment-export-fallback.png"), Buffer.from(png.split(",")[1], "base64"));
    }
    await page.close();
  }
  assert.deepEqual(errors, [], `console/hydration errors: ${errors.join(" | ")}`);
  process.stdout.write(`${JSON.stringify({ results, errors, networkWarnings })}\n`);
} finally {
  await browser.close();
}
