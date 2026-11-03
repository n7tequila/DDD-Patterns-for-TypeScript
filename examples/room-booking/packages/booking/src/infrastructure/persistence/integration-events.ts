import type { BookingIntegrationEvent } from "@example/contracts";
import { assertNever, type EpochMillis } from "@example/shared-kernel";
import type { BookingEvent } from "../../domain/booking";

/** Assembler: domain event -> published contract. Returns undefined for events that stay internal. */
export function toIntegrationEvent(event: BookingEvent, eventId: string, occurredAt: EpochMillis): BookingIntegrationEvent | undefined {
  switch (event.type) {
    case "BookingConfirmed":
      return {
        type: "booking.confirmed",
        version: 1,
        eventId,
        occurredAt,
        payload: { bookingId: event.bookingId, roomId: event.roomId, start: event.slot.start, end: event.slot.end },
      };
    case "BookingCancelled":
      return { type: "booking.cancelled", version: 1, eventId, occurredAt, payload: { bookingId: event.bookingId, roomId: event.roomId } };
    case "MemberCheckedIn":
      return undefined;
    default:
      return assertNever(event);
  }
}
