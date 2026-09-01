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
      assert.equal(
        await page.getByRole("button", { name: "84 งวด", exact: true }).getAttribute("aria-pressed"),
        "true",
        "84 months must be selected by default"
      );
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
      const bodyRows = await page.getByTestId("calculator-values-table").locator("tbody tr").evaluateAll((rows) =>
        rows.map((row) => Array.from(row.querySelectorAll("td"), (cell) => cell.textContent?.trim() || ""))
      );
      const debugResult = await page.getByLabel("ตัวอย่างรูปค่างวด BIG CAR").evaluate((canvas, bodyRows) => {
        const debug = document.createElement("canvas");
        debug.width = canvas.width;
        debug.height = canvas.height;
        const ctx = debug.getContext("2d");
        ctx.drawImage(canvas, 0, 0);
        const widths = [120, 160, 160, 136, 136, 136, 136];
        let left = 48;
        const centers = widths.map((cellWidth) => {
          const center = left + cellWidth / 2;
          left += cellWidth;
          return center;
        });
        ctx.strokeStyle = "rgba(0,229,255,0.8)";
        ctx.lineWidth = 1;
        centers.forEach((centerX) => {
          ctx.beginPath();
          ctx.moveTo(centerX + 0.5, 538);
          ctx.lineTo(centerX + 0.5, 1204);
          ctx.stroke();
        });
        let maxHorizontalError = 0;
        let maxVerticalError = 0;
        let markerCount = 0;
        const markVisibleCenter = (columnIndex, text, centerY, font) => {
          ctx.font = font;
          const metrics = ctx.measureText(text);
          const leftBound = Number.isFinite(metrics.actualBoundingBoxLeft) ? metrics.actualBoundingBoxLeft : 0;
          const rightBound = Number.isFinite(metrics.actualBoundingBoxRight) ? metrics.actualBoundingBoxRight : metrics.width;
          const ascent = Number.isFinite(metrics.actualBoundingBoxAscent) ? metrics.actualBoundingBoxAscent : 0;
          const descent = Number.isFinite(metrics.actualBoundingBoxDescent) ? metrics.actualBoundingBoxDescent : 0;
          const originX = centers[columnIndex] - (rightBound - leftBound) / 2;
          const originY = centerY + (ascent - descent) / 2;
          const glyphCenterX = ((originX - leftBound) + (originX + rightBound)) / 2;
          const glyphCenterY = ((originY - ascent) + (originY + descent)) / 2;
          maxHorizontalError = Math.max(maxHorizontalError, Math.abs(glyphCenterX - centers[columnIndex]));
          maxVerticalError = Math.max(maxVerticalError, Math.abs(glyphCenterY - centerY));
          ctx.fillStyle = "#ff304f";
          ctx.beginPath();
          ctx.arc(glyphCenterX, glyphCenterY, 3, 0, Math.PI * 2);
          ctx.fill();
          markerCount += 1;
        };
        ["ดาวน์", "เงินดาวน์", "ยอดจัด"].forEach((text, index) => markVisibleCenter(index, text, 574, "700 16px Arial"));
        ["48 งวด", "60 งวด", "72 งวด", "84 งวด"].forEach((text, index) => markVisibleCenter(index + 3, text, 564, "700 16px Arial"));
        ["ดอก 2.79%", "ดอก 3.09%", "ดอก 3.99%", "ดอก 4.49%"].forEach((text, index) =>
          markVisibleCenter(index + 3, text, 588, "700 13px Arial")
        );
        bodyRows.forEach((row, rowIndex) => {
          row.forEach((text, columnIndex) => markVisibleCenter(columnIndex, text, 637 + rowIndex * 54, "700 16px Arial"));
        });
        return { png: debug.toDataURL("image/png"), maxHorizontalError, maxVerticalError, markerCount };
      }, bodyRows);
      assert.ok(debugResult.maxHorizontalError < 1e-6, `debug glyph X error ${debugResult.maxHorizontalError}`);
      assert.ok(debugResult.maxVerticalError < 1e-6, `debug glyph Y error ${debugResult.maxVerticalError}`);
      assert.equal(debugResult.markerCount, 88, "every header, rate, and body cell must have a glyph-center marker");
      await writeFile(
        path.join(artifactDir, "calculator-grid-debug-centers.png"),
        Buffer.from(debugResult.png.split(",")[1], "base64")
      );
    }
    await page.close();
  }
  assert.deepEqual(errors, [], `console/hydration errors: ${errors.join(" | ")}`);
  process.stdout.write(`${JSON.stringify({ results, errors, networkWarnings })}\n`);
} finally {
  await browser.close();
}
