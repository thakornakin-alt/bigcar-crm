import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveBookingDraftRecipients } from "../lib/booking-draft-recipients.ts";

test("Booking Draft defaults remain safe", () => {
  assert.deepEqual(resolveBookingDraftRecipients({}), {
    status: "resolved",
    to: "RDDUsedcarBooked@segroup.co.th",
    cc: "rongsarit.s@tgh.co.th",
    bcc: ""
  });
  assert.equal(resolveBookingDraftRecipients({ to: "" }).status, "resolved");
});

test("browser recipient overrides are ignored", () => {
  assert.deepEqual(resolveBookingDraftRecipients({
    to: "Thakornakin@gmail.com",
    cc: "team@example.com",
    bcc: "audit@example.com"
  }), {
    status: "resolved",
    to: "RDDUsedcarBooked@segroup.co.th",
    cc: "rongsarit.s@tgh.co.th",
    bcc: ""
  });
});

test("client removes legacy saved recipients and displays fixed routing", async () => {
  const page = await readFile(new URL("../app/booking-reports/page.tsx", import.meta.url), "utf8");
  assert.match(page, /localStorage\.removeItem\("bigcar-booking-email"\)/);
  assert.doesNotMatch(page, /Field label="To"/);
  assert.doesNotMatch(page, /Field label="CC"/);
  assert.doesNotMatch(page, /Field label="BCC"/);
  assert.match(page, /Draft owner:<\/span> thakornakin@gmail\.com/);
});

test("server keeps auth and overwrites browser recipients from the fixed route", async () => {
  const route = await readFile(new URL("../app/api/email/booking-draft/route.ts", import.meta.url), "utf8");
  assert.match(route, /requireWritableUser\(\)/);
  assert.match(route, /resolveEmailRoute\(\{ eventType: "booking_report_draft"/);
  assert.match(route, /payload\.to = route\.recipient\.to/);
  assert.match(route, /payload\.cc = route\.recipient\.cc/);
  assert.match(route, /payload\.bcc = ""/);
});

test("Apps Script enforces fixed recipients and keeps Sales Draft unchanged", async () => {
  const code = await readFile(new URL("../google-apps-script/Code.gs", import.meta.url), "utf8");
  const mirror = await readFile(new URL("../google-apps-script/Code.compact.gs", import.meta.url), "utf8");
  assert.equal(code, mirror);
  assert.match(code, /function createBookingEmailDraft\(input\)\{var to="RDDUsedcarBooked@segroup\.co\.th",cc="rongsarit\.s@tgh\.co\.th",bcc=""/);
  assert.match(code, /isProtectedAuthAction_\(action\).*createBookingEmailDraft/);
  assert.match(code, /updateBookingEmailStatus\([^\n]+to,cc,bcc/);
  assert.match(code, /function createSalesEmailDraft\(input\)\{var to=String\(input\.to/);
});
