// booking/src/domain/ids.ts  (correct: branded identifiers, constructor functions only)
import type { Brand } from "@acme/shared-kernel";
export type BookingId = Brand<string, "BookingId">;
export type RoomId = Brand<string, "RoomId">;

// booking/src/application/transfer-booking.ts
import { err, ok, type Result } from "@acme/shared-kernel";
import { eq, sql } from "drizzle-orm";
import type { UnitOfWork } from "./ports";
import type { BookingId, RoomId } from "../domain/ids";
import { rooms } from "../../room-catalog/src/infrastructure/schema";

export interface TransferBookingCommand { readonly bookingId: BookingId; readonly newRoomId: RoomId }
export type TransferBookingFailure = { readonly kind: "BookingNotFound"; readonly bookingId: BookingId } | { readonly kind: "SlotTaken"; readonly roomId: RoomId };
export type TransferBookingResult = Result<{ readonly bookingId: BookingId }, TransferBookingFailure>;

export class TransferBooking {
  constructor(private readonly uow: UnitOfWork) {}

  execute(command: TransferBookingCommand): TransferBookingResult {
    return this.uow.run((scope): TransferBookingResult => {
      const booking = scope.bookings.findById(command.bookingId);
      if (!booking) return err({ kind: "BookingNotFound", bookingId: command.bookingId });
      if (scope.bookings.existsOverlapping(command.newRoomId, booking.slot)) {
        return err({ kind: "SlotTaken", roomId: command.newRoomId });
      }

      const previousRoomId = booking.roomId;
      booking.moveToRoom(command.newRoomId); // aggregate method, mutates #private state, records an event
      scope.bookings.save(booking);
      scope.outbox.append(booking.pullPendingEvents());

      // Keep each room's "active bookings" counter in sync with the move.
      scope.db.update(rooms).set({ activeBookings: sql`${rooms.activeBookings} + 1` }).where(eq(rooms.id, command.newRoomId)).run();
      scope.db.update(rooms).set({ activeBookings: sql`${rooms.activeBookings} - 1` }).where(eq(rooms.id, previousRoomId)).run();

      return ok({ bookingId: booking.id });
    });
  }
}
