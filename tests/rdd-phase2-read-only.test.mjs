import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const businessUiFiles = [
  "components/rdd/use-booking-delivery-read.ts",
  "components/rdd/rdd-home-client.tsx"
];

test("Phase 2 Home and Workspace business UI only use authenticated GET reads", async () => {
  const source = (await Promise.all(businessUiFiles.map((file) => readFile(file, "utf8")))).join("\n");
  assert.doesNotMatch(source, /method\s*:\s*["'](?:POST|PATCH|PUT|DELETE)["']/i);
  assert.doesNotMatch(source, /\b(?:save|autosave|delete|cancelBooking|updateBooking)\s*\(/i);
  assert.match(source, /fetch\("\/api\/booking-delivery\?scope=all"[^]*method:\s*"GET"/);
});

test("both Phase 2 routes fail closed behind the read-only feature flag", async () => {
  for (const file of ["app/rdd-home/page.tsx", "app/booking-delivery-workspace/page.tsx"]) {
    const source = await readFile(file, "utf8");
    assert.match(source, /workspaceReadOnly/);
    assert.match(source, /notFound\(\)/);
  }
});

test("Phase 3A mutation uses only the narrow workspace endpoint", async () => {
  const source = await readFile("components/rdd/booking-delivery-workspace-client.tsx", "utf8");
  assert.match(source, /fetch\("\/api\/booking-delivery-workspace"/);
  assert.match(source, /method:\s*"PATCH"/);
  assert.doesNotMatch(source, /method:\s*["'](?:POST|PUT|DELETE)["']/i);
  assert.doesNotMatch(source, /fetch\("\/api\/booking-delivery"[^]*method:\s*"PATCH"/);
});

test("existing Booking Delivery routes remain present and are not redirected", async () => {
  for (const file of ["app/booking-delivery/page.tsx", "app/booking-delivery-v2/page.tsx"]) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /redirect\(["']\/booking-delivery-workspace/);
  }
});
