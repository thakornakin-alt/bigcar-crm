import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const service = fs.readFileSync(new URL("../lib/password-reset.ts", import.meta.url), "utf8");
const credential = fs.readFileSync(new URL("../lib/auth-credentials-v2.ts", import.meta.url), "utf8");
const forgotRoute = fs.readFileSync(new URL("../app/api/auth/forgot-password/route.ts", import.meta.url), "utf8");
const resetRoute = fs.readFileSync(new URL("../app/api/auth/reset-password/route.ts", import.meta.url), "utf8");
const loginPage = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const forgotPage = fs.readFileSync(new URL("../app/forgot-password/page.tsx", import.meta.url), "utf8");
const resetPage = fs.readFileSync(new URL("../app/reset-password/page.tsx", import.meta.url), "utf8");

test("reset token is 256-bit, hashed, versioned, one-time, and short lived", () => {
  assert.match(service, /randomBytes\(32\)\.toString\("base64url"\)/);
  assert.match(service, /createHash\("sha256"\)/);
  assert.match(service, /TOKEN_TTL_MS = 15 \* 60 \* 1000/);
  assert.match(service, /version: 1/);
  assert.match(service, /status: "processing"/);
  assert.match(service, /status: key === tokenHash \? "used"/);
  assert.doesNotMatch(service, /tokens:\s*\{[^}]*rawToken/);
});

test("forgot password is generic and rate limited without account enumeration", () => {
  assert.match(service, /ACCOUNT_COOLDOWN_MS = 60 \* 1000/);
  assert.match(service, /ACCOUNT_MAX_PER_HOUR = 5/);
  assert.match(service, /SOURCE_MAX_PER_HOUR = 20/);
  assert.match(service, /if \(!account\)[\s\S]*return \{ message: genericMessage \}/);
  assert.match(forgotRoute, /PASSWORD_RESET_GENERIC_MESSAGE/);
});

test("email uses canonical account and trusted Preview URL through v63 sender", () => {
  assert.match(service, /recipientEmail: account\.email/);
  assert.match(service, /sendPasswordResetEmail/);
  assert.match(service, /VERCEL_ENV !== "preview"/);
  assert.match(service, /reset-password\?token=/);
  assert.doesNotMatch(service, /headers\.get\("host"\)|x-forwarded-host/i);
});

test("email failure invalidates token and user response remains generic", () => {
  assert.match(service, /password_reset_email_failed/);
  assert.match(service, /status: "invalidated"/);
  assert.match(forgotRoute, /return NextResponse\.json\(\{ message: PASSWORD_RESET_GENERIC_MESSAGE \}\)/);
});

test("reset atomically claims token then updates one v2 credential and sessionVersion", () => {
  assert.match(service, /compareAndSwapJsonStore/);
  assert.match(service, /resetAuthCredentialV2/);
  assert.match(credential, /replacement\.sessionVersion = \(existing\?\.sessionVersion \|\| 0\) \+ 1/);
  assert.match(service, /credentialWritten = true/);
  assert.match(service, /if \(!credentialWritten\)/);
  assert.match(service, /if \(!finalized\) throw/);
});

test("reset API and UI enforce ten characters and fresh login", () => {
  assert.match(service, /newPassword\)\.length < 10/);
  assert.match(resetRoute, /ตั้งรหัสผ่านใหม่สำเร็จ กรุณาเข้าสู่ระบบ/);
  assert.match(resetPage, /minLength=\{10\}/);
  assert.match(resetPage, /รหัสผ่านทั้งสองช่องไม่ตรงกัน/);
  assert.match(resetPage, /ขอลิงก์ใหม่/);
});

test("login exposes Forgot Password and both pages have bounded mobile layout", () => {
  assert.match(loginPage, /href="\/forgot-password"/);
  assert.match(forgotPage, /max-w-md/);
  assert.match(resetPage, /max-w-md/);
  assert.match(forgotPage, /ลืมรหัสผ่าน/);
});

test("security logs never include token, password, verifier, or cookie values", () => {
  const logCalls = [...service.matchAll(/console\.(?:info|error)\(([^\n]+)/g)].map((match) => match[1]).join("\n");
  assert.doesNotMatch(logCalls, /rawToken|tokenHash|newPassword|verifier|salt|cookie/i);
});
