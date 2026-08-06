import assert from "node:assert/strict";
import test from "node:test";
import { attachOwnerToNewRecord, incrementRecordVersion, normalizeWorkspaceRecord } from "../lib/rdd-workspace-adapter.ts";
import type { BookingDeliveryRecord } from "../lib/types.ts";

const legacy = { id: "BR-1", saleName: "Seller A" } as BookingDeliveryRecord;

test("legacy record remains unassigned and is not rewritten from salesperson", () => {
  const record = normalizeWorkspaceRecord(legacy);
  assert.equal(record.ownerUserId, undefined);
  assert.equal(record.saleName, "Seller A");
  assert.equal(record.recordVersion, 0);
});

test("new record owner comes from actor without replacing salesperson", () => {
  const record = attachOwnerToNewRecord(legacy, { id: "USER-1", nickname: "Owner" });
  assert.equal(record.ownerUserId, "USER-1");
  assert.equal(record.ownerName, "Owner");
  assert.equal(record.saleName, "Seller A");
  assert.equal(record.recordVersion, 1);
});

test("version increments only when explicitly requested for a write", () => {
  assert.equal(incrementRecordVersion(legacy).recordVersion, 1);
});
