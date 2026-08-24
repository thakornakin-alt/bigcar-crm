import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const route = fs.readFileSync(new URL("../app/api/internal/password-reset-email-sender-check/route.ts", import.meta.url), "utf8");
const helper = fs.readFileSync(new URL("../lib/apps-script.ts", import.meta.url), "utf8");

test("sender verification endpoint is Preview-only and accepts no caller payload", () => {
  assert.match(route, /process\.env\.VERCEL_ENV !== "preview"/);
  assert.match(route, /export async function GET\(\)/);
  assert.doesNotMatch(route, /POST|request\.json|searchParams/);
});

test("runtime probes are fixed invalid fixtures that cannot reach Gmail send", () => {
  assert.match(helper, /recipientEmail: "invalid"/);
  assert.match(helper, /https:\/\/invalid\.example/);
  assert.match(helper, /https:\/\/bigcar-crm\.vercel\.app/);
  assert.match(helper, /signedListSalesUsers/);
  assert.doesNotMatch(helper, /signedListSalesUsers: \{ ok: true, count:/);
  assert.match(helper, /replay: \{ firstAccepted: replayFirst\.ok, secondError: replaySecond\.error \}/);
  assert.match(helper, /invalidSignature: invalidSignature\.error/);
});
