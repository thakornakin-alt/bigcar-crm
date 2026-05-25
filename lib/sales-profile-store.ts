import { readJsonStore, writeJsonStore } from "@/lib/json-store";
import type { SalesUser } from "@/lib/types";

type SalesProfileStore = {
  users: Record<string, SalesUser>;
  emailIndex: Record<string, string>;
};

const storeFile = "sales-profiles.json";

function blankStore(): SalesProfileStore {
  return { users: {}, emailIndex: {} };
}

function normalizeEmail(value: string) {
  return String(value || "").trim().toLowerCase();
}

async function readStore() {
  const parsed = await readJsonStore<Partial<SalesProfileStore>>(storeFile, blankStore());
  return {
    users: parsed.users && typeof parsed.users === "object" ? parsed.users : {},
    emailIndex: parsed.emailIndex && typeof parsed.emailIndex === "object" ? parsed.emailIndex : {}
  };
}

export async function saveSalesProfile(user: SalesUser) {
  const now = new Date().toISOString();
  const clean: SalesUser = {
    ...user,
    updatedAt: user.updatedAt || now
  };

  try {
    const store = await readStore();
    store.users[clean.id] = clean;
    if (clean.email) store.emailIndex[normalizeEmail(clean.email)] = clean.id;
    await writeJsonStore(storeFile, store);
  } catch (error) {
    console.warn("Unable to mirror sales profile", error);
  }

  return clean;
}

export async function getSalesProfileById(id: string) {
  const safeId = String(id || "").trim();
  if (!safeId) return null;
  try {
    const store = await readStore();
    return store.users[safeId] || null;
  } catch {
    return null;
  }
}

export async function getSalesProfileByEmail(email: string) {
  const key = normalizeEmail(email);
  if (!key) return null;
  try {
    const store = await readStore();
    const id = store.emailIndex[key];
    return id ? store.users[id] || null : null;
  } catch {
    return null;
  }
}

export async function mergeStoredSalesProfile(user: SalesUser | null) {
  if (!user) return null;
  const stored = await getSalesProfileById(user.id);
  return stored ? { ...user, ...stored } : user;
}
