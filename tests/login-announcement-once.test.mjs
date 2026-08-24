import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const loginPage = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

test("login announcement uses one stable versioned localStorage key", () => {
  assert.match(loginPage, /bigcar-login-announcement-v1-seen/);
  assert.match(loginPage, /localStorage\.getItem\(loginAnnouncementSeenKey\)/);
  assert.match(loginPage, /localStorage\.setItem\(loginAnnouncementSeenKey, "1"\)/);
  assert.doesNotMatch(loginPage, /7\s*day|7\s*วัน|expiresAt|setTimeout\([^)]*604800/i);
});

test("all announcement exits store seen state and registration uses the existing route", () => {
  assert.match(loginPage, /onClick=\{closeAnnouncement\}[\s\S]*?aria-label="ปิดประกาศ"/);
  assert.match(loginPage, /onClick=\{closeAnnouncement\}[\s\S]*?ไว้ทีหลัง/);
  assert.match(loginPage, /function openRegistration\(\)[\s\S]*?closeAnnouncement\(\);[\s\S]*?router\.push\("\/auth"\)/);
});

test("announcement remains UI-only and does not change authentication requests", () => {
  assert.match(loginPage, /fetch\("\/api\/auth\/me"/);
  assert.match(loginPage, /fetch\("\/api\/auth\/login"/);
  assert.doesNotMatch(loginPage, /fetch\([^\n]*(announcement|SalesUsers|google)/i);
});
