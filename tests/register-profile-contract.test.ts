import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const registerSource = fs.readFileSync(new URL("../app/api/auth/register/route.ts", import.meta.url), "utf8");
const profileSource = fs.readFileSync(new URL("../app/api/profile/route.ts", import.meta.url), "utf8");
const profilePage = fs.readFileSync(new URL("../app/profile/page.tsx", import.meta.url), "utf8");
const authPage = fs.readFileSync(new URL("../app/auth/page.tsx", import.meta.url), "utf8");
const adminUsersRoute = fs.readFileSync(new URL("../app/api/admin/users/route.ts", import.meta.url), "utf8");

test("registration is admin-controlled and rejects client privilege fields", () => {
  assert.match(registerSource, /requireAdmin\(\)/);
  for (const field of ["role", "locked", "active", "ownerUserId", "admin"]) assert.match(registerSource, new RegExp(`"${field}"`));
  assert.match(registerSource, /position: "Sales"/);
  assert.doesNotMatch(authPage, /name="position"/);
  assert.doesNotMatch(authPage, /name="branch"/);
});

test("profile self-service exposes identity but protects admin fields and email", () => {
  for (const field of ["firstName", "lastName", "nickname", "phone"]) assert.match(profilePage, new RegExp(field));
  for (const field of ["role", "branch", "position", "locked", "active", "email"]) assert.match(profileSource, new RegExp(`"${field}"`));
  assert.doesNotMatch(profilePage, /setForm\(\{[\s\S]*position:/);
  assert.match(profilePage, /ลบรูปโปรไฟล์/);
  assert.doesNotMatch(profilePage, /logo-rdd\.png/);
});

test("password material is never returned by profile routes", () => {
  assert.doesNotMatch(registerSource, /PasswordHash|passwordHash|salt/);
  assert.doesNotMatch(profileSource, /PasswordHash|passwordHash|salt/);
});

test("Admin user listing reads the same canonical compatibility profile", () => {
  assert.match(adminUsersRoute, /mergeStoredSalesProfile/);
});
