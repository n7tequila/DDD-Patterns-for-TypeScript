import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { sql } from "drizzle-orm";
import type { TransactionScope } from "../../src/application/ports";
import { Booking } from "../../src/domain/booking";
import { toBookingId } from "../../src/domain/ids";
import { OutboxRelay } from "../../src/infrastructure/messaging/outbox-relay";
import { DrizzleUnitOfWork, OptimisticLockError, TransactionClosedError } from "../../src/infrastructure/persistence/drizzle-unit-of-work";
import { migrateBooking } from "../../src/infrastructure/migrate";
import { bookings, outbox } from "../../src/infrastructure/persistence/schema";
import { ALICE, NOW, ROOM, fixedClock, sequentialIds, slotFromNow } from "../fixtures";

let db: BunSQLiteDatabase;
let uow: DrizzleUnitOfWork;
const count = (table: typeof bookings | typeof outbox): number => db.select({ n: sql<number>`count(*)` }).from(table).get()?.n ?? -1;
const newBooking = (n: number, startHours = 2) =>
  Booking.create({ id: toBookingId(`20000000-0000-4000-8000-${String(n).padStart(12, "0")}`), roomId: ROOM, organizer: ALICE, slot: slotFromNow(startHours) }, NOW);

beforeEach(() => {
  const sqlite = new Database(":memory:");
  migrateBooking(sqlite);
  db = drizzle(sqlite);
  uow = new DrizzleUnitOfWork(db, fixedClock(), sequentialIds("30000000-0000-4000-8000-"));
});

describe("DrizzleUnitOfWork", () => {
  test("saves the aggregate and its outbox rows together", () => {
    uow.run((scope) => {
      const b = newBooking(1);
      scope.bookings.save(b);
      scope.outbox.append(b.pullPendingEvents());
    });
    expect([count(bookings), count(outbox)]).toEqual([1, 1]);
  });

  test("a failure after save rolls back the aggregate and the outbox", () => {
    expect(() =>
      uow.run((scope) => {
        const b = newBooking(1);
        scope.bookings.save(b);
        scope.outbox.append(b.pullPendingEvents());
        throw new Error("boom after writes");
      }),
    ).toThrow("boom after writes");
    expect([count(bookings), count(outbox)]).toEqual([0, 0]);
  });

  test("a leaked scope refuses to write after its transaction ended", () => {
    let leaked: TransactionScope | undefined;
    uow.run((scope) => {
      leaked = scope;
    });
    expect(() => leaked?.bookings.save(newBooking(2))).toThrow(TransactionClosedError);
    expect(count(bookings)).toBe(0);
  });

  test("overlap check sees committed bookings of the same room only", () => {
    uow.run((scope) => scope.bookings.save(newBooking(1, 2)));
    expect(uow.run((scope) => scope.bookings.existsOverlapping(ROOM, slotFromNow(2)))).toBe(true);
    expect(uow.run((scope) => scope.bookings.existsOverlapping(ROOM, slotFromNow(3)))).toBe(false);
  });

  test("a stale version is rejected by optimistic locking", () => {
    uow.run((scope) => scope.bookings.save(newBooking(1)));
    const id = toBookingId("20000000-0000-4000-8000-000000000001");
    const first = uow.run((scope) => scope.bookings.findById(id));
    const second = uow.run((scope) => scope.bookings.findById(id));
    if (first === undefined || second === undefined) throw new Error("setup failed");
    first.cancel(ALICE, "member");
    uow.run((scope) => scope.bookings.save(first));
    second.cancel(ALICE, "member");
    expect(() => uow.run((scope) => scope.bookings.save(second))).toThrow(OptimisticLockError);
  });
});

describe("embedded migrations", () => {
  test("apply once, are skipped on the next run, and create the overlap index", () => {
    const sqlite = new Database(":memory:");
    expect(migrateBooking(sqlite)).toHaveLength(1);
    expect(migrateBooking(sqlite)).toEqual([]);
    const index = sqlite.query("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'bookings_room_time'").get();
    expect(index).not.toBeNull();
  });
});

describe("OutboxRelay", () => {
  test("delivers each committed event once and records failures without stopping", async () => {
    uow.run((scope) => {
      for (const n of [1, 2]) {
        const b = newBooking(n, n * 2);
        scope.bookings.save(b);
        scope.outbox.append(b.pullPendingEvents());
      }
    });
    const delivered: unknown[] = [];
    let calls = 0;
    const relay = new OutboxRelay(db, async (payload) => {
      calls += 1;
      if (calls === 1) throw new Error("broker down");
      delivered.push(payload);
    }, fixedClock());
    expect(await relay.relayOnce()).toEqual({ sent: 1, failed: 1 });
    expect(await relay.relayOnce()).toEqual({ sent: 1, failed: 0 });
    expect(await relay.relayOnce()).toEqual({ sent: 0, failed: 0 });
    expect(delivered).toHaveLength(2);
  });
});
