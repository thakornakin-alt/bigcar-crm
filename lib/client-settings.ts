export type BigCarSystemSettings = {
  defaultTeamName: string;
  bookingEmailTo: string;
  bookingEmailCc: string;
  salesEmailTo: string;
  salesEmailCc: string;
  bookingLineGroupId: string;
  salesLineGroupId: string;
};

export const systemSettingsStorageKey = "bigcar-system-settings";
export const bookingLineGroupStorageKey = "bigcar-booking-line-group";
export const salesLineGroupStorageKey = "bigcar-sales-line-group";

export const defaultSystemSettings: BigCarSystemSettings = {
  defaultTeamName: "พี่ลีฟ",
  bookingEmailTo: "RDDUsedcarBooked@segroup.co.th",
  bookingEmailCc: "rongsarit.s@tgh.co.th",
  salesEmailTo: "RDDUsedcarBooked@segroup.co.th",
  salesEmailCc: "rongsarit.s@tgh.co.th",
  bookingLineGroupId: "",
  salesLineGroupId: ""
};

export function normalizeSystemSettings(input: Partial<BigCarSystemSettings> | null | undefined): BigCarSystemSettings {
  return {
    defaultTeamName: String(input?.defaultTeamName || defaultSystemSettings.defaultTeamName).trim(),
    bookingEmailTo: String(input?.bookingEmailTo || defaultSystemSettings.bookingEmailTo).trim(),
    bookingEmailCc: String(input?.bookingEmailCc || defaultSystemSettings.bookingEmailCc).trim(),
    salesEmailTo: String(input?.salesEmailTo || defaultSystemSettings.salesEmailTo).trim(),
    salesEmailCc: String(input?.salesEmailCc || defaultSystemSettings.salesEmailCc).trim(),
    bookingLineGroupId: String(input?.bookingLineGroupId || "").trim(),
    salesLineGroupId: String(input?.salesLineGroupId || "").trim()
  };
}

export function readSystemSettings(): BigCarSystemSettings {
  if (typeof window === "undefined") return defaultSystemSettings;

  try {
    return normalizeSystemSettings(JSON.parse(window.localStorage.getItem(systemSettingsStorageKey) || "{}"));
  } catch {
    return defaultSystemSettings;
  }
}

export function writeSystemSettings(settings: BigCarSystemSettings) {
  if (typeof window === "undefined") return;

  const normalized = normalizeSystemSettings(settings);
  window.localStorage.setItem(systemSettingsStorageKey, JSON.stringify(normalized));

  if (normalized.bookingLineGroupId) {
    window.localStorage.setItem(bookingLineGroupStorageKey, normalized.bookingLineGroupId);
  }
  if (normalized.salesLineGroupId) {
    window.localStorage.setItem(salesLineGroupStorageKey, normalized.salesLineGroupId);
  }
}
