import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  filterThaiAddressOptions,
  findDistrict,
  findProvince,
  findSubdistrict,
  selectThaiDistrict,
  selectThaiProvince,
  thaiAddressLabels,
  validateThaiAddressSelection,
  type ThaiAddressDataset,
  type ThaiAddressValue
} from "../lib/documents-v2/thai-address.ts";

const dataset = JSON.parse(await readFile(new URL("../public/data/thai-addresses-b8b3fb9.json", import.meta.url), "utf8")) as ThaiAddressDataset;
const bangkok: ThaiAddressValue = { mode: "canonical", province: "กรุงเทพมหานคร", district: "ดอนเมือง", subdistrict: "ดอนเมือง" };

test("local Thai address snapshot has the audited hierarchy counts", () => {
  assert.equal(dataset.version, "b8b3fb9");
  assert.equal(dataset.provinces.length, 77);
  assert.equal(dataset.provinces.flatMap((province) => province.districts).length, 928);
  assert.equal(dataset.provinces.flatMap((province) => province.districts.flatMap((district) => district.subdistricts)).length, 7436);
});

test("province filters districts and district filters subdistricts", () => {
  assert.ok(findProvince(dataset, "กรุงเทพมหานคร")?.districts.some((district) => district.name === "ดอนเมือง"));
  assert.equal(findDistrict(dataset, "เชียงใหม่", "ดอนเมือง"), undefined);
  assert.ok(findSubdistrict(dataset, "เชียงใหม่", "เมืองเชียงใหม่", "สุเทพ"));
  assert.equal(findSubdistrict(dataset, "กรุงเทพมหานคร", "ดอนเมือง", "สุเทพ"), undefined);
});

test("changing parent selection clears invalid descendants", () => {
  assert.deepEqual(selectThaiProvince(bangkok, "เชียงใหม่"), { ...bangkok, province: "เชียงใหม่", district: "", subdistrict: "" });
  assert.deepEqual(selectThaiDistrict(bangkok, "บางเขน"), { ...bangkok, district: "บางเขน", subdistrict: "" });
});

test("Bangkok and provincial terminology are correct", () => {
  assert.deepEqual(thaiAddressLabels("กรุงเทพมหานคร"), { district: "เขต", subdistrict: "แขวง" });
  assert.deepEqual(thaiAddressLabels("เชียงใหม่"), { district: "อำเภอ", subdistrict: "ตำบล" });
});

test("search works locally at every hierarchy level", () => {
  assert.ok(filterThaiAddressOptions(dataset.provinces, "เชียง").some((item) => item.name === "เชียงใหม่"));
  assert.ok(filterThaiAddressOptions(findProvince(dataset, "กรุงเทพมหานคร")!.districts, "ดอน").some((item) => item.name === "ดอนเมือง"));
  assert.ok(filterThaiAddressOptions(findDistrict(dataset, "เชียงใหม่", "เมืองเชียงใหม่")!.subdistricts, "เทพ").some((item) => item.name === "สุเทพ"));
});

test("exact canonical values validate without fuzzy replacement", () => {
  assert.equal(validateThaiAddressSelection(dataset, bangkok).valid, true);
  assert.equal(validateThaiAddressSelection(dataset, { ...bangkok, district: "ดอน เมือง" }).valid, false);
  assert.equal(findProvince(dataset, "กทม."), undefined);
});

test("manual fallback preserves arbitrary historical text", () => {
  const manual = { mode: "manual", province: "จังหวัดเดิม", district: "อำเภอเดิม", subdistrict: "ตำบลเดิม" } as const;
  assert.deepEqual(validateThaiAddressSelection(dataset, manual), { valid: true, manual: true, issue: "" });
  assert.equal(manual.province, "จังหวัดเดิม");
});

test("Power of Attorney keeps Moo as a string and generator fills the printed Moo slot", async () => {
  const ui = await readFile(new URL("../components/documents/DocumentGeneratorV2.tsx", import.meta.url), "utf8");
  const generator = await readFile(new URL("../lib/documents-v2/generator.ts", import.meta.url), "utf8");
  assert.match(ui, /\["customer_moo", "หมู่ที่"\]/);
  assert.doesNotMatch(ui, /Number\(powerOfAttorneyExtras\.customer_moo\)|parseInt\(powerOfAttorneyExtras\.customer_moo/);
  assert.match(generator, /drawPowerOfAttorneyMoo/);
  assert.match(generator, /allData\.customer_moo/);
});

test("shared selector is used by both separated-address Documents V2 forms", async () => {
  const ui = await readFile(new URL("../components/documents/DocumentGeneratorV2.tsx", import.meta.url), "utf8");
  assert.equal((ui.match(/<ThaiAddressSelector/g) || []).length, 2);
  assert.match(ui, /powerOfAttorneyExtras\.customer_province/);
  assert.match(ui, /transportTransferExtras\.transferee_province/);
});
