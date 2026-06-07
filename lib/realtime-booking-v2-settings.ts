export const realtimeBookingV2LineGroupStorageKey = "bigcar-realtime-booking-v2-line-group";

export function readRealtimeBookingV2LineGroupId() {
  if (typeof window === "undefined") return "";
  try {
    return String(window.localStorage.getItem(realtimeBookingV2LineGroupStorageKey) || "").trim();
  } catch {
    return "";
  }
}

export function writeRealtimeBookingV2LineGroupId(groupId: string) {
  if (typeof window === "undefined") return;
  const normalized = String(groupId || "").trim();
  if (normalized) {
    window.localStorage.setItem(realtimeBookingV2LineGroupStorageKey, normalized);
  } else {
    window.localStorage.removeItem(realtimeBookingV2LineGroupStorageKey);
  }
}
