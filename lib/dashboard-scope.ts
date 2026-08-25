const BANGKOK = "Asia/Bangkok";

export function currentBangkokMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: BANGKOK, year: "numeric", month: "2-digit" }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  return `${year}-${month}`;
}

export function dashboardCacheKey(sessionUserId: string, targetUserId: string, month: string) {
  return `bigcar-dashboard-last-good:v3:${sessionUserId}:${targetUserId}:${month}`;
}

export function clearRetiredDashboardCaches(storage: Pick<Storage, "length" | "key" | "removeItem">) {
  const retiredKeys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key === "bigcar-dashboard-last-good" || key?.startsWith("bigcar-dashboard-last-good:v1:") || key?.startsWith("bigcar-dashboard-last-good:v2:")) {
      retiredKeys.push(key);
    }
  }
  retiredKeys.forEach((key) => storage.removeItem(key));
}
