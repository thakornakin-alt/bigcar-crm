import assert from "node:assert/strict";
import test from "node:test";
import { safeReturnTo } from "../lib/safe-return-to.ts";

test("/booking-reports returns to /booking-reports after successful login", () => {
  assert.equal(safeReturnTo("/booking-reports"), "/booking-reports");
});

test("/documents?x=1 preserves its query after successful login", () => {
  assert.equal(safeReturnTo("/documents?x=1"), "/documents?x=1");
});

test("external returnTo falls back to /dashboard", () => {
  assert.equal(safeReturnTo("https://evil.example"), "/dashboard");
});

test("protocol-relative returnTo falls back to /dashboard", () => {
  assert.equal(safeReturnTo("//evil.example"), "/dashboard");
});

test("missing returnTo falls back to /dashboard", () => {
  assert.equal(safeReturnTo(undefined), "/dashboard");
});
