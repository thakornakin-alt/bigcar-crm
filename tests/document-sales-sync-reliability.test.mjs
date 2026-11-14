import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("report history API surfaces upstream failure instead of a successful empty list", async () => {
  const source = await readFile(new URL("../app/api/reports/history/route.ts", import.meta.url), "utf8");
  assert.match(source, /catch \(error\)[\s\S]*?\{ reports: \[\], error:[\s\S]*?\{ status: 502 \}/);
});

test("document sales selector allows refresh and does not hide load failures", async () => {
  const source = await readFile(new URL("../components/documents/DocumentGeneratorV2.tsx", import.meta.url), "utf8");
  assert.match(source, /setReportListError\(`โหลดรายการขายไม่สำเร็จ:/);
  assert.match(source, /รีเฟรชรายการขาย/);
  assert.match(source, /role="alert"[^\n]*reportListError/);
});

test("document sales search reaches server for records outside the latest 80", async () => {
  const source = await readFile(new URL("../components/documents/DocumentGeneratorV2.tsx", import.meta.url), "utf8");
  assert.match(source, /\/api\/reports\/history\?type=sales&q=\$\{encodeURIComponent\(query\)\}/);
  assert.match(source, /knownIds = new Set/);
  assert.match(source, /controller\.abort\(\)/);
});

test("the create-documents tab refreshes reports when opened", async () => {
  const [page, generator] = await Promise.all([
    readFile(new URL("../app/documents/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/documents/DocumentGeneratorV2.tsx", import.meta.url), "utf8")
  ]);
  assert.match(page, /<DocumentGeneratorV2 isActive=/);
  assert.match(generator, /if \(!isActive \|\| overrideState === "dirty"\) return;/);
  assert.match(generator, /void loadReports\(\);/);
});
