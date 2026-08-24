import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../google-apps-script/Code.gs", import.meta.url), "utf8");

function createHarness() {
  const rows = [];
  const idempotency = new Map();
  let lockDepth = 0;
  let sequence = 0;
  const sheet = {
    getLastRow: () => rows.length + 1,
    getRange: (row, column, count) => ({
      getValues: () => rows.slice(row - 2, row - 2 + count).map((record) => record.slice(column - 1))
    }),
    appendRow: (row) => {
      assert.equal(lockDepth, 1, "relationship decision and append must share ScriptLock");
      rows.push([...row]);
    }
  };
  const context = vm.createContext({
    console,
    Date,
    JSON,
    Math: Object.assign(Object.create(Math), { random: () => ++sequence / 1000 }),
    String,
    Number,
    Object,
    Array,
    Error,
    Utilities: {
      formatDate: () => "20260824-120000",
      base64EncodeWebSafe: () => "fixture",
      base64DecodeWebSafe: () => [],
      newBlob: () => ({ getDataAsString: () => "{}" })
    },
    LockService: {
      getScriptLock: () => ({
        waitLock: () => { assert.equal(lockDepth, 0); lockDepth = 1; },
        releaseLock: () => { assert.equal(lockDepth, 1); lockDepth = 0; }
      })
    }
  });
  vm.runInContext(source, context);
  context.getSalesSheet = () => sheet;
  context.purgeExpiredSalesIdempotency_ = () => {};
  context.salesReportFingerprint_ = (input) => JSON.stringify(input);
  context.readSalesIdempotency_ = (requestId) => idempotency.get(requestId) || null;
  context.writeSalesIdempotency_ = (requestId, fingerprint, result) => idempotency.set(requestId, { fingerprint, result });
  context.findSalesReportDuplicates_ = () => ({ normalizedPlate: "1กก1234", customerIdentityType: "name", matches: [] });
  return { context, rows };
}

function report(bookingReportId, requestId) {
  return {
    _requestId: requestId,
    _actorId: "USER-A",
    bookingReportId,
    customerName: "นายก",
    plate: "1กก 1234",
    saleName: "ฐากร"
  };
}

test("different requestIds racing for one bookingReportId persist exactly one Sales", () => {
  const { context, rows } = createHarness();
  const first = context.saveSalesReport(report("BR-X", "REQ-A"));
  assert.equal(rows.length, 1);
  assert.throws(
    () => context.saveSalesReport(report("BR-X", "REQ-B")),
    (error) => {
      assert.match(error.message, /^SALES_REPORT_BOOKING_RELATIONSHIP_CONFLICT:/);
      const detail = JSON.parse(error.message.split(":").slice(1).join(":"));
      assert.deepEqual(Object.keys(detail).sort(), ["bookingReportId", "salesReportId"]);
      assert.equal(detail.bookingReportId, "BR-X");
      assert.equal(detail.salesReportId, first.id);
      return true;
    }
  );
  assert.equal(rows.length, 1);
});

test("same requestId replays prior Sales before relationship conflict check", () => {
  const { context, rows } = createHarness();
  const first = context.saveSalesReport(report("BR-X", "REQ-A"));
  const replay = context.saveSalesReport(report("BR-X", "REQ-A"));
  assert.equal(replay.id, first.id);
  assert.equal(rows.length, 1);
});

test("same customer and plate remain independent when bookingReportId differs", () => {
  const { context, rows } = createHarness();
  const first = context.saveSalesReport(report("BR-A", "REQ-A"));
  const second = context.saveSalesReport(report("BR-B", "REQ-B"));
  assert.notEqual(first.id, second.id);
  assert.equal(rows.length, 2);
  assert.equal(rows[0][4], "BR-A");
  assert.equal(rows[1][4], "BR-B");
});

test("only soft-deleted Sales is excluded from the active relationship predicate", () => {
  const { context, rows } = createHarness();
  const deleted = context.saveSalesReport(report("BR-X", "REQ-A"));
  rows[0][3] = "deleted";
  const replacement = context.saveSalesReport(report("BR-X", "REQ-B"));
  assert.notEqual(replacement.id, deleted.id);
  assert.equal(rows.length, 2);
});

test("source locks idempotency, relationship guard, duplicate rules and append in strict order", () => {
  const saveLine = source.split(/\r?\n/).find((line) => line.startsWith("function saveSalesReport"));
  assert.ok(saveLine);
  const order = [
    "lock.waitLock",
    "readSalesIdempotency_",
    "findActiveSalesReportByBookingReportId_",
    "findSalesReportDuplicates_",
    "appendRow",
    "writeSalesIdempotency_",
    "lock.releaseLock"
  ].map((needle) => saveLine.indexOf(needle));
  assert.equal(order.every((index) => index >= 0), true);
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
});
