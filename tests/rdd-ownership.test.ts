import assert from "node:assert/strict";
import test from "node:test";
import { filterByOwnership, ownershipScope } from "../lib/rdd-ownership.ts";

const records = [{ id: "1", ownerUserId: "USER-1" }, { id: "2" }, { id: "3", ownerUserId: "USER-2" }];

test("All is the default and includes unassigned historical records", () => {
  assert.equal(ownershipScope(undefined), "all");
  assert.deepEqual(filterByOwnership(records, "all", "USER-1").map((item) => item.id), ["1", "2", "3"]);
});

test("Mine uses exact owner id and Unassigned never guesses from names", () => {
  assert.deepEqual(filterByOwnership(records, "mine", "USER-1").map((item) => item.id), ["1"]);
  assert.deepEqual(filterByOwnership(records, "unassigned", "USER-1").map((item) => item.id), ["2"]);
});

