import type { BookingDeliveryRecord } from "@/lib/types";

type CommissionMonthKey = {
  month: string;
  year: string;
  monthKey: string;
};

type CommissionMonthlyResult = {
  ownerForCommission: string;
  month: string;
  year: string;
  totalCars: number;
  g1Count: number;
  g2Count: number;
  g3Count: number;
  baseCommissionTotal: number;
  stepBonus: number;
  fixedBonus: number;
  quarterlyBonus: number;
  deductionBase: number;
  deductionAmount: number;
  netMonthlyCommission: number;
  totalCommission: number;
  records: BookingDeliveryRecord[];
  excludedRecords: BookingDeliveryRecord[];
  missingGradeRecords: BookingDeliveryRecord[];
  missingOwnerRecords: BookingDeliveryRecord[];
};

type CommissionQuarterlyResult = {
  quarter: 1 | 2 | 3 | 4;
  year: string;
  quarterCount: number;
  bonus: number;
  eligibleRecords: BookingDeliveryRecord[];
  excludedRecords: BookingDeliveryRecord[];
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeGrade(value: unknown) {
  const normalized = text(value).toUpperCase();
  if (normalized === "G1" || normalized === "G2" || normalized === "G3") return normalized;
  return "";
}

function parseDateParts(value: string) {
  const raw = text(value);
  if (!raw) return null;

  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) {
    return {
      year: String(direct.getFullYear()),
      month: String(direct.getMonth() + 1).padStart(2, "0")
    };
  }

  const isoLike = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoLike) {
    return {
      year: isoLike[1],
      month: String(Number(isoLike[2])).padStart(2, "0")
    };
  }

  const slashLike = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashLike) {
    return {
      year: slashLike[3],
      month: String(Number(slashLike[2])).padStart(2, "0")
    };
  }

  return null;
}

export function isCommissionEligible(record: BookingDeliveryRecord) {
  if (!record) return false;
  const status = text(record.status);
  if (status === "ยกเลิก") return false;
  if (status !== "ยอดส่งมอบ" && status !== "ส่งมอบแล้ว") return false;
  if (!text(record.deliveryCompletedDate)) return false;
  if (record.countForCommission === false) return false;
  const owner = text((record as BookingDeliveryRecord).ownerForCommission);
  if (!owner || owner === "-") return false;
  if (!normalizeGrade((record as BookingDeliveryRecord).commissionGrade)) return false;
  return true;
}

export function getCommissionMonthKey(deliveryCompletedDate: string): CommissionMonthKey | null {
  const parts = parseDateParts(deliveryCompletedDate);
  if (!parts) return null;
  return {
    month: parts.month,
    year: parts.year,
    monthKey: `${parts.year}-${parts.month}`
  };
}

export function resolveBaseCommission(commissionGrade: "G1" | "G2" | "G3" | "") {
  switch (normalizeGrade(commissionGrade)) {
    case "G1":
      return 5000;
    case "G2":
      return 6000;
    case "G3":
      return 7000;
    default:
      return 0;
  }
}

export function resolveStepBonus(count: number) {
  const stepTable = [
    { min: 20, bonus: 88000 },
    { min: 15, bonus: 77000 },
    { min: 13, bonus: 67000 },
    { min: 11, bonus: 55000 },
    { min: 10, bonus: 45000 },
    { min: 9, bonus: 38000 },
    { min: 8, bonus: 31000 },
    { min: 7, bonus: 23000 },
    { min: 6, bonus: 15000 },
    { min: 5, bonus: 10000 },
    { min: 4, bonus: 5000 }
  ];

  const safeCount = Number(count || 0);
  if (!Number.isFinite(safeCount) || safeCount < 4) return 0;

  for (const step of stepTable) {
    if (safeCount >= step.min) return step.bonus;
  }

  return 0;
}

export function resolveFixedBonus(count: number) {
  const safeCount = Number(count || 0);
  if (!Number.isFinite(safeCount) || safeCount < 3) return 0;
  return 10000;
}

export function resolveQuarterlyBonus(quarterCount: number) {
  const safeCount = Number(quarterCount || 0);
  if (!Number.isFinite(safeCount) || safeCount >= 30) return 15000;
  if (safeCount >= 15) return 10000;
  if (safeCount >= 10) return 5000;
  return 0;
}

export function groupCommissionByOwner(records: BookingDeliveryRecord[]) {
  return records.reduce((groups, record) => {
    if (!isCommissionEligible(record)) return groups;
    const owner = text(record.ownerForCommission);
    const current = groups.get(owner) || [];
    current.push(record);
    groups.set(owner, current);
    return groups;
  }, new Map<string, BookingDeliveryRecord[]>());
}

export function calculateMonthlyCommission(records: BookingDeliveryRecord[], month: string | number, year: string | number): CommissionMonthlyResult[] {
  const targetMonth = String(month).trim().padStart(2, "0");
  const targetYear = String(year).trim();
  const groupedByOwner = new Map<string, BookingDeliveryRecord[]>();
  const excludedRecords: BookingDeliveryRecord[] = [];
  const missingGradeRecords: BookingDeliveryRecord[] = [];
  const missingOwnerRecords: BookingDeliveryRecord[] = [];

  for (const record of records || []) {
    const owner = text(record.ownerForCommission);
    const grade = normalizeGrade(record.commissionGrade);
    const monthKey = getCommissionMonthKey(record.deliveryCompletedDate || "");
    const status = text(record.status);
    const eligibleBase =
      status !== "ยกเลิก" &&
      (status === "ยอดส่งมอบ" || status === "ส่งมอบแล้ว") &&
      Boolean(monthKey) &&
      monthKey?.month === targetMonth &&
      monthKey?.year === targetYear &&
      record.countForCommission !== false;

    if (!eligibleBase) {
      excludedRecords.push(record);
      continue;
    }

    if (!owner || owner === "-") {
      missingOwnerRecords.push(record);
      continue;
    }

    if (!grade) {
      missingGradeRecords.push(record);
      continue;
    }

    const current = groupedByOwner.get(owner) || [];
    current.push(record);
    groupedByOwner.set(owner, current);
  }

  return Array.from(groupedByOwner.entries()).map(([ownerForCommission, eligibleRecords]) => {
    const totalCars = eligibleRecords.length;
    const g1Count = eligibleRecords.filter((record) => normalizeGrade(record.commissionGrade) === "G1").length;
    const g2Count = eligibleRecords.filter((record) => normalizeGrade(record.commissionGrade) === "G2").length;
    const g3Count = eligibleRecords.filter((record) => normalizeGrade(record.commissionGrade) === "G3").length;
    const baseCommissionTotal =
      g1Count * resolveBaseCommission("G1") +
      g2Count * resolveBaseCommission("G2") +
      g3Count * resolveBaseCommission("G3");
    const stepBonus = resolveStepBonus(totalCars);
    const fixedBonus = resolveFixedBonus(totalCars);
    const quarterlyBonus = 0;
    const deductionBase = baseCommissionTotal + stepBonus;
    const deductionAmount = deductionBase * 0.03;
    const netMonthlyCommission = deductionBase - deductionAmount + fixedBonus;
    const totalCommission = netMonthlyCommission + quarterlyBonus;
    const firstKey = getCommissionMonthKey(eligibleRecords[0]?.deliveryCompletedDate || "");

    return {
      ownerForCommission,
      month: firstKey?.month || targetMonth,
      year: firstKey?.year || targetYear,
      totalCars,
      g1Count,
      g2Count,
      g3Count,
      baseCommissionTotal,
      stepBonus,
      fixedBonus,
      quarterlyBonus,
      deductionBase,
      deductionAmount,
      netMonthlyCommission,
      totalCommission,
      records: eligibleRecords,
      excludedRecords,
      missingGradeRecords,
      missingOwnerRecords
    };
  });
}

export function calculateQuarterlyBonus(records: BookingDeliveryRecord[], quarter: 1 | 2 | 3 | 4, year: string | number): CommissionQuarterlyResult {
  const targetYear = String(year).trim();
  const quarterMonths: Record<1 | 2 | 3 | 4, string[]> = {
    1: ["01", "02", "03"],
    2: ["04", "05", "06"],
    3: ["07", "08", "09"],
    4: ["10", "11", "12"]
  };
  const eligibleRecords: BookingDeliveryRecord[] = [];
  const excludedRecords: BookingDeliveryRecord[] = [];

  for (const record of records || []) {
    if (!isCommissionEligible(record)) {
      excludedRecords.push(record);
      continue;
    }

    const key = getCommissionMonthKey(record.deliveryCompletedDate || "");
    if (!key || key.year !== targetYear || !quarterMonths[quarter].includes(key.month)) {
      excludedRecords.push(record);
      continue;
    }

    eligibleRecords.push(record);
  }

  const quarterCount = eligibleRecords.length;
  const bonus = resolveQuarterlyBonus(quarterCount);

  return {
    quarter,
    year: targetYear,
    quarterCount,
    bonus,
    eligibleRecords,
    excludedRecords
  };
}
