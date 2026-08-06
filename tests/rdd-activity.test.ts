import assert from "node:assert/strict";
import test from "node:test";
import { buildRddActivityEvent } from "../lib/rdd-activity-event.ts";
import type { SalesUser } from "../lib/types.ts";

const actor = {
  id: "USER-1", nickname: "Seller", firstName: "", lastName: "", email: "seller@example.com",
  role: "sales"
} as SalesUser;

test("RDD activity records actor and structured change metadata", () => {
  const event = buildRddActivityEvent(actor, {
    action: "lead.update", targetType: "lead", targetId: "LEAD-1", source: "api",
    before: { status: "new" }, after: { status: "follow_up" }
  });
  assert.equal(event.actorUserId, "USER-1");
  assert.equal(event.actorName, "Seller");
  assert.equal(event.before?.status, "new");
  assert.equal(event.after?.status, "follow_up");
});
