// booking/src/application/cancel-booking.ts
import type { UnitOfWork } from "./ports";
import type { BookingId, MemberId } from "../domain/ids";

export interface CancelBookingCommand { readonly actor: MemberId; readonly role: "member" | "admin"; readonly bookingId: BookingId }

export class CancelBooking {
  constructor(private readonly uow: UnitOfWork) {}

  execute(command: CancelBookingCommand): { ok: boolean } {
    if (command.role !== "member" && command.role !== "admin") return { ok: false };
    return this.uow.run((scope) => {
      const booking = scope.bookings.findById(command.bookingId);
      if (!booking) return { ok: false };
      booking.cancel();
      scope.bookings.save(booking);
      scope.outbox.append(booking.pullPendingEvents());
      return { ok: true };
    });
  }
}
