import type { SalesUser } from "@/lib/types";
import { canonicalSalespersonDisplayName, type CanonicalSalespersonCapture } from "@/lib/commission-canonical-capture";

function text(value: unknown) {
  return String(value ?? "").trim();
}

export class BookingOwnerSelectionError extends Error {
  constructor(public status: 400 | 403, message: string) {
    super(message);
    this.name = "BookingOwnerSelectionError";
  }
}

export type BookingOwnerSelection = {
  owner: SalesUser;
  saleName: string;
  salesperson: CanonicalSalespersonCapture;
};

function canonicalBookingSaleName(user: SalesUser) {
  return text(user.firstName) || text(user.nickname) || [text(user.firstName), text(user.lastName)].filter(Boolean).join(" ") || text(user.email);
}

/** Resolve a requested Booking owner without trusting browser display text. */
export function resolveBookingOwnerSelection(input: {
  actor: SalesUser;
  requestedOwnerUserId?: unknown;
  canonicalUsers?: readonly SalesUser[];
}): BookingOwnerSelection {
  const requestedOwnerUserId = text(input.requestedOwnerUserId);
  const isAdmin = input.actor.role === "admin" || input.actor.role === "super_admin";

  if (!isAdmin) {
    if (requestedOwnerUserId && requestedOwnerUserId !== input.actor.id) {
      throw new BookingOwnerSelectionError(403, "ไม่สามารถเลือกเจ้าของเคสเป็นผู้ใช้อื่นได้");
    }
    return {
      owner: input.actor,
      saleName: canonicalBookingSaleName(input.actor),
      salesperson: {
        salespersonUserId: input.actor.id,
        salespersonDisplayName: canonicalSalespersonDisplayName(input.actor)
      }
    };
  }

  if (!requestedOwnerUserId) {
    throw new BookingOwnerSelectionError(400, "กรุณาเลือกเซลส์เจ้าของเคส");
  }
  const owner = input.canonicalUsers?.find((user) => user.id === requestedOwnerUserId);
  if (!owner || owner.role !== "sales" || owner.locked) {
    throw new BookingOwnerSelectionError(400, "เซลส์เจ้าของเคสไม่ถูกต้องหรือไม่พร้อมใช้งาน");
  }
  return {
    owner,
    saleName: canonicalBookingSaleName(owner),
    salesperson: {
      salespersonUserId: owner.id,
      salespersonDisplayName: canonicalSalespersonDisplayName(owner)
    }
  };
}
