import type { BookingDeliveryRecord, SalesUser } from "@/lib/types";

export const COMMISSION_QA_CREATE_MODE = "commission_synthetic_e2e" as const;

export type QaSyntheticCreateMetadata = {
  qaTestRecord: true;
  excludeFromMetrics: true;
  isCounted: false;
  qaTestMarker: string;
};

type QaSyntheticCreateRequest = {
  qaCreateMode?: unknown;
  qaTestMarker?: unknown;
};

export class QaSyntheticCreateError extends Error {
  status: 400 | 403;

  constructor(status: 400 | 403, message: string) {
    super(message);
    this.status = status;
    this.name = "QaSyntheticCreateError";
  }
}

export function resolveQaSyntheticCreateMetadata(
  actor: Pick<SalesUser, "role">,
  input: QaSyntheticCreateRequest
): QaSyntheticCreateMetadata | undefined {
  const mode = String(input.qaCreateMode ?? "").trim();
  if (!mode) return undefined;
  if (mode !== COMMISSION_QA_CREATE_MODE) {
    throw new QaSyntheticCreateError(400, "Unknown QA create mode");
  }
  if (actor.role !== "admin" && actor.role !== "super_admin") {
    throw new QaSyntheticCreateError(403, "Admin access required for QA synthetic creation");
  }

  const marker = String(input.qaTestMarker ?? "").trim();
  if (!/^BR-COM[0-9A-Z-]+-E2E-[0-9]{8}-[0-9]{3}$/.test(marker)) {
    throw new QaSyntheticCreateError(400, "A valid unique QA test marker is required");
  }

  return {
    qaTestRecord: true,
    excludeFromMetrics: true,
    isCounted: false,
    qaTestMarker: marker
  };
}

export function applyQaSyntheticCreateMetadata(
  record: BookingDeliveryRecord,
  metadata?: QaSyntheticCreateMetadata
): BookingDeliveryRecord {
  if (!metadata) return record;
  return {
    ...record,
    qaTestRecord: true,
    excludeFromMetrics: true,
    isCounted: false,
    qaTestMarker: metadata.qaTestMarker
  };
}
