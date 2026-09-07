import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseSelfRegistration } from "../lib/self-register.ts";
import { registerSelfSalesUser, SelfRegisterError } from "../lib/self-register-service.ts";
import type { SalesUser } from "../lib/types.ts";

const valid = {
  firstName: "สมชาย",
  lastName: "ใจดี",
  nickname: "ชาย",
  phone: "081-234-5678",
  email: "  USER@Example.COM ",
  password: "correct-password"
};

test("self registration normalizes identity and fixes non-privileged defaults", () => {
  const parsed = parseSelfRegistration(valid);
  assert.equal(parsed.email, "user@example.com");
  assert.equal(parsed.position, "Sales");
  assert.equal(parsed.branch, "ไม่ระบุ");
  assert.equal(parsed.password, valid.password);
  assert.equal("role" in parsed, false);
  assert.equal("locked" in parsed, false);
  assert.equal("permissions" in parsed, false);
});

test("self registration rejects every privilege-related client field", () => {
  for (const field of ["role", "active", "locked", "admin", "super_admin", "ownerUserId", "branch", "position", "permissions"]) {
    assert.throws(() => parseSelfRegistration({ ...valid, [field]: field === "role" ? "admin" : true }), /ไม่สามารถกำหนดสิทธิ์/);
  }
});

test("self registration rejects passwords shorter than eight characters", () => {
  assert.throws(() => parseSelfRegistration({ ...valid, password: "1234567" }), /อย่างน้อย 8/);
});

function salesUser(overrides: Partial<SalesUser> = {}): SalesUser {
  return {
    id: "USER-SELF-1", createdAt: "2026-09-08T00:00:00.000Z", updatedAt: "2026-09-08T00:00:00.000Z",
    email: "user@example.com", firstName: "สมชาย", lastName: "ใจดี", nickname: "ชาย", phone: "0812345678",
    lineId: "", lineQrUrl: "", avatarUrl: "", position: "Sales", branch: "ไม่ระบุ", role: "sales", locked: false,
    ...overrides
  };
}

test("valid self registration creates one Sales user, Credential V2, and canonical profile", async () => {
  const calls: string[] = [];
  const created = await registerSelfSalesUser(valid, {
    listUsers: async () => [salesUser({ id: "EXISTING", email: "existing@example.com" })],
    registerUser: async (input) => { calls.push(`register:${input.email}:${input.position}:${input.branch}`); return salesUser(); },
    createCredential: async (userId, password) => { calls.push(`credential:${userId}:${password.length}`); return { created: true }; },
    saveProfile: async (user) => { calls.push(`profile:${user.id}`); return user; }
  });
  assert.equal(created.role, "sales");
  assert.deepEqual(calls, ["register:user@example.com:Sales:ไม่ระบุ", "credential:USER-SELF-1:16", "profile:USER-SELF-1"]);
});

test("duplicate normalized email is rejected before account creation", async () => {
  let created = false;
  await assert.rejects(registerSelfSalesUser(valid, {
    listUsers: async () => [salesUser({ email: "USER@example.com" })],
    registerUser: async () => { created = true; return salesUser(); },
    createCredential: async () => { throw new Error("must not run"); },
    saveProfile: async (user) => user
  }), (error: unknown) => error instanceof SelfRegisterError && error.status === 409);
  assert.equal(created, false);
});

test("non-Sales or locked result fails closed", async () => {
  for (const returned of [salesUser({ role: "admin" }), salesUser({ role: "super_admin" }), salesUser({ locked: true })]) {
    await assert.rejects(registerSelfSalesUser(valid, {
      listUsers: async () => [salesUser({ id: "EXISTING", email: "existing@example.com" })],
      registerUser: async () => returned,
      createCredential: async () => { throw new Error("must not run"); },
      saveProfile: async (user) => user
    }), /ไม่สามารถสร้างบัญชี Sales/);
  }
});

test("public route is additive and existing admin registration remains protected", async () => {
  const [route, adminRoute, registerPage, loginPage, homePage] = await Promise.all([
    readFile(new URL("../app/api/auth/self-register/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/register/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/register/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/auth/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8")
  ]);
  assert.match(adminRoute, /requireAdmin\(\)/);
  assert.doesNotMatch(route, /requireAdmin|requireUser/);
  assert.match(route, /registerSelfSalesUser\(body,/);
  assert.match(route, /createCredential: createAuthCredentialV2IfMissing/);
  assert.match(route, /อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบ/);
  assert.match(route, /role: "sales", locked: false/);
  assert.match(registerPage, /fetch\("\/api\/auth\/self-register"/);
  assert.match(registerPage, /router\.push\(`\/auth\?registered=1&email=/);
  assert.doesNotMatch(registerPage, /name="(?:role|active|locked|branch|position|permissions)"/);
  assert.match(loginPage, /href="\/register"/);
  assert.match(homePage, /href="\/register"/);
  assert.match(homePage, /router\.push\("\/register"\)/);
});
