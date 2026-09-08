import { compareAndSwapJsonStore, readJsonStoreSnapshot } from "./json-store.ts";
import type { BookingFinanceSigningInput } from "./booking-finance-signing.ts";

export type BookingFinanceMetadata = BookingFinanceSigningInput & {
  bookingReportId: string;
  ownerUserId: string;
  stockPrice: string;
  stockPlate: string;
  createdAt: string;
  updatedAt: string;
};

type Store = { version: 1; records: Record<string, BookingFinanceMetadata> };
const FILE = "booking-finance-signing-metadata.json";
const EMPTY: Store = { version: 1, records: {} };

export async function getBookingFinanceMetadata(bookingReportId: string) {
  const snapshot = await readJsonStoreSnapshot(FILE, EMPTY);
  const record = snapshot.data.records[bookingReportId];
  if (!record) return null;
  return {
    ...record,
    financePrice: record.financePrice || record.stockPrice || "",
    financePriceSource: record.financePriceSource || (record.stockPrice ? "stock" : "")
  };
}

export async function saveBookingFinanceMetadata(record: BookingFinanceMetadata) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const snapshot = await readJsonStoreSnapshot(FILE, EMPTY);
    const existing = snapshot.data.records[record.bookingReportId];
    const nextRecord = existing
      ? { ...record, createdAt: existing.createdAt, updatedAt: new Date().toISOString() }
      : record;
    const next: Store = { version: 1, records: { ...snapshot.data.records, [record.bookingReportId]: nextRecord } };
    const result = await compareAndSwapJsonStore(FILE, next, snapshot.revision);
    if (result.updated) return nextRecord;
  }
  throw new Error("BOOKING_FINANCE_METADATA_WRITE_CONFLICT");
}
