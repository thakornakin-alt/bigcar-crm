import assert from "node:assert/strict";
import test from "node:test";

import {
  ownershipFromUser,
  resolveLegacyOwnerByExactName,
  salesOwnershipFromBooking
} from "../lib/case-ownership";
import type { SalesUser } from "../lib/types";

function user(id: string, firstName: string, lastName = "ผู้ใช้"): SalesUser {
  return {
    id, email: `${id}@example.com`, firstName, lastName, nickname: "",
    phone: "0900000000", branch: "HQ", role: "sales", active: true
  } as unknown as SalesUser;
}

test("authenticated user is canonical owner and browser display data is irrelevant", () => {
  const owner = ownershipFromUser(user("USER-A", "สมชาย"), { caseType: "booking", caseId: "BR-A" });
  assert.equal(owner.ownerUserId, "USER-A");
  assert.equal(owner.ownerEmail, "user-a@example.com");
});

test("Booking to Sales preserves the exact stable owner", () => {
  const booking = ownershipFromUser(user("USER-A", "สมชาย"), { caseType: "booking", caseId: "BR-A" });
  const sales = salesOwnershipFromBooking(booking, "SR-A");
  assert.equal(sales.ownerUserId, "USER-A");
  assert.equal(sales.sourceCaseId, "BR-A");
  assert.equal(sales.caseId, "SR-A");
});

test("display-name changes do not change identity", () => {
  const before = ownershipFromUser(user("USER-A", "สมชาย"), { caseType: "booking", caseId: "BR-A" });
  const renamed = user("USER-A", "สมหมาย");
  assert.equal(before.ownerUserId, renamed.id);
});

test("legacy exact full name resolves only when unique; ambiguous and nickname do not", () => {
  const users = [user("A", "สมชาย", "ใจดี"), user("B", "สมชาย", "ใจดี")];
  assert.equal(resolveLegacyOwnerByExactName("สมชาย ใจดี", users), null);
  assert.equal(resolveLegacyOwnerByExactName("สมชาย", users), null);
  assert.equal(resolveLegacyOwnerByExactName("สมหญิง ใจดี", [user("C", "สมหญิง", "ใจดี")])?.id, "C");
});
