export const COMMISSION_STATE_LABELS: Record<string, string> = {
  eligible_for_recognition: "พร้อมรับรู้ค่าคอม",
  working: "กำลังดำเนินการ",
  needs_review: "ต้องตรวจสอบ",
  recognition_blocked: "ไม่สามารถนับค่าคอม",
  recognized: "รับรู้ค่าคอมแล้ว",
  excluded: "ไม่นับค่าคอม"
};

export function commissionStateLabel(value: string) {
  return COMMISSION_STATE_LABELS[value] || "ต้องตรวจสอบ";
}
