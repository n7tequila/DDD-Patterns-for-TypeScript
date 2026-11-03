import { describe, expect, test } from "bun:test";
import { toEpochMillis } from "@example/shared-kernel";
import { Booking } from "../../src/domain/booking";
import { toBookingId } from "../../src/domain/ids";
import { TimeSlot } from "../../src/domain/time-slot";
import { ALICE, BOB, HOUR, NOW, ROOM, slotFromNow } from "../fixtures";

const ID = toBookingId("20000000-0000-4000-8000-000000000001");
const create = (slot = slotFromNow(2)) => Booking.create({ id: ID, roomId: ROOM, organizer: ALICE, slot }, NOW);

describe("TimeSlot", () => {
  test("rejects an end before the start", () => {
    expect(() => TimeSlot.of(toEpochMillis(NOW + HOUR), toEpochMillis(NOW))).toThrow("end must be after start");
  });
  test("rejects slots longer than the maximum", () => {
    expect(() => slotFromNow(1, 9)).toThrow("longer than the maximum");
  });
  test("detects overlap but not adjacency", () => {
    expect(slotFromNow(1, 2).overlaps(slotFromNow(2, 2))).toBe(true);
    expect(slotFromNow(1, 1).overlaps(slotFromNow(2, 1))).toBe(false);
  });
});

describe("identifier errors", () => {
  test("do not echo the raw input, because messages reach clients", () => {
    expect(() => toBookingId("<script>alert(1)</script>")).toThrow("BookingId is malformed");
    try {
      toBookingId("<script>alert(1)</script>");
    } catch (error) {
      expect((error as Error).message).not.toContain("<script>");
    }
  });
});

describe("Booking", () => {
  test("create records BookingConfirmed exactly once", () => {
    const booking = create();
    expect(booking.pullPendingEvents().map((e) => e.type)).toEqual(["BookingConfirmed"]);
    expect(booking.pullPendingEvents()).toEqual([]);
  });

  test("create rejects a slot that does not start in the future", () => {
    expect(() => create(slotFromNow(0))).toThrow("must start in the future");
  });

  test("reconstitute records no events and does not re-run creation-time policies", () => {
    const past = slotFromNow(-5);
    const booking = Booking.reconstitute({ id: ID, roomId: ROOM, organizer: ALICE, slot: past, status: "confirmed", version: 3 });
    expect(booking.pullPendingEvents()).toEqual([]);
    expect(booking.version).toBe(3);
  });

  test("only the organizer or an admin may cancel", () => {
    const booking = create();
    expect(() => booking.cancel(BOB, "member")).toThrow("only the organizer or an admin can cancel");
    booking.cancel(BOB, "admin");
    expect(booking.status).toBe("cancelled");
  });

  test("cancelling twice is idempotent and records one event", () => {
    const booking = create();
    booking.pullPendingEvents();
    booking.cancel(ALICE, "member");
    booking.cancel(ALICE, "member");
    expect(booking.pullPendingEvents().map((e) => e.type)).toEqual(["BookingCancelled"]);
  });

  test("check-in window opens 10 minutes before the start", () => {
    const booking = create();
    const start = booking.slot.start;
    expect(() => booking.checkIn(ALICE, toEpochMillis(start - 11 * 60_000))).toThrow("check-in is only possible");
    booking.checkIn(ALICE, toEpochMillis(start - 10 * 60_000));
    expect(booking.status).toBe("checked-in");
    expect(() => booking.cancel(ALICE, "member")).toThrow("a started booking cannot be cancelled");
  });

  test("private state is not serialized", () => {
    expect(JSON.stringify(create())).toBe("{}");
  });
});
