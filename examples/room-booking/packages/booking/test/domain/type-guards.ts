// Compile-time guards, checked by `tsc -p .`. Each @ts-expect-error must stay used.
import { toEpochMillis } from "@example/shared-kernel";
import type { UnitOfWork } from "../../src/application/ports";
import { Booking } from "../../src/domain/booking";
import { toBookingId } from "../../src/domain/ids";
import { TimeSlot } from "../../src/domain/time-slot";
import { ALICE, NOW, ROOM, slotFromNow } from "../fixtures";

const booking = Booking.create({ id: toBookingId("20000000-0000-4000-8000-000000000009"), roomId: ROOM, organizer: ALICE, slot: slotFromNow(2) }, NOW);

// @ts-expect-error a RoomId must not be accepted where a MemberId is expected
booking.cancel(ROOM, "member");
// @ts-expect-error a raw string must not be accepted as an identifier
booking.cancel("00000000-0000-4000-8000-00000000a11c", "member");
// @ts-expect-error an object literal must not pass as a TimeSlot
export const fakeSlot: TimeSlot = { start: toEpochMillis(1), end: toEpochMillis(2), overlaps: () => false, equals: () => true };

export function asyncCallbackIsRejected(uow: UnitOfWork): void {
  // @ts-expect-error an async callback must be rejected by the unit-of-work port
  void uow.run(async () => 1);
}
