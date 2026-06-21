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
    if (originalBigCarDataDir === undefined) {
      delete process.env.BIG_CAR_DATA_DIR;
    } else {
      process.env.BIG_CAR_DATA_DIR = originalBigCarDataDir;
    }
    await rm(dir, { recursive: true, force: true });
  }
}

test("parseLineReservationCommands supports multi-line reserve and ignores blanks", { concurrency: false }, async () => {
  const { parseLineReservationCommands } = await import("../lib/line-reservations.ts");

  const commands = parseLineReservationCommands(`
    จองทะเบียน : 2ขภ 2660

    จองทะเบียน: 2ฒธ 3700
    reserve 6กฮ 1348
  `);

  assert.deepEqual(commands, [
    { action: "reserve", plate: "2ขภ 2660" },
    { action: "reserve", plate: "2ฒธ 3700" },
    { action: "reserve", plate: "6กฮ 1348" }
  ]);
});

test("parseLineReservationCommands never treats the word ทะเบียน as a plate", { concurrency: false }, async () => {
  const { parseLineReservationCommands } = await import("../lib/line-reservations.ts");

  const commands = parseLineReservationCommands("จองทะเบียน : 2ขภ 2660\nยกเลิกจองทะเบียน : 2ฒธ 3700");
  assert.equal(commands[0]?.plate, "2ขภ 2660");
  assert.equal(commands[1]?.plate, "2ฒธ 3700");
});

test("applyLineReservationCommand writes multiple plates without duplicating existing keys", { concurrency: false }, async () => {
  await withTempDataDir(async () => {
    const {
      applyLineReservationCommand,
      listActiveReservedPlateKeys,
      listLineReservationRecords
    } = await import("../lib/line-reservations.ts");

    const result = await applyLineReservationCommand({
      text: "จองทะเบียน : 2ขภ 2660\nจองทะเบียน : 2ฒธ 3700\nreserve 6กฮ 1348",
      sourceGroupId: "group-1",
      receivedAt: "2026-06-21T00:00:00.000Z"
    });

    assert.ok(result);

    const active = await listActiveReservedPlateKeys();
    assert.deepEqual(active.sort(), ["2ขภ2660", "2ฒธ3700", "6กฮ1348"]);

    const records = await listLineReservationRecords();
    assert.equal(records.length, 3);
    assert.equal(records[0]?.sourceGroupId, "group-1");
  });
});

test("applyLineReservationCommand supports multi-line unreserve", { concurrency: false }, async () => {
  await withTempDataDir(async () => {
    const {
      applyLineReservationCommand,
      listActiveReservedPlateKeys
    } = await import("../lib/line-reservations.ts");

    await applyLineReservationCommand({
      text: "จองทะเบียน : 2ขภ 2660\nจองทะเบียน : 2ฒธ 3700\nจองทะเบียน : 6กฮ 1348",
      sourceGroupId: "group-1",
      receivedAt: "2026-06-21T00:00:00.000Z"
    });

    await applyLineReservationCommand({
      text: "ปล่อยจองทะเบียน : 2ขภ 2660\nยกเลิกจองทะเบียน : 2ฒธ 3700\nunreserve 6กฮ 1348",
      sourceGroupId: "group-1",
      receivedAt: "2026-06-21T00:01:00.000Z"
    });

    const active = await listActiveReservedPlateKeys();
    assert.deepEqual(active, []);
  });
});
