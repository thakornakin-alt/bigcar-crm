type ExistingFoundation = {
  bookingDate?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  isCounted?: boolean;
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

export function bookingFoundationFromReport(bookingDate: unknown, current?: ExistingFoundation | null) {
  return {
    bookingDate: text(bookingDate) || text(current?.bookingDate) || undefined,
    deliveredAt: text(current?.deliveredAt) || undefined,
    cancelledAt: text(current?.cancelledAt) || undefined,
    isCounted: typeof current?.isCounted === "boolean" ? current.isCounted : true
  };
}

export function mergeBookingFoundation(incoming: ExistingFoundation, current?: ExistingFoundation | null) {
  return {
    bookingDate: text(incoming.bookingDate) || text(current?.bookingDate) || undefined,
    deliveredAt: text(incoming.deliveredAt) || text(current?.deliveredAt) || undefined,
    cancelledAt: text(incoming.cancelledAt) || text(current?.cancelledAt) || undefined,
    isCounted: typeof incoming.isCounted === "boolean"
      ? incoming.isCounted
      : typeof current?.isCounted === "boolean"
        ? current.isCounted
        : true
  };
}

export function preserveCreatedAt(incoming: unknown, current?: unknown) {
  return text(current) || text(incoming) || undefined;
}

export function resolveBookingLifecycleTimestamps(input: {
  workflowStatus: string;
  status: string;
  deliveryDate?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  now: string;
}) {
  return {
    deliveredAt: input.workflowStatus === "ยอดส่งมอบ"
      ? text(input.deliveryDate) || text(input.deliveredAt) || input.now
      : text(input.deliveredAt) || undefined,
    cancelledAt: input.status === "ยกเลิก"
      ? text(input.cancelledAt) || input.now
      : text(input.cancelledAt) || undefined
  };
}
