import { readJsonStore, writeJsonStore } from "@/lib/json-store";

const FILE = "rdd-line-settings.json";

export type RddLineSettings = {
  groupId: string;
  enabled: boolean;
  reminderEnabled: boolean;
  reminderHourBangkok: number;
};

const defaults: RddLineSettings = {
  groupId: "",
  enabled: false,
  reminderEnabled: false,
  reminderHourBangkok: 8
};

export async function getRddLineSettings() {
  const saved = await readJsonStore<Partial<RddLineSettings>>(FILE, defaults);
  return {
    groupId: String(saved.groupId || "").trim(),
    enabled: saved.enabled === true,
    reminderEnabled: saved.reminderEnabled === true,
    reminderHourBangkok: Number.isInteger(saved.reminderHourBangkok) && Number(saved.reminderHourBangkok) >= 0 && Number(saved.reminderHourBangkok) <= 23
      ? Number(saved.reminderHourBangkok) : 8
  } satisfies RddLineSettings;
}

export async function saveRddLineSettings(input: RddLineSettings) {
  const normalized: RddLineSettings = {
    groupId: String(input.groupId || "").trim(),
    enabled: input.enabled === true,
    reminderEnabled: input.reminderEnabled === true,
    reminderHourBangkok: Math.max(0, Math.min(23, Math.trunc(Number(input.reminderHourBangkok) || 0)))
  };
  await writeJsonStore(FILE, normalized);
  return normalized;
}
