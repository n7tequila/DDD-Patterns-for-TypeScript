// booking/src/application/cancel-booking.ts
import { err, ok } from "@acme/shared-kernel";
import type { CancelBookingCommand } from "./commands";
import type { UnitOfWork } from "./ports";
import type { CancelBookingResult } from "./results";

export class CancelBooking {
  constructor(private readonly uow: UnitOfWork) {}

  execute(command: CancelBookingCommand): CancelBookingResult {
    return this.uow.run((scope): CancelBookingResult => {
      const booking = scope.bookings.findById(command.bookingId);
      if (!booking) return err({ kind: "BookingNotFound", bookingId: command.bookingId });
      if (!booking.canBeCancelledBy(command.actor.memberId, command.actor.role)) {
        return err({ kind: "NotAllowed", bookingId: command.bookingId });
      }

      booking.cancel(command.actor.memberId, command.actor.role);

      if (booking.refundAmount === 0) {
        // No refund owed: persist the cancellation without the notification pipeline.
        scope.bookings.save(booking);
        return ok({ bookingId: booking.id });
      }

      scope.bookings.save(booking);
      scope.outbox.append(booking.pullPendingEvents());
      return ok({ bookingId: booking.id });
    });
  }
}
