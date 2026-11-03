import { and, eq, gt, lt, ne } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type { Clock, IdGenerator, RoomId } from "@example/shared-kernel";
import type { Booking, BookingEvent } from "../../domain/booking";
import type { BookingId } from "../../domain/ids";
import type { TimeSlot } from "../../domain/time-slot";
import type { BookingRepository, NotPromise, OutboxWriter, TransactionScope, UnitOfWork } from "../../application/ports";
import { fromBookingRow, toBookingRow } from "./booking-row-mapper";
import { toIntegrationEvent } from "./integration-events";
import { bookings, outbox } from "./schema";

type Tx = Parameters<Parameters<BunSQLiteDatabase["transaction"]>[0]>[0];

export class TransactionClosedError extends Error {
  readonly code = "TRANSACTION_CLOSED";
  constructor() {
    super("a transaction-bound repository was used after its transaction ended");
  }
}

export class OptimisticLockError extends Error {
  readonly code = "OPTIMISTIC_LOCK";
  constructor(id: BookingId) {
    super(`booking ${id} was changed concurrently`);
  }
}

/**
 * The only way into a transaction. The callback must be synchronous (NotPromise), and the scope it
 * receives refuses to work once the transaction has ended, so a leaked handle cannot write outside it.
 */
export class DrizzleUnitOfWork implements UnitOfWork {
  constructor(
    private readonly db: BunSQLiteDatabase,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  run<T>(work: (scope: TransactionScope) => NotPromise<T>): T {
    return this.db.transaction((tx) => {
      const guard = { open: true };
      try {
        return work(this.#scope(tx, guard));
      } finally {
        guard.open = false;
      }
    });
  }

  #scope(tx: Tx, guard: { open: boolean }): TransactionScope {
    const assertOpen = (): void => {
      if (!guard.open) throw new TransactionClosedError();
    };
    const clock = this.clock;
    const ids = this.ids;

    const bookingRepository: BookingRepository = {
      findById(id: BookingId): Booking | undefined {
        assertOpen();
        const row = tx.select().from(bookings).where(eq(bookings.id, id)).get();
        return row === undefined ? undefined : fromBookingRow(row);
      },
      existsOverlapping(roomId: RoomId, slot: TimeSlot): boolean {
        assertOpen();
        const hit = tx
          .select({ id: bookings.id })
          .from(bookings)
          .where(and(eq(bookings.roomId, roomId), ne(bookings.status, "cancelled"), lt(bookings.start, slot.end), gt(bookings.end, slot.start)))
          .get();
        return hit !== undefined;
      },
      save(booking: Booking): void {
        assertOpen();
        const row = toBookingRow(booking);
        const existing = tx.select({ version: bookings.version }).from(bookings).where(eq(bookings.id, row.id)).get();
        if (existing === undefined) {
          tx.insert(bookings).values(row).run();
          return;
        }
        const updated = tx
          .update(bookings)
          .set({ ...row, version: row.version + 1 })
          .where(and(eq(bookings.id, row.id), eq(bookings.version, row.version)))
          .returning({ id: bookings.id })
          .all();
        if (updated.length !== 1) throw new OptimisticLockError(row.id);
      },
    };

    const outboxWriter: OutboxWriter = {
      append(events: readonly BookingEvent[]): void {
        assertOpen();
        for (const event of events) {
          const integration = toIntegrationEvent(event, ids.next(), clock.now());
          if (integration === undefined) continue;
          tx.insert(outbox)
            .values({ eventId: integration.eventId, type: integration.type, payload: JSON.stringify(integration), occurredAt: integration.occurredAt })
            .run();
        }
      },
    };

    return { bookings: bookingRepository, outbox: outboxWriter };
  }
}
