import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const code = fs.readFileSync(new URL("../google-apps-script/Code.gs", import.meta.url), "utf8");

function extract(name) {
  const match = code.match(new RegExp(`function ${name}\\([^\\r\\n]+`));
  assert.ok(match, `${name} must exist`);
  return match[0];
}

function fixture() {
  const values = new Map();
  let locked = false;
  const sent = [];
  const logs = [];
  const context = {
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (key) => values.get(key) ?? null,
      getProperties: () => Object.fromEntries(values),
      setProperty: (key, value) => void values.set(key, value),
      deleteProperty: (key) => void values.delete(key)
    }) },
    LockService: { getScriptLock: () => ({ tryLock: () => !locked && (locked = true), releaseLock: () => { locked = false; } }) },
    Utilities: {
      Charset: { UTF_8: "UTF_8" },
      DigestAlgorithm: { SHA_256: "SHA_256" },
      computeDigest: (_algorithm, value) => [...crypto.createHash("sha256").update(value).digest()].map((n) => n > 127 ? n - 256 : n)
    },
    GmailApp: { sendEmail: (...args) => sent.push(args) },
    console: { info: (...args) => logs.push(args), error: (...args) => logs.push(args) },
    Date,
    result: undefined
  };
  vm.runInNewContext([
    'var PASSWORD_RESET_EMAIL_REQUEST_PREFIX="PASSWORD_RESET_EMAIL_",PASSWORD_RESET_EMAIL_TTL_MS=60*60*1000;',
    extract("bytesToHex"), extract("passwordResetEmailRequestKey_"), extract("validatePasswordResetEmailInput_"), extract("validatePasswordResetUrl_"),
    extract("escapePasswordResetHtml_"), extract("sendPasswordResetEmail")
  ].join("\n"), context);
  return { context, sent, logs };
}

const valid = {
  recipientEmail: "qa@example.invalid",
  resetUrl: "https://bigcar-fixture-thakornakin-8081s-projects.vercel.app/reset-password?token=" + "a".repeat(43),
  displayName: "ผู้ใช้ทดสอบ",
  requestId: "reset-fixture-request-001"
};

test("fixed sender contract sends once and deduplicates requestId", () => {
  const { context, sent } = fixture();
  assert.equal(context.sendPasswordResetEmail(valid).status, "sent");
  assert.equal(context.sendPasswordResetEmail(valid).status, "duplicate_request");
  assert.equal(sent.length, 1);
  assert.equal(sent[0][1], "ตั้งรหัสผ่านใหม่ — BIG CAR CRM");
  assert.equal(sent[0][3].name, "BIG CAR CRM");
});

test("recipient, display name, reset origin, production and injected template fields are rejected or ignored", () => {
  const { context, sent } = fixture();
  assert.throws(() => context.sendPasswordResetEmail({ ...valid, recipientEmail: "invalid" }), /INVALID_RECIPIENT/);
  assert.throws(() => context.sendPasswordResetEmail({ ...valid, displayName: "<script>" }), /INVALID_DISPLAY_NAME/);
  assert.throws(() => context.sendPasswordResetEmail({ ...valid, resetUrl: "https://evil.example/reset-password?token=" + "a".repeat(43) }), /INVALID_URL/);
  assert.throws(() => context.sendPasswordResetEmail({ ...valid, resetUrl: "https://bigcar-crm.vercel.app/reset-password?token=" + "a".repeat(43) }), /INVALID_URL/);
  assert.throws(() => context.validatePasswordResetEmailInput_({ ...valid, subject: "injected", body: "injected" }), /INVALID_INPUT/);
  assert.equal(sent.length, 0);
});

test("safe logs do not contain recipient, reset URL or token", () => {
  const { context, logs } = fixture();
  context.sendPasswordResetEmail(valid);
  const serialized = JSON.stringify(logs);
  assert.doesNotMatch(serialized, /qa@example\.invalid/);
  assert.doesNotMatch(serialized, /reset-password|aaaaaa/);
  assert.match(serialized, /password_reset_email_sent/);
});

test("mail failure returns bounded retryable result without reserving requestId", () => {
  const { context } = fixture();
  const transport = { sendEmail: () => { throw new Error("fixture failure"); } };
  assert.equal(context.sendPasswordResetEmail(valid, transport).status, "retryable_failure");
  assert.equal(context.sendPasswordResetEmail(valid).status, "sent");
});
