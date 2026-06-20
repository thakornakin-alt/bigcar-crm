import test from "node:test";
import assert from "node:assert/strict";
import { parseReserveAction } from "../lib/line-reservations.ts";

test("parse reservation command with hidden label before plate", async () => {
  const result = parseReserveAction("จองทะเบียน : 2ขภ 2660");
  assert.equal(result?.action, "reserve");
  assert.equal(result?.plate, "2ขภ 2660");
});

test("parse unreserve command with hidden label before plate", () => {
  const result = parseReserveAction("ยกเลิกจองทะเบียน : 2ขภ 2660");
  assert.equal(result?.action, "unreserve");
  assert.equal(result?.plate, "2ขภ 2660");
});

test("does not treat hidden label as plate", () => {
  const result = parseReserveAction("จองทะเบียน : 2ขภ 2660");
  assert.notEqual(result?.plate, "ทะเบียน");
});
