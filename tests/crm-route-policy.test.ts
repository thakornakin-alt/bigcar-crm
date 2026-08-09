import assert from "node:assert/strict";
import test from "node:test";
import { routeAccess } from "../lib/crm-route-policy.ts";

test("public website and login dependencies stay public", () => {
  for (const path of ["/", "/cars", "/cars/car-1", "/articles", "/contact", "/api/auth/login", "/api/auth/me"]) {
    assert.equal(routeAccess(path), "public", path);
  }
});

test("CRM pages and APIs require authentication", () => {
  for (const path of ["/dashboard", "/calculator", "/booking-delivery-v2", "/rdd-home", "/booking-delivery-workspace", "/api/stock/list", "/api/finance/rates"]) {
    assert.equal(routeAccess(path), "authenticated", path);
  }
});

test("admin and external routes are classified narrowly", () => {
  assert.equal(routeAccess("/admin/users"), "admin");
  assert.equal(routeAccess("/api/auth/register"), "admin");
  assert.equal(routeAccess("/api/line/webhook"), "external");
  assert.equal(routeAccess("/api/realtime-booking/gmail-oauth/callback"), "external");
  assert.equal(routeAccess("/api/realtime-booking/gmail-webhook"), "external");
});
