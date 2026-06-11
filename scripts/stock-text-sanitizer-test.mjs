import assert from "node:assert/strict";
import {
  normalizeDisplayPlate,
  normalizePlateMatchKey,
  sanitizeStockText,
  sanitizeStockVehicleTextFields
} from "../lib/stock-text-sanitizer.ts";

assert.equal(normalizeDisplayPlate(" 6กฎ  3843 "), "6กฎ 3843");
assert.equal(normalizePlateMatchKey("6กฎ 3843"), "6กฎ3843");
assert.equal(sanitizeStockText(" เทพารักษ์ "), "เทพารักษ์");
assert.equal(sanitizeStockText("อู่/โกดังบางนา "), "อู่/โกดังบางนา");
assert.equal(sanitizeStockText("TOYOTA\nALTIS\r\n1.6"), "TOYOTA ALTIS 1.6");
assert.equal(sanitizeStockText("ขาว\tมุก"), "ขาว มุก");
assert.equal(sanitizeStockText("โกดัง\u200b-บางนา\ufeff"), "โกดัง-บางนา");

const row = sanitizeStockVehicleTextFields({
  plate: " 6กฎ  3843 ",
  model: "COROLLA\nALTIS",
  color: "ขาว\tมุก",
  gear: " AT ",
  parkingLocation: " เทพารักษ์ ",
  status: " รอขาย\u200b "
});

assert.equal(row.plate, "6กฎ 3843");
assert.equal(row.model, "COROLLA ALTIS");
assert.equal(row.color, "ขาว มุก");
assert.equal(row.gear, "AT");
assert.equal(row.parkingLocation, "เทพารักษ์");
assert.equal(row.status, "รอขาย");

const duplicateLocations = [" เทพารักษ์ ", "เทพารักษ์", "เทพารักษ์\u200b"];
assert.deepEqual(duplicateLocations.map(sanitizeStockText), ["เทพารักษ์", "เทพารักษ์", "เทพารักษ์"]);

console.log("stock text sanitizer tests passed");
