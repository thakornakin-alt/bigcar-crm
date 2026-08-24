import assert from "node:assert/strict";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const parameters = { N: 32768, r: 8, p: 1, keyLength: 64, maxmem: 64 * 1024 * 1024 };

function derive(password, salt) {
  return new Promise((resolve, reject) => scrypt(password, salt, parameters.keyLength, parameters, (error, result) => error ? reject(error) : resolve(result)));
}

test("approved scrypt parameters accept the correct password and reject a wrong password", async () => {
  const salt = randomBytes(32);
  const verifier = await derive("correct-password", salt);
  const correct = await derive("correct-password", salt);
  const wrong = await derive("wrong-password", salt);
  assert.equal(timingSafeEqual(verifier, correct), true);
  assert.equal(timingSafeEqual(verifier, wrong), false);
});

test("credential source uses versioned scrypt, CAS persistence, and hides secret material", async () => {
  const source = await readFile(path.join(root, "lib/auth-credentials-v2.ts"), "utf8");
  assert.match(source, /AUTH_CREDENTIAL_VERSION = 2/);
  assert.match(source, /N: 32768/);
  assert.match(source, /compareAndSwapJsonStore/);
  assert.match(source, /if \(existing\) return \{ credential: existing, created: false \}/);
  const publicBlock = source.slice(source.indexOf("export function publicCredentialState"));
  assert.doesNotMatch(publicBlock, /salt:/);
  assert.doesNotMatch(publicBlock, /verifier:/);
});

test("login uses v2 exclusively once present and returns one generic error", async () => {
  const source = await readFile(path.join(root, "app/api/auth/login/route.ts"), "utf8");
  const v2Branch = source.slice(source.indexOf("if (existingCredential)"), source.indexOf("const user ="));
  assert.match(v2Branch, /verifyAuthCredentialV2/);
  assert.doesNotMatch(v2Branch.split("} else {")[0], /loginSalesUser/);
  assert.match(source, /Email หรือ Password ไม่ถูกต้อง/);
  assert.match(source, /credential_migrated/);
  assert.doesNotMatch(source, /console\.(?:log|warn|error)\([^\n]*(?:password|verifier|salt|token)/i);
});

test("sessions require sessionVersion and API authorization compares current credential state", async () => {
  const session = await readFile(path.join(root, "lib/auth-session.ts"), "utf8");
  const edge = await readFile(path.join(root, "lib/edge-session.ts"), "utf8");
  const requestUser = await readFile(path.join(root, "lib/request-user.ts"), "utf8");
  assert.match(session, /Valid sessionVersion is required/);
  assert.match(edge, /!Number\.isInteger\(parsed\.sessionVersion\)/);
  assert.match(requestUser, /credential\.sessionVersion !== session\.sessionVersion/);
});

test("legacy UX bypass is removed and unauthenticated profile is not an admin", async () => {
  const loginPage = await readFile(path.join(root, "app/page.tsx"), "utf8");
  const profile = await readFile(path.join(root, "app/profile/page.tsx"), "utf8");
  const crm = await readFile(path.join(root, "app/crm/page.tsx"), "utf8");
  const adminCrm = await readFile(path.join(root, "app/admin/crm/page.tsx"), "utf8");
  assert.doesNotMatch(loginPage, /เข้าระบบเดิม/);
  assert.doesNotMatch(profile, /demoCurrentUser/);
  assert.doesNotMatch(crm, /demoCurrentUser/);
  assert.doesNotMatch(adminCrm, /demoCurrentUser/);
  assert.match(profile, /role: "viewer"/);
  assert.match(profile, /ยังไม่ได้เข้าสู่ระบบ/);
  assert.match(crm, /redirect\("\/dashboard"\)/);
  assert.match(adminCrm, /redirect\("\/admin\/users"\)/);
});

test("Apps Script source remains unchanged at the legacy boundary", async () => {
  const canonical = await readFile(path.join(root, "google-apps-script/Code.gs"), "utf8");
  const compact = await readFile(path.join(root, "google-apps-script/Code.compact.gs"), "utf8");
  assert.equal(canonical, compact);
  assert.match(canonical, /function hashPassword\(password,salt\)/);
  assert.doesNotMatch(canonical, /scrypt/);
});
