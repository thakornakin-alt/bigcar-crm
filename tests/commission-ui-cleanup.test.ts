import test from "node:test";
import assert from "node:assert/strict";
import { commissionStateLabel } from "../lib/commission-ui.ts";

test("Commission operational states have user-facing Thai labels", () => {
  assert.equal(commissionStateLabel("eligible_for_recognition"), "พร้อมรับรู้ค่าคอม");
  assert.equal(commissionStateLabel("working"), "กำลังดำเนินการ");
  assert.equal(commissionStateLabel("needs_review"), "ต้องตรวจสอบ");
  assert.equal(commissionStateLabel("recognition_blocked"), "ไม่สามารถนับค่าคอม");
  assert.equal(commissionStateLabel("recognized"), "รับรู้ค่าคอมแล้ว");
  assert.equal(commissionStateLabel("excluded"), "ไม่นับค่าคอม");
});
