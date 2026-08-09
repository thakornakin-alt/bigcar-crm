import type { BookingDeliveryRecord } from "@/lib/types";
import { deriveRddHomeKpis, deriveRddReminders, operationalRddRecords, upcomingRddDeliveries } from "@/lib/rdd-phase2";

export type QaAuditConfidence = "confirmed" | "likely" | "needs_human_confirmation";

export type QaAuditMatch = {
  recordId: string;
  confidence: QaAuditConfidence;
  reasons: string[];
};

const explicitMarker = /(?:\bTEST\b|\bQA\b|PREVIEW\s+(?:TEST|VERIFICATION)|PRODUCTION\s+(?:TEST|SMOKE)|DIAGNOSTICS|TESTPV|TESTV2|PD834CE25|PV834CE25)/i;
const thaiTestName = /^ทดสอบ$/;

export function classifyQaRecord(record: BookingDeliveryRecord): QaAuditMatch | null {
  const candidates: Array<[string, unknown]> = [
    ["customerName", record.customerName],
    ["plate", record.plate],
    ["brand", record.brand],
    ["model", record.model],
    ["source", record.source],
    ["project", record.project],
    ["teamName", record.teamName]
  ];
  const explicit = candidates.filter(([, value]) => explicitMarker.test(String(value || "")));
  const reasons = explicit.map(([field]) => `${field} contains an explicit QA/test marker`);

  if (explicit.some(([field]) => field === "plate") || explicit.length >= 2) {
    return { recordId: record.id, confidence: "confirmed", reasons };
  }
  if (explicit.length === 1) {
    return { recordId: record.id, confidence: "likely", reasons };
  }
  if (thaiTestName.test(String(record.customerName || "").trim())) {
    return {
      recordId: record.id,
      confidence: "needs_human_confirmation",
      reasons: ["customerName is exactly ‘ทดสอบ’, but the vehicle and business fields look plausible"]
    };
  }
  return null;
}

export function auditQaRecords(records: readonly BookingDeliveryRecord[]) {
  return records.map(classifyQaRecord).filter((item): item is QaAuditMatch => item !== null);
}

export function dryRunQaMetadata(
  records: readonly BookingDeliveryRecord[],
  confirmedIds: readonly string[],
  year: number,
  month: number,
  today: string
) {
  const confirmed = new Set(confirmedIds);
  const simulated = records.map((record) => confirmed.has(record.id)
    ? { ...record, qaTestRecord: true, excludeFromMetrics: true }
    : { ...record });
  const summarize = (items: BookingDeliveryRecord[]) => ({
    totalOperationalRecords: operationalRddRecords(items).length,
    ...deriveRddHomeKpis(items, year, month),
    reminders: deriveRddReminders(items, today).map((item) => ({ kind: item.kind, count: item.count })),
    upcomingDelivery: upcomingRddDeliveries(items, today).length
  });
  return { current: summarize([...records]), expected: summarize(simulated), simulated };
}
