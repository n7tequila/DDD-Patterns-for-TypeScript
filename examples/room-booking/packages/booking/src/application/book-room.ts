import { err, ok, type Clock, type IdGenerator } from "@example/shared-kernel";
import { Booking } from "../domain/booking";
import { toBookingId } from "../domain/ids";
import type { BookRoomCommand } from "./commands";
import type { RoomCatalog, UnitOfWork } from "./ports";
import type { BookRoomResult } from "./results";

export class BookRoom {
  constructor(
    private readonly rooms: RoomCatalog,
    private readonly uow: UnitOfWork,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: BookRoomCommand): Promise<BookRoomResult> {
    // 1. Asynchronous work first, outside any transaction.
    const room = await this.rooms.findRoom(command.roomId);
    if (room === undefined) return err({ kind: "RoomNotFound", roomId: command.roomId });
    if (!room.bookable) return err({ kind: "RoomNotBookable", roomId: command.roomId });

    // 2. One synchronous transaction: check, change one aggregate, write its events.
    return this.uow.run((scope): BookRoomResult => {
      if (scope.bookings.existsOverlapping(command.roomId, command.slot)) {
        return err({ kind: "SlotTaken", roomId: command.roomId, slot: command.slot });
      }
      const booking = Booking.create(
        { id: toBookingId(this.ids.next()), roomId: command.roomId, organizer: command.actor.memberId, slot: command.slot },
        this.clock.now(),
      );
      scope.bookings.save(booking);
      scope.outbox.append(booking.pullPendingEvents());
      return ok({ bookingId: booking.id });
    });
  }
}
