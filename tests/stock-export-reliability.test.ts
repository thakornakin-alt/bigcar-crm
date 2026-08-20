import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { AppsScriptError } from "../lib/apps-script.ts";
import {
  classifyStockReadError,
  readStockWithBoundedRetry,
  StockReadFailure,
  stockReadUserMessage
} from "../lib/stock/stock-read-reliability.ts";

test("transient Stock read gets exactly one bounded retry", async () => {
  let calls = 0;
  const sleeps: number[] = [];
  const result = await readStockWithBoundedRetry(async () => {
    calls += 1;
    if (calls === 1) throw new AppsScriptError("timeout", "timed out");
    return { vehicles: [{ plate: "1กก 1234" }], total: 1 };
  }, { backoffMs: 300, sleep: async (ms) => { sleeps.push(ms); } });
  assert.equal(calls, 2);
  assert.deepEqual(sleeps, [300]);
  assert.equal(result.meta.attempts, 2);
});

test("bounded retry stops after the second transient failure", async () => {
  let calls = 0;
  await assert.rejects(
    readStockWithBoundedRetry(async () => {
      calls += 1;
      throw new AppsScriptError("network_error", "network");
    }, { sleep: async () => undefined }),
    (error: unknown) => error instanceof StockReadFailure && error.code === "network_error" && error.meta.attempts === 2
  );
  assert.equal(calls, 2);
});

test("configuration and missing-action failures are not automatically retried", async () => {
  for (const code of ["configuration_error", "apps_script_action_missing"] as const) {
    let calls = 0;
    await assert.rejects(readStockWithBoundedRetry(async () => {
      calls += 1;
      throw new AppsScriptError(code, code === "apps_script_action_missing" ? "Unknown action" : "missing config");
    }), (error: unknown) => error instanceof StockReadFailure && error.code === code && error.retryable === false);
    assert.equal(calls, 1);
  }
});

test("Stock error classification and Thai messages stay specific", () => {
  assert.equal(classifyStockReadError(new AppsScriptError("timeout", "x")), "timeout");
  assert.equal(classifyStockReadError(new Error("Unknown action: listStockVehicles")), "apps_script_action_missing");
  assert.match(stockReadUserMessage("timeout"), /ตอบกลับช้ากว่าปกติ/);
  assert.doesNotMatch(stockReadUserMessage("timeout"), /deploy|Apps Script/i);
  assert.match(stockReadUserMessage("apps_script_action_missing"), /แจ้งผู้ดูแลระบบ/);
});

test("Stock API failure is non-2xx structured data, never success plus empty vehicles", async () => {
  const route = await readFile(new URL("../app/api/stock/list/route.ts", import.meta.url), "utf8");
  assert.match(route, /ok: false/);
  assert.match(route, /errorCode/);
  assert.match(route, /retryable/);
  assert.match(route, /status: retryable \? 503/);
  const catchBlock = route.slice(route.indexOf("} catch (error)"));
  assert.doesNotMatch(catchBlock, /vehicles:\s*\[\]/);
  assert.doesNotMatch(catchBlock, /total:\s*0/);
});

test("Stock client preserves an existing list on failure and exposes retry/stale UX", async () => {
  const ui = await readFile(new URL("../app/stock-export/page.tsx", import.meta.url), "utf8");
  const loadStock = ui.slice(ui.indexOf("async function loadStock"), ui.indexOf("async function loadLineGroups"));
  const failureBranch = loadStock.slice(loadStock.indexOf("if (!response.ok"));
  assert.doesNotMatch(failureBranch, /setVehicles\(\[\]\)/);
  assert.match(failureBranch, /setStockDataStale\(hasSuccessfulStockLoad\)/);
  assert.match(ui, /อัปเดตข้อมูลล่าสุดไม่สำเร็จ ข้อมูลที่แสดงยังเป็นชุดก่อนหน้า/);
  assert.match(ui, /ข้อมูลอาจไม่ใช่ล่าสุด/);
  assert.match(ui, /อัปเดตล่าสุด/);
  assert.match(ui, /ลองใหม่/);
  assert.match(ui, /disabled=\{loading/);
  assert.doesNotMatch(ui, /ต้อง deploy Apps Script เวอร์ชันใหม่ก่อน/);
});

test("optional dependency loaders cannot clear the Stock vehicle list", async () => {
  const ui = await readFile(new URL("../app/stock-export/page.tsx", import.meta.url), "utf8");
  for (const functionName of ["loadLineGroups", "loadBookingReports", "loadLineReservations"]) {
    const start = ui.indexOf(`async function ${functionName}`);
    const end = ui.indexOf("async function", start + 20);
    const block = ui.slice(start, end < 0 ? undefined : end);
    assert.doesNotMatch(block, /setVehicles/);
  }
});

test("no write route is part of Stock automatic retry", async () => {
  const route = await readFile(new URL("../app/api/stock/list/route.ts", import.meta.url), "utf8");
  assert.match(route, /export async function GET/);
  assert.doesNotMatch(route, /export async function (POST|PUT|PATCH|DELETE)/);
});

test("Stock Export uses the shared BIG CAR CRM visual system without changing data flow", async () => {
  const ui = await readFile(new URL("../app/stock-export/page.tsx", import.meta.url), "utf8");
  assert.match(ui, /NativeAppShell/);
  assert.match(ui, /NativeCard/);
  assert.match(ui, /NativeButton/);
  assert.match(ui, /SearchField/);
  assert.match(ui, />สต๊อกรถ</);
  assert.match(ui, /BIG CAR RDD · STOCK/);
  assert.match(ui, /aria-label="กำลังโหลดข้อมูลสต๊อก"/);
  assert.match(ui, /stockStatusTone/);
  assert.match(ui, /ราคาเสนอขาย/);

  const fetchCalls = ui.match(/fetch\(/g) ?? [];
  assert.equal(fetchCalls.length, 3, "visual redesign must not add Stock requests");
});

test("Stock brand refinement reuses the public BIG CAR website palette in a page-local scope", async () => {
  const [ui, styles, site] = await Promise.all([
    readFile(new URL("../app/stock-export/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/components/site.tsx", import.meta.url), "utf8")
  ]);
  for (const token of ["#07080a", "#d6b66c", "#f6df9d"]) {
    assert.match(site, new RegExp(token));
    assert.match(styles, new RegExp(token));
  }
  assert.match(ui, /stock-bigcar-brand/);
  assert.match(ui, /stock-brand-surface/);
  assert.doesNotMatch(styles.split("* {")[0] || "", /--stock-brand-gold/, "Stock palette must not change global CRM tokens");
});
