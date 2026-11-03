// booking/src/infrastructure/persistence/booking-row-mapper.ts  (Drizzle schema declares status with $type<BookingStatus>())
import { toEpochMillis, toMemberId, toRoomId } from "@acme/shared-kernel";
import { Booking } from "../../domain/booking";
import { toBookingId } from "../../domain/ids";
import { TimeSlot } from "../../domain/time-slot";
import type { BookingRow } from "./schema";

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
