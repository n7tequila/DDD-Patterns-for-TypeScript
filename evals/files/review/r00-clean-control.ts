// Control sample: excerpts from the example project (expected to be compliant).
// ---- application/cancel-booking.ts

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
// ---- domain/booking.ts (cancel and guard)
  canBeCancelledBy(member: MemberId, role: MemberRole): boolean {
    return this.#organizer === member || role === "admin";
  }

  cancel(by: MemberId, role: MemberRole): void {
    if (!this.canBeCancelledBy(by, role)) throw new BookingRuleViolation("NOT_ALLOWED", "only the organizer or an admin can cancel");
    if (this.#status === "cancelled") return;
    if (this.#status === "checked-in") throw new BookingRuleViolation("ALREADY_STARTED", "a started booking cannot be cancelled");
    this.#status = "cancelled";
    this.#record({ type: "BookingCancelled", bookingId: this.#id, roomId: this.#roomId, cancelledBy: by });
  }

// ---- infrastructure/persistence/booking-row-mapper.ts

export type BookingRow = typeof bookings.$inferSelect;

/** Rebuilds value objects through their factories, so a corrupted row fails loudly. */
export function fromBookingRow(row: BookingRow): Booking {
  return Booking.reconstitute({
    id: toBookingId(row.id),
    roomId: toRoomId(row.roomId),
    organizer: toMemberId(row.organizer),
    slot: TimeSlot.of(toEpochMillis(row.start), toEpochMillis(row.end)),
    status: toBookingStatus(row.status),
    version: row.version,
  });
}

export function toBookingRow(booking: Booking): BookingRow {
  const s = booking.toSnapshot();
  return { id: s.id, roomId: s.roomId, organizer: s.organizer, start: s.slot.start, end: s.slot.end, status: s.status, version: s.version };
}
