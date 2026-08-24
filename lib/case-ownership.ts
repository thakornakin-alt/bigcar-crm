import { compareAndSwapJsonStore, readJsonStoreSnapshot } from "@/lib/json-store";
import type { SalesUser } from "@/lib/types";
import { profileActivityName } from "@/lib/user-profile";

export type CaseOwnershipType = "booking" | "sales" | "approval" | "realtime_booking" | "realtime_booking_v2";

export type CaseOwnership = {
  caseType: CaseOwnershipType;
  caseId: string;
  ownerUserId: string;
  ownerDisplayName: string;
  ownerEmail: string;
  branch: string;
  teamName?: string;
  source: "authenticated_create" | "inherited_booking" | "authorized_reassignment";
  sourceCaseId?: string;
  createdAt: string;
  updatedAt: string;
};

type Store = { version: 1; records: Record<string, CaseOwnership> };
const FILE = "case-ownership.json";
const EMPTY: Store = { version: 1, records: {} };

function key(caseType: CaseOwnershipType, caseId: string) {
  return `${caseType}:${caseId}`;
}

export function ownershipFromUser(user: SalesUser, input: {
  caseType: CaseOwnershipType;
  caseId: string;
  teamName?: string;
  source?: CaseOwnership["source"];
  sourceCaseId?: string;
}): CaseOwnership {
  const now = new Date().toISOString();
  return {
    caseType: input.caseType,
    caseId: input.caseId,
    ownerUserId: user.id,
    ownerDisplayName: profileActivityName(user),
    ownerEmail: user.email,
    branch: user.branch || "",
    teamName: input.teamName?.trim() || undefined,
    source: input.source || "authenticated_create",
    sourceCaseId: input.sourceCaseId,
    createdAt: now,
    updatedAt: now
  };
}

export async function getCaseOwnership(caseType: CaseOwnershipType, caseId: string) {
  const snapshot = await readJsonStoreSnapshot(FILE, EMPTY);
  return snapshot.data.records[key(caseType, caseId)] || null;
}

export async function saveCaseOwnership(record: CaseOwnership) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const snapshot = await readJsonStoreSnapshot(FILE, EMPTY);
    const recordKey = key(record.caseType, record.caseId);
    const existing = snapshot.data.records[recordKey];
    if (existing && existing.ownerUserId !== record.ownerUserId && record.source !== "authorized_reassignment") {
      throw new Error("CASE_OWNERSHIP_CONFLICT");
    }
    const next: Store = {
      version: 1,
      records: {
        ...snapshot.data.records,
        [recordKey]: existing
          ? { ...record, createdAt: existing.createdAt, updatedAt: new Date().toISOString() }
          : record
      }
    };
    const result = await compareAndSwapJsonStore(FILE, next, snapshot.revision);
    if (result.updated) return next.records[recordKey];
  }
  throw new Error("CASE_OWNERSHIP_WRITE_CONFLICT");
}

export function salesOwnershipFromBooking(booking: CaseOwnership, salesReportId: string): CaseOwnership {
  const now = new Date().toISOString();
  return {
    ...booking,
    caseType: "sales",
    caseId: salesReportId,
    source: "inherited_booking",
    sourceCaseId: booking.caseId,
    createdAt: now,
    updatedAt: now
  };
}

export function resolveLegacyOwnerByExactName(
  value: string,
  users: SalesUser[]
): SalesUser | null {
  const normalized = value.trim().replace(/\s+/g, " ").toLocaleLowerCase("th-TH");
  if (!normalized) return null;
  const matches = users.filter((user) => {
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
    return fullName.replace(/\s+/g, " ").toLocaleLowerCase("th-TH") === normalized;
  });
  return matches.length === 1 ? matches[0] : null;
}
