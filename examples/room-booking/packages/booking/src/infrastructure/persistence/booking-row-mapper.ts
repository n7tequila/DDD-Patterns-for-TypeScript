import { toEpochMillis, toMemberId, toRoomId } from "@example/shared-kernel";
import { Booking } from "../../domain/booking";
import { toBookingId } from "../../domain/ids";
import { TimeSlot } from "../../domain/time-slot";
import type { bookings } from "./schema";

export type BookingRow = typeof bookings.$inferSelect;

/** Rebuilds value objects through their factories, so a corrupted row fails loudly. */
export function fromBookingRow(row: BookingRow): Booking {
  return Booking.reconstitute({
    id: toBookingId(row.id),
    roomId: toRoomId(row.roomId),
    organizer: toMemberId(row.organizer),
    slot: TimeSlot.of(toEpochMillis(row.start), toEpochMillis(row.end)),
    status: row.status,
    version: row.version,
  });
}

export function toBookingRow(booking: Booking): BookingRow {
  const s = booking.toSnapshot();
  return { id: s.id, roomId: s.roomId, organizer: s.organizer, start: s.slot.start, end: s.slot.end, status: s.status, version: s.version };
}
