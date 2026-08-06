export type OwnershipScope = "all" | "mine" | "unassigned";

export type OwnedRecord = { ownerUserId?: string; ownerId?: string };

export function ownershipScope(value: unknown): OwnershipScope {
  if (value === "mine" || value === "unassigned") return value;
  return "all";
}

export function recordOwnerId(record: OwnedRecord) {
  return String(record.ownerUserId || record.ownerId || "").trim();
}

export function filterByOwnership<T extends OwnedRecord>(records: T[], scope: OwnershipScope, userId: string) {
  if (scope === "all") return records;
  if (scope === "unassigned") return records.filter((record) => !recordOwnerId(record));
  return records.filter((record) => recordOwnerId(record) === userId);
}

