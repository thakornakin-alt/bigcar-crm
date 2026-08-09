import type { BookingDeliveryRecord, SalesUser } from "@/lib/types";

export const RDD_METADATA_VERSION = 1;

export type BookingDeliveryActor = Pick<SalesUser, "id"> & Partial<Pick<SalesUser, "nickname" | "firstName" | "lastName" | "email">>;

export function actorOwnerName(user: BookingDeliveryActor) {
  return [user.nickname, user.firstName, user.lastName].filter(Boolean).join(" / ") || String(user.email || "").trim();
}

export function normalizeWorkspaceRecord(record: BookingDeliveryRecord): BookingDeliveryRecord {
  return {
    ...record,
    ownerUserId: String(record.ownerUserId || "").trim() || undefined,
    ownerName: String(record.ownerName || "").trim() || undefined,
    collaboratorUserIds: Array.isArray(record.collaboratorUserIds)
      ? record.collaboratorUserIds.map((id) => String(id || "").trim()).filter(Boolean)
      : undefined,
    recordVersion: Number.isInteger(record.recordVersion) && Number(record.recordVersion) >= 0
      ? Number(record.recordVersion)
      : 0,
    metadataVersion: Number.isInteger(record.metadataVersion) ? record.metadataVersion : 0,
    qaTestRecord: typeof record.qaTestRecord === "boolean" ? record.qaTestRecord : undefined,
    excludeFromMetrics: typeof record.excludeFromMetrics === "boolean" ? record.excludeFromMetrics : undefined,
    archivedAt: String(record.archivedAt || "").trim() || undefined,
    archiveReason: String(record.archiveReason || "").trim() || undefined
  };
}

export function attachOwnerToNewRecord(record: BookingDeliveryRecord, actor?: BookingDeliveryActor | null) {
  if (!actor?.id || record.ownerUserId) return normalizeWorkspaceRecord(record);
  return normalizeWorkspaceRecord({
    ...record,
    ownerUserId: actor.id,
    ownerName: actorOwnerName(actor),
    collaboratorUserIds: record.collaboratorUserIds || [],
    recordVersion: Math.max(1, Number(record.recordVersion || 0)),
    metadataVersion: RDD_METADATA_VERSION
  });
}

export function incrementRecordVersion(record: BookingDeliveryRecord) {
  const normalized = normalizeWorkspaceRecord(record);
  return { ...normalized, recordVersion: (normalized.recordVersion || 0) + 1, metadataVersion: RDD_METADATA_VERSION };
}
