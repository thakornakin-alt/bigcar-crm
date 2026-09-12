import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/stock-export/page.tsx", import.meta.url), "utf8");
const stockTypes = await readFile(new URL("../lib/types.ts", import.meta.url), "utf8");
const stockApi = await readFile(new URL("../app/api/stock/list/route.ts", import.meta.url), "utf8");

test("StockVehicle has no unverified image field and the list uses an explicit no-image state", () => {
  const stockVehicleContract = stockTypes.match(/export type StockVehicle = \{[\s\S]*?\n\};/)?.[0] || "";

  assert.doesNotMatch(stockVehicleContract, /\b(image|imageUrl|photo|photoUrl|thumbnail|thumbnailUrl|driveFileId)\??\s*:/i);
  assert.doesNotMatch(stockApi, /\b(image|imageUrl|photo|photoUrl|thumbnail|thumbnailUrl|driveFileId)\s*:/i);
  assert.match(page, /data-vehicle-image="placeholder"/);
  assert.match(page, /ยังไม่มีภาพรถ/);
});

test("placeholder UI does not fabricate or fetch vehicle images", () => {
  const placeholder = page.match(/function VehicleImagePlaceholder[\s\S]*?\n\}/)?.[0] || "";

  assert.ok(placeholder);
  assert.doesNotMatch(placeholder, /<img|next\/image|https?:\/\/|vehicle\.model.*src|vehicle\.brand.*src/i);
});

test("Stock Export reliability and export controls remain present", () => {
  assert.match(page, /stockLoadError/);
  assert.match(page, /stockDataStale/);
  assert.match(page, /onClick=\{\(\) => exportImage\("png"\)\}/);
  assert.match(page, /sendLineStockImages/);
  assert.match(page, /sortedVehicles\.length/);
});

test("Stock Export loads the full supported inventory and blocks incomplete exports", () => {
  assert.match(page, /const stockExportFetchLimit = 1000/);
  assert.match(page, /\/api\/stock\/list\?limit=\$\{stockExportFetchLimit\}/);
  assert.match(page, /stockTotal > vehicles\.length/);
  assert.match(page, /stockIntegrity\.status !== "complete"/);
  assert.match(page, /stockIntegrity\.persistedTotal !== stockTotal/);
  assert.match(page, /if \(stockDataIncomplete\)/);
  assert.match(page, /ระบบปิดการเซฟและส่ง LINE ไว้ก่อน/);
  assert.match(page, /disabled=\{exporting \|\| stockDataIncomplete \|\| !exportVehicles\.length\}/);
});

test("Stock status filters come from imported column P values instead of a fixed allowlist", () => {
  assert.doesNotMatch(page, /const stockStatuses\s*=/);
  assert.match(page, /uniqueSorted\(\[\.\.\.Object\.keys\(statusCounts\), \.\.\.selectedStatuses\]\)/);
  assert.match(page, /const status = stockStatus\(vehicle\) \|\| "ไม่ระบุ"/);
  assert.match(page, /จอง_CarSub/);
});

test("Stock import integrity is returned by the list API", () => {
  assert.match(stockApi, /readStockImportIntegrity/);
  assert.match(stockApi, /integrity/);
});
