import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const code = fs.readFileSync(new URL("../google-apps-script/Code.gs", import.meta.url), "utf8");
const mirror = fs.readFileSync(new URL("../google-apps-script/Code.compact.gs", import.meta.url), "utf8");

function extract(name) {
  const match = code.match(new RegExp(`function ${name}\\([^\\r\\n]+`));
  assert.ok(match, `${name} must exist`);
  return match[0];
}

function boundary(secret = "fixture-secret-not-for-runtime") {
  const values = new Map([["BIGCAR_APPS_SCRIPT_AUTH_SECRET", secret]]);
  let locked = false;
  const properties = {
    getProperty: (key) => values.get(key) ?? null,
    getProperties: () => Object.fromEntries(values),
    setProperty: (key, value) => void values.set(key, value),
    deleteProperty: (key) => void values.delete(key)
  };
  const context = {
    PropertiesService: { getScriptProperties: () => properties },
    LockService: { getScriptLock: () => ({ tryLock: () => !locked && (locked = true), releaseLock: () => { locked = false; } }) },
    Utilities: {
      Charset: { UTF_8: "UTF_8" },
      computeHmacSha256Signature: (message, key) => [...crypto.createHmac("sha256", key).update(message).digest()].map((n) => n > 127 ? n - 256 : n)
    },
    Date,
    result: undefined
  };
  vm.runInNewContext([
    'var AUTH_BOUNDARY_SECRET_PROPERTY="BIGCAR_APPS_SCRIPT_AUTH_SECRET",AUTH_BOUNDARY_TOLERANCE_MS=120000,AUTH_BOUNDARY_NONCE_PREFIX="AUTH_NONCE_";',
    extract("canonicalAuthJson_"), extract("authBytesToHex_"), extract("authConstantTimeEqual_"), extract("verifyApplicationEnvelope_")
  ].join("\n"), context);
  return context;
}

function envelope(action, payload, secret, timestamp = Date.now(), nonce = "a".repeat(48)) {
  const stableJson = (value) => value === null || typeof value !== "object"
    ? JSON.stringify(value)
    : Array.isArray(value)
      ? `[${value.map(stableJson).join(",")}]`
      : `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  const stable = stableJson(payload);
  const signature = crypto.createHmac("sha256", secret).update([action, String(timestamp), nonce, stable].join("\n")).digest("hex");
  return { action, payload, envelope: { timestamp: String(timestamp), nonce, signature } };
}

test("Apps Script mirrors remain byte-equivalent", () => assert.equal(code, mirror));

test("approved user, password-reset, and Booking Draft actions are protected", () => {
  for (const action of ["loginSalesUser", "registerSalesUser", "listSalesUsers", "updateSalesUser", "sendPasswordResetEmail", "createBookingEmailDraft"])
    assert.match(code, new RegExp(`isProtectedAuthAction_[^\\n]+${action}`));
  assert.doesNotMatch(code.match(/function isProtectedAuthAction_\([^\r\n]+/)[0], /saveSalesReport|saveBookingReport|listStockVehicles/);
});

test("Booking Draft router consumes only the verified payload and enforces central recipients", () => {
  assert.match(code, /createBookingEmailDraft\(p\|\|\{\}\)/);
  assert.match(code, /function createBookingEmailDraft[^\n]+RDDUsedcarBooked@segroup\.co\.th/);
  assert.match(code, /function createBookingEmailDraft[^\n]+rongsarit\.s@tgh\.co\.th/);
  assert.doesNotMatch(code.match(/function createBookingEmailDraft\([^\r\n]+/)[0], /input\.to|input\.cc|input\.bcc/);
});

test("unsigned Booking Draft is rejected and signed fixture reaches the contract without Gmail", () => {
  const secret = "fixture-secret-not-for-runtime";
  const context = boundary(secret);
  const calls = [];
  context.parseRequestBody = (event) => event.body;
  context.jsonResponse = (value) => value;
  context.getErrorMessage = (error) => String(error?.message || error || "");
  context.createBookingEmailDraft = (payload) => { calls.push(payload); return { status: "fixture_only" }; };
  vm.runInNewContext([extract("isProtectedAuthAction_"), extract("doPost")].join("\n"), context);
  const unsigned = context.doPost({ body: { action: "createBookingEmailDraft", subject: "unsafe", body: "unsafe" } });
  assert.equal(unsigned.ok, false);
  assert.equal(unsigned.error, "unauthorized_application_request");
  assert.equal(calls.length, 0);
  const payload = { reportId: "BR-FIXTURE", subject: "fixture", body: "fixture", to: "spoof@example.invalid" };
  const signed = envelope("createBookingEmailDraft", payload, secret, Date.now(), "e".repeat(48));
  const accepted = context.doPost({ body: signed });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.result.status, "fixture_only");
  assert.equal(calls.length, 1);
});

test("canonical vector accepts valid signature and rejects replay/tampering/expiry", () => {
  const secret = "fixture-secret-not-for-runtime";
  const payload = { user: { email: "qa@example.invalid", profile: { branch: "B", role: "sales" } } };
  const valid = envelope("updateSalesUser", payload, secret);
  const context = boundary(secret);
  assert.deepEqual(JSON.parse(JSON.stringify(context.verifyApplicationEnvelope_(valid.action, valid))), payload);
  assert.throws(() => context.verifyApplicationEnvelope_(valid.action, valid), /unauthorized_application_request/);
  const tampered = envelope("updateSalesUser", payload, secret, Date.now(), "b".repeat(48));
  tampered.payload.user.email = "changed@example.invalid";
  assert.throws(() => context.verifyApplicationEnvelope_(tampered.action, tampered), /unauthorized_application_request/);
  const expired = envelope("listSalesUsers", {}, secret, Date.now() - 121000, "c".repeat(48));
  assert.throws(() => context.verifyApplicationEnvelope_(expired.action, expired), /unauthorized_application_request/);
  const future = envelope("listSalesUsers", {}, secret, Date.now() + 121000, "d".repeat(48));
  assert.throws(() => context.verifyApplicationEnvelope_(future.action, future), /unauthorized_application_request/);
});

test("application signing stays server-only and secret has no public prefix", () => {
  const app = fs.readFileSync(new URL("../lib/apps-script.ts", import.meta.url), "utf8");
  assert.match(app, /process\.env\.BIGCAR_APPS_SCRIPT_AUTH_SECRET/);
  assert.doesNotMatch(app, /NEXT_PUBLIC_BIGCAR_APPS_SCRIPT_AUTH_SECRET/);
  assert.equal([...app.matchAll(/createHmac\("sha256"/g)].length, 1);
});
