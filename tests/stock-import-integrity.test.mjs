import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const importPage = await readFile(new URL("../app/stock-import/page.tsx", import.meta.url), "utf8");
const importApi = await readFile(new URL("../app/api/stock/import/route.ts", import.meta.url), "utf8");
const statusApi = await readFile(new URL("../app/api/stock/status/route.ts", import.meta.url), "utf8");
const staging = await readFile(new URL("../lib/stock-staging.ts", import.meta.url), "utf8");

test("manual stock import sends one complete batch and caps it explicitly", () => {
  assert.doesNotMatch(importPage, /chunkSize|for \(let start = 0; start < parsedRows\.length/);
  assert.match(importPage, /const maxImportRows = 1000/);
  assert.match(importPage, /rows: parsedRows/);
});

test("stock import rejects duplicates and verifies the persisted destination total", () => {
  assert.match(importApi, /uniqueStockPlateCount/);
  assert.match(importApi, /getStockImportStatus/);
  assert.match(importApi, /integrity\.status !== "complete"/);
  assert.match(importApi, /status: 409/);
});

test("staging confirmation uses the same destination verification", () => {
  assert.match(staging, /beginStockImportIntegrity/);
  assert.match(staging, /getStockImportStatus/);
  assert.match(staging, /finishStockImportIntegrity/);
});

test("stock status endpoint reports upstream failure instead of a fake zero total", () => {
  assert.doesNotMatch(statusApi, /total: 0/);
  assert.match(statusApi, /status: 503/);
  assert.match(importPage, /โหลดไม่สำเร็จ/);
});

test("staging recognizes YYYY_MM_DD filenames before the legacy day-first format", () => {
  assert.match(staging, /isoMatch/);
  assert.match(staging, /return `\$\{year\}-\$\{month\}-\$\{day\}`/);
});
