import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export type SalesLeadInput = {
  name: string;
  phone: string;
  vehicleGroup: string;
  budget: string;
  comment: string;
  ownerId?: string;
  ownerName?: string;
};

export type SalesLead = SalesLeadInput & {
  id: string;
  date: string;
  createdAt: string;
  updatedAt: string;
};

type LeadStore = {
  leads: SalesLead[];
};

const dataDir = path.join(process.cwd(), ".data");
const dataFile = path.join(dataDir, "sales-leads.json");

async function readStore(): Promise<LeadStore> {
  try {
    const raw = await readFile(dataFile, "utf8");
    const parsed = JSON.parse(raw) as Partial<LeadStore>;
    return { leads: Array.isArray(parsed.leads) ? parsed.leads : [] };
  } catch {
    return { leads: [] };
  }
}

async function writeStore(store: LeadStore) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(dataFile, JSON.stringify(store, null, 2), "utf8");
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
    budget: String(input.budget || "").trim(),
    comment: String(input.comment || "").trim(),
    ownerId: String(input.ownerId || "").trim(),
    ownerName: String(input.ownerName || "").trim()
  };
}

export async function listSalesLeads() {
  return (await readStore()).leads.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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
