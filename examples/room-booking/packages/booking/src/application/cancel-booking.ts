import { err, ok } from "@example/shared-kernel";
import type { CancelBookingCommand } from "./commands";
import type { UnitOfWork } from "./ports";
import type { CancelBookingResult } from "./results";

export class CancelBooking {
  constructor(private readonly uow: UnitOfWork) {}

  execute(command: CancelBookingCommand): CancelBookingResult {
    return this.uow.run((scope): CancelBookingResult => {
      const booking = scope.bookings.findById(command.bookingId);
      if (booking === undefined) return err({ kind: "BookingNotFound", bookingId: command.bookingId });
      if (!booking.canBeCancelledBy(command.actor.memberId, command.actor.role)) {
        return err({ kind: "NotAllowed", bookingId: command.bookingId });
      }
      booking.cancel(command.actor.memberId, command.actor.role);
      scope.bookings.save(booking);
      scope.outbox.append(booking.pullPendingEvents());
      return ok({ bookingId: booking.id });
    });
  }
}
