import { listStockVehicles } from "@/lib/apps-script";
import { listSalesLeads, normalizeLeadGroup, type SalesLead } from "@/lib/leads";
import type { StockVehicle } from "@/lib/types";

export type StockLeadMatch = {
  id: string;
  lead: SalesLead;
  vehicle: StockVehicle;
  score: number;
  reasons: string[];
};

function normalizeText(value: string) {
  return String(value || "").toLowerCase().replace(/\s+/g, "");
}

function money(value: string) {
  const n = Number(String(value || "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function budgetRange(value: string) {
  const nums = String(value || "")
    .replace(/,/g, "")
    .match(/\d+/g)
    ?.map(Number)
    .filter((n) => Number.isFinite(n) && n > 0) || [];

  if (!nums.length) return { min: 0, max: 0 };
  if (nums.length === 1) return { min: 0, max: nums[0] };
  return { min: Math.min(nums[0], nums[1]), max: Math.max(nums[0], nums[1]) };
}

function isLikelyAvailable(vehicle: StockVehicle) {
  const status = normalizeText(vehicle.status || "");
  if (!status) return true;
  return /(รอขาย|พร้อมขาย|available)/i.test(status);
}

function vehicleText(vehicle: StockVehicle) {
  return [vehicle.brand, vehicle.model, vehicle.vehicleGroup, vehicle.year, vehicle.color, vehicle.parkingLocation].join(" ");
}

function matchOne(lead: SalesLead, vehicle: StockVehicle, groups: string[]): StockLeadMatch | null {
  const reasons: string[] = [];
  let score = 0;
  const leadGroup = normalizeLeadGroup(lead.vehicleGroup, groups);
  const vehicleGroup = String(vehicle.vehicleGroup || "").trim();
  const vehicleGroupText = normalizeText(vehicleGroup);
  const leadGroupText = normalizeText(leadGroup);
  const fullVehicleText = normalizeText(vehicleText(vehicle));
  const commentText = normalizeText(`${lead.vehicleGroup} ${lead.comment}`);

  if (leadGroupText && (vehicleGroupText === leadGroupText || fullVehicleText.includes(leadGroupText))) {
    score += 55;
    reasons.push("ตรงกลุ่มรถ");
  } else if (commentText && fullVehicleText.includes(commentText)) {
    score += 30;
    reasons.push("ตรงคำค้นในคอมเมนต์");
  }

  const range = budgetRange(lead.budget);
  const price = money(vehicle.salePrice);
  if (price && range.max) {
    if (price <= range.max && (!range.min || price >= range.min)) {
      score += 30;
      reasons.push("ตรงงบประมาณ");
    } else if (price <= range.max * 1.08) {
      score += 12;
      reasons.push("ใกล้งบประมาณ");
    }
  }

  if (isLikelyAvailable(vehicle)) {
    score += 10;
    reasons.push("รถพร้อมเสนอ");
  }

  if (score < 45) return null;

  return {
    id: `${lead.id}-${vehicle.plate}`,
    lead,
    vehicle,
    score,
    reasons
  };
}

export async function listStockLeadMatches() {
  const [leads, stock] = await Promise.all([
    listSalesLeads(),
    listStockVehicles({ limit: 1000 }).catch(() => ({ vehicles: [] as StockVehicle[] }))
  ]);
  const vehicles = stock.vehicles || [];
  const groups = Array.from(new Set(vehicles.map((vehicle) => String(vehicle.vehicleGroup || "").trim()).filter(Boolean)));
  const matches: StockLeadMatch[] = [];

  for (const lead of leads) {
    for (const vehicle of vehicles) {
      const match = matchOne(lead, vehicle, groups);
      if (match) matches.push(match);
    }
  }

  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, 80);
}
