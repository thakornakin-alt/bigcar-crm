import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { usableAuthSecret, verifySessionTokenEdge } from "../lib/edge-session.ts";
import type { SalesUser } from "../lib/types.ts";

const user: SalesUser = {
  id: "USER-1", createdAt: "", updatedAt: "", email: "user@example.com", firstName: "Test",
  lastName: "User", nickname: "Tester", phone: "", lineId: "", lineQrUrl: "", avatarUrl: "",
  position: "Sales", branch: "", role: "sales", locked: false
};

test("Edge verification accepts a signed, unexpired session", async () => {
  const secret = "test-secret-that-is-not-the-fallback";
  const now = Date.now();
  const payload = Buffer.from(JSON.stringify({ user, iat: now, exp: now + 60_000 })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  assert.equal((await verifySessionTokenEdge(`${payload}.${signature}`, secret, now))?.id, user.id);
});

test("expired and tampered sessions are rejected", async () => {
  const secret = "test-secret";
  const payload = Buffer.from(JSON.stringify({ user, iat: 1, exp: 2 })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  assert.equal(await verifySessionTokenEdge(`${payload}.${signature}`, secret, 3), null);
  assert.equal(await verifySessionTokenEdge(`${payload}.${signature}x`, secret, 1), null);
});

test("fallback and missing production secrets are not usable", () => {
  assert.equal(usableAuthSecret({}), "");
  assert.equal(usableAuthSecret({ AUTH_SECRET: "big-car-crm-local-profile-secret" }), "");
});
