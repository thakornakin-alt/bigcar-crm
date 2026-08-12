import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const client = fs.readFileSync("components/commission/commission-preview-client.tsx", "utf8");
const page = fs.readFileSync("app/commission/page.tsx", "utf8");
const adapter = fs.readFileSync("lib/commission-candidate.ts", "utf8");

test("Commission Preview is feature-gated and never calls real Booking/Commission writes", () => {
  assert.match(page, /commissionPreview/);
  assert.match(client, /\/api\/commission-preview/);
  assert.doesNotMatch(client, /\/api\/booking-delivery/);
  assert.doesNotMatch(client, /fetch\(["']\/api\/commission["']/);
});

test("canonical candidate adapter is pure and never reaches a write service", () => {
  assert.doesNotMatch(adapter, /fetch\s*\(/);
  assert.doesNotMatch(adapter, /writeJsonStore|appendRow|setValues|upsert|\.update\s*\(|\.delete\s*\(/);
  assert.doesNotMatch(adapter, /finalGrade/i);
});

test("closing controls persist only through isolated fixture API", () => {
  assert.match(client, /COMMISSION_CLOSING_FIXTURES/);
  assert.match(client, /isolated fixture API/);
  assert.match(client, /COMMISSION_REAL_WRITES_ENABLED=false/);
  assert.match(client, /setClosingChoices/);
});
