export const DEFAULT_BOOKING_DRAFT_TO = "RDDUsedcarBooked@segroup.co.th";
export const DEFAULT_BOOKING_DRAFT_CC = "rongsarit.s@tgh.co.th";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmailList(value: unknown, fallback = "") {
  const raw = String(value ?? "").trim() || fallback;
  if (!raw) return { ok: true as const, value: "" };
  const recipients = raw.split(/[;,]/).map((item) => item.trim()).filter(Boolean);
  if (!recipients.length || recipients.some((recipient) => !emailPattern.test(recipient))) {
    return { ok: false as const, value: "" };
  }
  return { ok: true as const, value: recipients.join(",") };
}

export function resolveBookingDraftRecipients(input: { to?: unknown; cc?: unknown; bcc?: unknown }) {
  const to = normalizeEmailList(input.to, DEFAULT_BOOKING_DRAFT_TO);
  const cc = normalizeEmailList(input.cc, DEFAULT_BOOKING_DRAFT_CC);
  const bcc = normalizeEmailList(input.bcc);
  if (!to.ok || !cc.ok || !bcc.ok) return { status: "invalid" as const };
  return { status: "resolved" as const, to: to.value, cc: cc.value, bcc: bcc.value };
}
