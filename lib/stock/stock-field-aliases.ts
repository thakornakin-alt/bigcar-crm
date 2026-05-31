import type { StockVehicle } from "@/lib/types";

export const realStockFieldLabels = {
  location: "Location",
  ownership: "กรรมสิทธิ์",
  reportReturnDate: "วันที่รับรายงานคืน",
  agingGroup: "กลุ่มAging",
  aging: "Aging",
  customerName: "ชื่อลูกค้า",
  vehicleGroup: "กลุ่มรถยนต์",
  plate: "ทะเบียน",
  colorGroup: "กลุ่มสี",
  project: "PROJECT",
  campaign: "CAMPAIGN",
  closedSales: "Closed Sales",
  inspection: "Inspection",
  extendedWarranty: "Extended Warranty",
  status: "สถานะ",
  sellerName: "ชื่อผู้ขาย",
  bookingSaleDate: "วันที่จอง/ขาย",
  year: "ปีจด",
  model: "รุ่นรถยนต์",
  gear: "เกียร์",
  color: "สี",
  mileage: "เลขไมล์",
  salePrice: "ราคาเสนอขายRT",
  pdiStatus: "สถานะปรับสภาพ PDI",
  pdiNote: "หมายเหตุ PDI",
  vin: "เลขตัวถัง",
  engineNo: "เลขเครื่อง",
  financeName: "ไฟแนนซ์"
} as const;

export type RealStockFieldKey = keyof typeof realStockFieldLabels;

export const stockFieldAliases: Record<RealStockFieldKey, string[]> = {
  location: ["parkingLocation", "Location", "location", "สถานที่จอด", "โลเคชั่น"],
  ownership: ["ownership", "กรรมสิทธิ์", "Ownership"],
  reportReturnDate: ["reportReturnDate", "วันที่รับรายงานคืน", "ReportReturnDate", "ReturnedReportDate"],
  agingGroup: ["agingGroup", "กลุ่มAging", "กลุ่ม Aging", "AgingGroup"],
  aging: ["aging", "Aging"],
  customerName: ["customerName", "ชื่อลูกค้า", "CustomerName"],
  vehicleGroup: ["vehicleGroup", "VehicleGroup", "กลุ่มรถยนต์", "กลุ่มรถ"],
  plate: ["plate", "ทะเบียน", "ทะเบียนรถ", "Plate"],
  colorGroup: ["colorGroup", "กลุ่มสี", "ColorGroup"],
  project: ["project", "PROJECT", "Project"],
  campaign: ["campaign", "CAMPAIGN", "Campaign"],
  closedSales: ["closedSales", "Closed Sales", "ClosedSales"],
  inspection: ["inspection", "Inspection"],
  extendedWarranty: ["extendedWarranty", "Extended Warranty", "ExtendedWarranty"],
  status: ["status", "สถานะ", "Status"],
  sellerName: ["sellerName", "ชื่อผู้ขาย", "SaleName", "salesName"],
  bookingSaleDate: ["bookingSaleDate", "วันที่จอง/ขาย", "BookingSaleDate", "SoldDate"],
  year: ["year", "ปีจด", "ปีจดทะเบียน", "Year"],
  model: ["model", "รุ่นรถยนต์", "รุ่นรถ", "Model"],
  gear: ["gear", "เกียร์", "Gear"],
  color: ["color", "สี", "Color"],
  mileage: ["mileage", "เลขไมล์", "Mileage"],
  salePrice: ["salePrice", "ราคาเสนอขายRT", "ราคาเสนอขาย", "SalePrice"],
  pdiStatus: ["pdiStatus", "สถานะปรับสภาพ PDI", "PDIStatus", "PdiStatus"],
  pdiNote: ["pdiNote", "หมายเหตุ PDI", "หมายเหตุPDI", "PdiNote"],
  vin: ["vin", "เลขตัวถัง", "เลขตัวรถ", "VIN", "Chassis"],
  engineNo: ["engineNo", "เลขเครื่อง", "EngineNo", "EngineNumber"],
  financeName: ["financeName", "finance", "ไฟแนนซ์", "บริษัทไฟแนนซ์", "Finance"]
};

export function stockRawValue(vehicle: StockVehicle, key: RealStockFieldKey) {
  const raw = vehicle as StockVehicle & Record<string, unknown>;
  const extra = (raw.extraFields && typeof raw.extraFields === "object" ? (raw.extraFields as Record<string, unknown>) : {}) as Record<string, unknown>;
  const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, "");
  for (const alias of stockFieldAliases[key]) {
    const value = raw[alias];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  for (const alias of stockFieldAliases[key]) {
    const value = extra[alias];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  const extraEntries = Object.entries(extra);
  for (const alias of stockFieldAliases[key]) {
    const normalizedAlias = normalize(alias);
    const matched = extraEntries.find(([extraKey]) => normalize(String(extraKey || "")) === normalizedAlias);
    if (matched && matched[1] !== undefined && matched[1] !== null && String(matched[1]).trim()) {
      return String(matched[1]).trim();
    }
  }
  return "";
}

export function hasStockFieldData(vehicles: StockVehicle[], key: RealStockFieldKey) {
  return vehicles.some((vehicle) => Boolean(stockRawValue(vehicle, key)));
}
