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

test("explicit To, CC and BCC are preserved", () => {
  assert.deepEqual(resolveBookingDraftRecipients({
    to: "Thakornakin@gmail.com",
    cc: "team@example.com",
    bcc: "audit@example.com"
  }), {
    status: "resolved",
    to: "Thakornakin@gmail.com",
    cc: "team@example.com",
    bcc: "audit@example.com"
  });
});

test("invalid recipient syntax is rejected", () => {
  assert.equal(resolveBookingDraftRecipients({ to: "not-an-email" }).status, "invalid");
  assert.equal(resolveBookingDraftRecipients({ to: "valid@example.com", cc: "invalid" }).status, "invalid");
  assert.equal(resolveBookingDraftRecipients({ to: "valid@example.com", bcc: "invalid" }).status, "invalid");
});

test("client restores saved recipient before defaults and exposes editable recipient fields", async () => {
  const page = await readFile(new URL("../app/booking-reports/page.tsx", import.meta.url), "utf8");
  assert.match(page, /saved\.emailTo\?\.trim\(\) \|\| settings\.bookingEmailTo \|\| defaultEmailTo/);
  assert.match(page, /saved\.emailCc !== undefined \? saved\.emailCc/);
  assert.match(page, /Field label="To" type="email" value=\{form\.emailTo\}/);
  assert.match(page, /Field label="CC" type="email" value=\{form\.emailCc\}/);
  assert.match(page, /Field label="BCC" type="email" value=\{form\.emailBcc\}/);
});

test("server keeps auth, owner routing and explicit recipient contract", async () => {
  const route = await readFile(new URL("../app/api/email/booking-draft/route.ts", import.meta.url), "utf8");
  assert.match(route, /requireWritableUser\(\)/);
  assert.match(route, /resolveEmailRoute\(\{ eventType: "booking_report_draft"/);
  assert.match(route, /payload\.to = recipients\.to/);
  assert.doesNotMatch(route, /payload\.to = route\.recipient\.to/);
});

test("Apps Script validates input recipients, keeps defaults and signed action", async () => {
  const code = await readFile(new URL("../google-apps-script/Code.gs", import.meta.url), "utf8");
  const mirror = await readFile(new URL("../google-apps-script/Code.compact.gs", import.meta.url), "utf8");
  assert.equal(code, mirror);
  assert.match(code, /bookingDraftEmailList_\(input\.to,"RDDUsedcarBooked@segroup\.co\.th","To"\)/);
  assert.match(code, /bookingDraftEmailList_\(input\.cc,"rongsarit\.s@tgh\.co\.th","CC"\)/);
  assert.match(code, /bookingDraftEmailList_\(input\.bcc,"","BCC"\)/);
  assert.match(code, /isProtectedAuthAction_\(action\).*createBookingEmailDraft/);
  assert.match(code, /updateBookingEmailStatus\([^\n]+to,cc,bcc/);
});
