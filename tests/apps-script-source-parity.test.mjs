import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const canonical = fs.readFileSync(new URL("../google-apps-script/Code.gs", import.meta.url), "utf8");
const compact = fs.readFileSync(new URL("../google-apps-script/Code.compact.gs", import.meta.url), "utf8");

test("Code.gs and Code.compact.gs are exact deployment mirrors", () => {
  assert.equal(compact, canonical);
});

test("transaction identity and duplicate protection remain in both mirrors", () => {
  for (const source of [canonical, compact]) {
    assert.match(source, /bookingReportId:String\(r\[4\]\|\|""\)/);
    assert.match(source, /hasReportDuplicate_\(s,SALES_HEADERS,r\.plate\)/);
    assert.match(source, /function hasReportDuplicate_\(/);
  }
});

test("authoritative CAR GROUP lookup remains narrow and traceable", () => {
  for (const source of [canonical, compact]) {
    assert.match(source, /function lookupBookingListCommissionGroup\(/);
    assert.match(source, /sourceReference:"booking_list:row:"\+match\.rowNumber/);
    assert.match(source, /group!=="G1"&&group!=="G2"&&group!=="G3"/);
  }
});

test("SalesUsers phone writer preserves text identifiers", () => {
  for (const source of [canonical, compact]) {
    assert.match(source, /setNumberFormat\("@"\)\.setValue\(String\(phone\|\|""\)\.trim\(\)\)/);
    assert.match(source, /registerSalesUser[\s\S]*writeSalesUserPhoneAsText/);
    assert.match(source, /updateSalesUser[\s\S]*writeSalesUserPhoneAsText/);
  }
});

test("sheet headers and API label remain locked", () => {
  assert.match(canonical, /API_VERSION="2026-08-13-01"/);
  assert.match(canonical, /BOOKING_LIST_SHEET_NAME="Booking List"/);
  assert.match(canonical, /SALES_HEADERS=\["Id","CreatedAt","UpdatedAt","Status","BookingReportId"/);
});
