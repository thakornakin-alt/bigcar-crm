import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const client = fs.readFileSync("components/commission/commission-preview-client.tsx", "utf8");
const page = fs.readFileSync("app/commission/page.tsx", "utf8");

test("Commission Preview is feature-gated and has no business mutation request", () => {
  assert.match(page, /commissionPreview/);
  assert.match(client, /\/api\/booking-delivery\?scope=all/);
  assert.doesNotMatch(client, /method:\s*["'](?:POST|PATCH|PUT|DELETE)["']/i);
  assert.doesNotMatch(client, /\/api\/commission/);
});

test("closing controls are explicitly fixture/local-only", () => {
  assert.match(client, /COMMISSION_CLOSING_FIXTURES/);
  assert.match(client, /ไม่มี API mutation/);
  assert.match(client, /setClosingChoices/);
});
