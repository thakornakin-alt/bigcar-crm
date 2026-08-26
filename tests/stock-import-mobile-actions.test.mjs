import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/stock-import/page.tsx", import.meta.url), "utf8");

test("Hidden Column actions stay visible as an equal-width mobile grid", () => {
  assert.match(source, /grid w-full grid-cols-3 gap-2 sm:w-auto/);
  assert.match(source, /min-h-11 min-w-0 rounded-md/);
  assert.match(source, /\[\s*\["import", "Import"\],\s*\["ignore", "Ignore"\],\s*\["never", "Never"\]\s*\]/);
  assert.match(source, /activeHiddenColumns\.map/);
  assert.match(source, /style=\{\{ color: action === value \? "#07080a" : "#ffffff" \}\}/);
  assert.match(source, /<span className="block whitespace-nowrap leading-none">\{label\}<\/span>/);
});

test("Hidden Column cards stack on mobile and retain desktop side-by-side layout", () => {
  assert.match(source, /flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between/);
  assert.match(source, /min-w-0/);
});

test("Reset Never remains a full-width tappable mobile control", () => {
  assert.match(source, /onClick=\{resetNeverImportPolicy\}/);
  assert.match(source, /min-h-11 w-full shrink-0[^"]*sm:w-auto/);
});

test("existing action handlers and import behavior remain connected", () => {
  assert.match(source, /onClick=\{\(\) => setHiddenColumnAction\(column, value as HiddenColumnAction\)\}/);
  assert.match(source, /async function importRows\(\)/);
  assert.match(source, /จับคู่คอลัมน์/);
});

test("final Stock Import action remains visible and full-width on mobile", () => {
  assert.match(source, /onClick=\{importRows\}/);
  assert.match(source, /disabled=\{importing \|\| missingPlate \|\| !parsedRows\.length\}/);
  assert.match(source, /min-h-11 w-full shrink-0[^"]*sm:w-auto/);
  assert.match(source, /flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between/);
  assert.match(source, /อัปโหลดสต๊อก/);
  assert.match(source, /style=\{\{ color: "#07080a" \}\}/);
  assert.match(source, /Upload size=\{18\} className="shrink-0 text-\[#07080a\]"/);
  assert.match(source, /whitespace-nowrap text-\[#07080a\]">อัปโหลดสต๊อก/);
});
