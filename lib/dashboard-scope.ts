const BANGKOK = "Asia/Bangkok";

export function currentBangkokMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: BANGKOK, year: "numeric", month: "2-digit" }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  return `${year}-${month}`;
}

export function dashboardCacheKey(sessionUserId: string, targetUserId: string, month: string) {
  return `bigcar-dashboard-last-good:v2:${sessionUserId}:${targetUserId}:${month}`;
}
