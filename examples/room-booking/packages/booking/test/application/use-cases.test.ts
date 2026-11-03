import { beforeEach, describe, expect, test } from "bun:test";
import type { RoomId } from "@example/shared-kernel";
import { BookRoom } from "../../src/application/book-room";
import { CancelBooking } from "../../src/application/cancel-booking";
import type { BookingRepository, OutboxWriter, RoomCatalog, TransactionScope, UnitOfWork } from "../../src/application/ports";
import type { Booking, BookingEvent } from "../../src/domain/booking";
import type { RoomSnapshot } from "../../src/domain/room-snapshot";
import { ALICE, BOB, OTHER_ROOM, ROOM, fixedClock, sequentialIds, slotFromNow } from "../fixtures";

class InMemoryUnitOfWork implements UnitOfWork {
  readonly rows = new Map<string, Booking>();
  readonly outbox: BookingEvent[] = [];
  readonly #scope: TransactionScope = {
    bookings: {
      findById: (id) => this.rows.get(id),
      existsOverlapping: (roomId, slot) =>
        [...this.rows.values()].some((b) => b.roomId === roomId && b.status !== "cancelled" && b.slot.overlaps(slot)),
      save: (b) => void this.rows.set(b.id, b),
    } satisfies BookingRepository,
    outbox: { append: (events) => void this.outbox.push(...events) } satisfies OutboxWriter,
  };
  run<T>(work: (scope: TransactionScope) => T): T {
    return work(this.#scope);
  }
}

const catalog = (rooms: Record<string, RoomSnapshot>): RoomCatalog => ({ findRoom: async (id: RoomId) => rooms[id] });

let uow: InMemoryUnitOfWork;
let bookRoom: BookRoom;
let cancel: CancelBooking;
const member = { memberId: ALICE, role: "member" as const };

beforeEach(() => {
  uow = new InMemoryUnitOfWork();
  const rooms = catalog({
    [ROOM]: { roomId: ROOM, capacity: 8, bookable: true },
    [OTHER_ROOM]: { roomId: OTHER_ROOM, capacity: 4, bookable: false },
  });
  bookRoom = new BookRoom(rooms, uow, fixedClock(), sequentialIds());
  cancel = new CancelBooking(uow);
});

describe("BookRoom", () => {
  test("books a free slot and writes one event to the outbox", async () => {
    const result = await bookRoom.execute({ actor: member, roomId: ROOM, slot: slotFromNow(2) });
    expect(result.ok).toBe(true);
    expect(uow.outbox.map((e) => e.type)).toEqual(["BookingConfirmed"]);
  });

  test("returns SlotTaken for an overlapping slot and writes nothing", async () => {
    await bookRoom.execute({ actor: member, roomId: ROOM, slot: slotFromNow(2, 2) });
    const second = await bookRoom.execute({ actor: { memberId: BOB, role: "member" }, roomId: ROOM, slot: slotFromNow(3) });
    expect(second.ok ? "ok" : second.error.kind).toBe("SlotTaken");
    expect(uow.rows.size).toBe(1);
    expect(uow.outbox.length).toBe(1);
  });

  test("returns RoomNotFound and RoomNotBookable from the catalog", async () => {
    const missing = await bookRoom.execute({ actor: member, roomId: "00000000-0000-4000-8000-0000000000ff" as RoomId, slot: slotFromNow(2) });
    const closed = await bookRoom.execute({ actor: member, roomId: OTHER_ROOM, slot: slotFromNow(2) });
    expect(missing.ok ? "ok" : missing.error.kind).toBe("RoomNotFound");
    expect(closed.ok ? "ok" : closed.error.kind).toBe("RoomNotBookable");
  });
});

describe("CancelBooking", () => {
  test("another member gets NotAllowed and the booking stays confirmed", async () => {
    const booked = await bookRoom.execute({ actor: member, roomId: ROOM, slot: slotFromNow(2) });
    if (!booked.ok) throw new Error("setup failed");
    const result = cancel.execute({ actor: { memberId: BOB, role: "member" }, bookingId: booked.value.bookingId });
    expect(result.ok ? "ok" : result.error.kind).toBe("NotAllowed");
    expect(uow.rows.get(booked.value.bookingId)?.status).toBe("confirmed");
  });

  test("an admin may cancel someone else's booking", async () => {
    const booked = await bookRoom.execute({ actor: member, roomId: ROOM, slot: slotFromNow(2) });
    if (!booked.ok) throw new Error("setup failed");
    const result = cancel.execute({ actor: { memberId: BOB, role: "admin" }, bookingId: booked.value.bookingId });
    expect(result.ok).toBe(true);
    expect(uow.outbox.map((e) => e.type)).toEqual(["BookingConfirmed", "BookingCancelled"]);
  });
});
