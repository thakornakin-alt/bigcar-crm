import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import test from "node:test";

const originalBigCarDataDir = process.env.BIG_CAR_DATA_DIR;

function useTempDataDir(dir: string) {
  process.env.BIG_CAR_DATA_DIR = dir;
}

async function withTempDataDir(fn: () => Promise<void>) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "bigcar-line-reservations-"));
  useTempDataDir(dir);
  try {
    await fn();
  } finally {
    if (originalBigCarDataDir === undefined) delete process.env.BIG_CAR_DATA_DIR;
    else process.env.BIG_CAR_DATA_DIR = originalBigCarDataDir;
    await rm(dir, { recursive: true, force: true });
  }
}

test("parses explicit reserve and unreserve commands", { concurrency: false }, async () => {
  const { parseLineReservationCommands } = await import("../lib/line-reservations.ts");
  assert.deepEqual(parseLineReservationCommands("จองทะเบียน : 2ขภ 2660\nยกเลิกจองทะเบียน : 2ฒธ 3700"), [
    { action: "reserve", plate: "2ขภ 2660" },
    { action: "unreserve", plate: "2ฒธ 3700" }
  ]);
});

test("parses LINE sales message field with spaces and กทม", { concurrency: false }, async () => {
  const { parseLineReservationCommands } = await import("../lib/line-reservations.ts");
  const commands = parseLineReservationCommands("ชื่อ-นามสกุล : ลูกค้า\nทะเบียนรถ : 3ฒญ 7441 กทม\nราคาตั้งขาย : 357,000");
  assert.deepEqual(commands, [{ action: "reserve", plate: "3ฒญ 7441" }]);
});

test("supports multiple plates in one ทะเบียนรถ field", { concurrency: false }, async () => {
  const { parseLineReservationCommands } = await import("../lib/line-reservations.ts");
  const commands = parseLineReservationCommands("ทะเบียนรถ : 3ฒญ 7441 กทม, 2ขภ 2660, 6กฮ1348");
  assert.deepEqual(commands, [
    { action: "reserve", plate: "3ฒญ 7441" },
    { action: "reserve", plate: "2ขภ 2660" },
    { action: "reserve", plate: "6กฮ1348" }
  ]);
});

test("multiple ทะเบียนรถ lines accumulate in one webhook message", { concurrency: false }, async () => {
  const { parseLineReservationCommands } = await import("../lib/line-reservations.ts");
  const commands = parseLineReservationCommands("ทะเบียนรถ : 3ฒญ 7441 กทม\nทะเบียนรถ: 2ฒธ3700\nทะเบียนรถ : 6กฮ 1348");
  assert.equal(commands.length, 3);
});

test("apply writes normalized LINE reservations without duplicate plate keys", { concurrency: false }, async () => {
  await withTempDataDir(async () => {
    const { applyLineReservationCommand, listActiveReservedPlateKeys, listLineReservationRecords } = await import("../lib/line-reservations.ts");
    await applyLineReservationCommand({
      text: "ทะเบียนรถ : 3ฒญ 7441 กทม, 2ขภ 2660\nทะเบียนรถ : 6กฮ1348",
      sourceGroupId: "group-1",
      receivedAt: "2026-09-10T00:00:00.000Z"
    });
    const active = await listActiveReservedPlateKeys();
    assert.deepEqual(active.sort(), ["2ขภ2660", "3ฒญ7441", "6กฮ1348"]);
    const records = await listLineReservationRecords();
    assert.equal(records.length, 3);
    assert.equal(records[0]?.sourceGroupId, "group-1");
  });
});

test("unreserve updates only LINE reservation store", { concurrency: false }, async () => {
  await withTempDataDir(async () => {
    const { applyLineReservationCommand, listActiveReservedPlateKeys } = await import("../lib/line-reservations.ts");
    await applyLineReservationCommand({ text: "ทะเบียนรถ : 2ขภ 2660" });
    await applyLineReservationCommand({ text: "ปล่อยจองทะเบียน : 2ขภ 2660" });
    assert.deepEqual(await listActiveReservedPlateKeys(), []);
  });
});
