import { readJsonStore, writeJsonStore } from "@/lib/json-store";

export type SalesLeadInput = {
  name: string;
  phone: string;
  vehicleGroup: string;
  desiredModel?: string;
  budget: string;
  comment: string;
  status?: SalesLeadStatus;
  nextFollowUpDate?: string;
  ownerId?: string;
  ownerName?: string;
};

export type SalesLeadStatus = "new" | "follow_up" | "waiting_stock" | "closed";

export type SalesLead = SalesLeadInput & {
  id: string;
  date: string;
  createdAt: string;
  updatedAt: string;
};

type LeadStore = {
  leads: SalesLead[];
};

const storeFile = "sales-leads.json";

async function readStore(): Promise<LeadStore> {
  const parsed = await readJsonStore<Partial<LeadStore>>(storeFile, { leads: [] });
  return { leads: Array.isArray(parsed.leads) ? parsed.leads : [] };
}

async function writeStore(store: LeadStore) {
  await writeJsonStore(storeFile, store);
}

export function normalizeLeadGroup(value: string, availableGroups: string[] = []) {
  const raw = String(value || "").trim();
  const compact = normalizeText(raw);
  const exact = availableGroups.find((group) => normalizeText(group) === compact);
  if (exact) return exact;

  if (/(van|รถตู้|commuter|คอมมิวเตอร์|ตู้)/i.test(raw)) return findGroup(availableGroups, ["van"]) || "VAN";
  if (/(prerunner|ยกสูง|4wd|ขับ4|โฟวิว|โฟร์วิว|กระบะ|revo|รีโว่)/i.test(raw)) {
    return findGroup(availableGroups, ["pick", "cab"]) || "PICK-UP CAB";
  }
  if (/(suv|fortuner|ฟอร์จูน|ppv)/i.test(raw)) return findGroup(availableGroups, ["suv"]) || "SUV";
  return raw;
}

function normalizeText(value: string) {
  return String(value || "").toLowerCase().replace(/\s+/g, "");
}

function findGroup(groups: string[], keywords: string[]) {
  return groups.find((group) => keywords.every((keyword) => normalizeText(group).includes(normalizeText(keyword))));
}

function today() {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
}

function cleanLead(input: SalesLeadInput): SalesLeadInput {
  return {
    name: String(input.name || "").trim(),
    phone: String(input.phone || "").trim(),
    vehicleGroup: String(input.vehicleGroup || "").trim(),
    desiredModel: String(input.desiredModel || "").trim(),
    budget: String(input.budget || "").trim(),
    comment: String(input.comment || "").trim(),
    status: normalizeLeadStatus(input.status),
    nextFollowUpDate: cleanIsoDate(input.nextFollowUpDate),
    ownerId: String(input.ownerId || "").trim(),
    ownerName: String(input.ownerName || "").trim()
  };
}

function normalizeLeadStatus(value?: string): SalesLeadStatus {
  if (value === "follow_up" || value === "waiting_stock" || value === "closed") return value;
  return "new";
}

function cleanIsoDate(value?: string) {
  const date = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
}

function normalizeLead(lead: SalesLead): SalesLead {
  return {
    ...lead,
    desiredModel: String(lead.desiredModel || "").trim(),
    status: normalizeLeadStatus(lead.status),
    nextFollowUpDate: cleanIsoDate(lead.nextFollowUpDate)
  };
}

export async function listSalesLeads() {
  return (await readStore()).leads.map(normalizeLead).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addSalesLead(input: SalesLeadInput) {
  const clean = cleanLead(input);
  if (!clean.name || !clean.phone || !clean.vehicleGroup) throw new Error("กรุณากรอกชื่อ เบอร์ และกลุ่มรถยนต์");

  const now = new Date().toISOString();
  const lead: SalesLead = {
    ...clean,
    id: `LEAD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: today(),
    createdAt: now,
    updatedAt: now
  };

  const store = await readStore();
  store.leads.unshift(lead);
  await writeStore(store);
  return lead;
}
