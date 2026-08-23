import { readJsonStore, writeJsonStore } from "@/lib/json-store";
import type { ReportHistoryItem, SalesUser } from "@/lib/types";

export const SALES_REPORT_QA_CREATE_MODE = "transaction_identity_e2e" as const;
const STORE_FILE = "sales-report-qa-metadata.json";

export type SalesReportQaMetadata = {
  salesReportId: string;
  qaTestRecord: true;
  excludeFromMetrics: true;
  isCounted: false;
  qaTestMarker: string;
  mode: typeof SALES_REPORT_QA_CREATE_MODE;
  createdAt: string;
  createdByUserId: string;
  sourceBookingReportId: string;
  requestId: string;
};

type PendingSalesReportQaMetadata = Omit<SalesReportQaMetadata, "salesReportId"> & {
  salesReportId?: undefined;
};

type SalesReportQaStore = {
  version: 1;
  records: Record<string, SalesReportQaMetadata>;
  pending: Record<string, PendingSalesReportQaMetadata>;
};

const emptyStore = (): SalesReportQaStore => ({ version: 1, records: {}, pending: {} });

export class SalesReportQaError extends Error {
  constructor(public status: 400 | 403 | 503, message: string) {
    super(message);
    this.name = "SalesReportQaError";
  }
}

export function resolveSalesReportQaRequest(
  actor: Pick<SalesUser, "id" | "role">,
  input: { qaCreateMode?: unknown; qaTestMarker?: unknown; bookingReportId?: unknown; requestId: string }
): PendingSalesReportQaMetadata | undefined {
  const mode = String(input.qaCreateMode ?? "").trim();
  if (!mode) return undefined;
  if (mode !== SALES_REPORT_QA_CREATE_MODE) throw new SalesReportQaError(400, "Unknown Sales QA create mode");
  if (actor.role !== "admin" && actor.role !== "super_admin") throw new SalesReportQaError(403, "Admin access required for Sales QA creation");
  const qaTestMarker = String(input.qaTestMarker ?? "").trim();
  if (!/^QA-BOOKING-SALES-DELIVERY-[0-9]{8}(?:-[AB])?$/.test(qaTestMarker)) {
    throw new SalesReportQaError(400, "A valid Sales QA test marker is required");
  }
  const sourceBookingReportId = String(input.bookingReportId ?? "").trim();
  if (!sourceBookingReportId) throw new SalesReportQaError(400, "Sales QA creation requires an exact bookingReportId");
  return {
    qaTestRecord: true,
    excludeFromMetrics: true,
    isCounted: false,
    qaTestMarker,
    mode: SALES_REPORT_QA_CREATE_MODE,
    createdAt: new Date().toISOString(),
    createdByUserId: actor.id,
    sourceBookingReportId,
    requestId: input.requestId
  };
}

export async function reserveSalesReportQaMetadata(metadata: PendingSalesReportQaMetadata) {
  const store = await readJsonStore<SalesReportQaStore>(STORE_FILE, emptyStore());
  const existing = store.pending[metadata.requestId];
  if (existing && (existing.qaTestMarker !== metadata.qaTestMarker || existing.sourceBookingReportId !== metadata.sourceBookingReportId)) {
    throw new SalesReportQaError(400, "Sales QA requestId conflicts with an existing reservation");
  }
  store.pending[metadata.requestId] = existing || metadata;
  await writeJsonStore(STORE_FILE, store);
  return store.pending[metadata.requestId];
}

export async function finalizeSalesReportQaMetadata(requestId: string, salesReportId: string) {
  const store = await readJsonStore<SalesReportQaStore>(STORE_FILE, emptyStore());
  const pending = store.pending[requestId];
  if (!pending) throw new SalesReportQaError(503, "Sales QA exclusion reservation is missing");
  const metadata: SalesReportQaMetadata = { ...pending, salesReportId };
  store.records[salesReportId] = metadata;
  delete store.pending[requestId];
  await writeJsonStore(STORE_FILE, store);
  return metadata;
}

export async function removeSalesReportQaReservation(requestId: string) {
  const store = await readJsonStore<SalesReportQaStore>(STORE_FILE, emptyStore());
  if (!(requestId in store.pending)) return;
  delete store.pending[requestId];
  await writeJsonStore(STORE_FILE, store);
}

export async function getSalesReportQaMetadata(salesReportId: string) {
  const store = await readJsonStore<SalesReportQaStore>(STORE_FILE, emptyStore());
  return store.records[String(salesReportId || "").trim()] || null;
}

export async function applySalesReportQaPolicy(reports: ReportHistoryItem[], options: { includeExcluded?: boolean } = {}) {
  const store = await readJsonStore<SalesReportQaStore>(STORE_FILE, emptyStore());
  const pendingBookingIds = new Set(Object.values(store.pending).map((item) => item.sourceBookingReportId));
  return reports.flatMap((report) => {
    if (report.type !== "sales") return [report];
    const metadata = store.records[report.id];
    const pendingExcluded = !metadata && pendingBookingIds.has(String(report.bookingReportId || ""));
    if (!metadata && !pendingExcluded) return [report];
    const enriched: ReportHistoryItem = {
      ...report,
      qaTestRecord: true,
      excludeFromMetrics: true,
      isCounted: false,
      qaTestMarker: metadata?.qaTestMarker,
      qaMetadataPending: pendingExcluded
    };
    return options.includeExcluded ? [enriched] : [];
  });
}

export function isSalesReportExcludedFromMetrics(report: Pick<ReportHistoryItem, "qaTestRecord" | "excludeFromMetrics" | "isCounted">) {
  return report.qaTestRecord === true || report.excludeFromMetrics === true || report.isCounted === false;
}

export function salesReportQaStoreFileName() {
  return STORE_FILE;
}
