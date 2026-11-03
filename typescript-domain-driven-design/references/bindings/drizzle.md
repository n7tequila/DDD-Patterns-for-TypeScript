# Binding: Drizzle

How repositories, the unit of work, and the outbox look with Drizzle on `bun:sqlite`. Excerpts come from `examples/room-booking` in this skill's repository, verified with Drizzle 0.45.4 and Bun 1.3.12.

## Two Facts That Shape Everything

Both were verified with Drizzle 0.45.4 on `bun:sqlite`:

1. **An `async` transaction callback never rolls back.** The driver is synchronous, so `db.transaction` runs the callback synchronously. An `async` callback returns a promise at its first line; the transaction commits right then. Throwing later, with or without an `await` in between, leaves every write committed. The caller still receives the error.
2. **A transaction handle keeps working after its transaction ended.** Writing through a stored `tx` raises nothing and commits the write on its own, outside any transaction.

Both failures are silent. The unit of work below makes them impossible to write by accident.

## Branded Columns

Declare identifier and enumeration columns with `$type<...>()`, so rows carry domain types and a wrong kind of identifier does not compile.

```ts
// booking/src/infrastructure/persistence/schema.ts
export const bookings = sqliteTable("bookings", {
  id: text("id").$type<BookingId>().primaryKey(),
  roomId: text("room_id").$type<RoomId>().notNull(),
  organizer: text("organizer").$type<MemberId>().notNull(),
  start: integer("start_ms").notNull(),
  end: integer("end_ms").notNull(),
  status: text("status").$type<BookingStatus>().notNull(),
  version: integer("version").notNull(),
});
```

`$type` is compile-time only, for enumerations too: a stored status `"bogus"` loads as a `BookingStatus` unless the mapper checks it (verified: before the fix, the example loaded such a row without error). The row mapper rebuilds identifiers, value objects, and enumerations through their constructor functions, so a corrupted row fails loudly:

```ts
// booking/src/infrastructure/persistence/booking-row-mapper.ts
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
```

## Unit Of Work

```ts
// booking/src/infrastructure/persistence/drizzle-unit-of-work.ts (excerpt)
type Tx = Parameters<Parameters<BunSQLiteDatabase["transaction"]>[0]>[0];

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
    // ... repositories and the outbox writer, each calling assertOpen() first
  }
}
```

Start every transaction as `IMMEDIATE` (`db.transaction(callback, { behavior: "immediate" })`) and set `PRAGMA busy_timeout`, so read-then-write use cases hold the write lock from their first read. The option exists in Drizzle 0.45.4's SQLite transaction config.

Three guards:

- `NotPromise<T>` on the port: an `async` callback does not compile (fact 1).
- The callback receives a scope of repositories bound to `tx`, never `tx` itself.
- Every scope method calls `assertOpen()`; after the transaction ends, a leaked scope throws `TransactionClosedError` instead of committing outside the transaction (fact 2).

Application code never imports Drizzle and never calls `db.transaction`.

## Repositories

Inside the scope, repository methods are synchronous and use `tx`.

```ts
existsOverlapping(roomId: RoomId, slot: TimeSlot): boolean {
  assertOpen();
  const hit = tx
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(eq(bookings.roomId, roomId), ne(bookings.status, "cancelled"), lt(bookings.start, slot.end), gt(bookings.end, slot.start)))
    .get();
  return hit !== undefined;
},
```

Optimistic locking on update uses `RETURNING`, because the `bun-sqlite` driver types `run()` as `void` and does not expose the changed-row count:

```ts
const updated = tx
  .update(bookings)
  .set({ ...row, version: row.version + 1 })
  .where(and(eq(bookings.id, row.id), eq(bookings.version, row.version)))
  .returning({ id: bookings.id })
  .all();
if (updated.length !== 1) throw new OptimisticLockError(row.id);
```

The aggregate in memory keeps the version it was loaded with. Load, change, and save an aggregate within one transaction; saving the same instance again in a later transaction is rejected as stale, which is the intended behavior.

## Outbox

The outbox writer inside the scope converts each domain event into its published contract and inserts it in the same transaction. Internal events that have no contract are skipped.

```ts
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
```

The relay reads unsent rows outside any transaction, delivers each with `await`, and records the outcome in its own small synchronous transaction per row. Asynchronous delivery never happens inside a transaction.

## Migrations In A Single-File Binary

Generate migrations with drizzle-kit, one configuration per context, so each context owns its tables and its history:

```ts
// booking/drizzle.config.ts
export default defineConfig({ dialect: "sqlite", schema: "./src/infrastructure/persistence/schema.ts", out: "./drizzle" });
```

drizzle-orm's `migrate()` reads the `drizzle/` folder from disk at runtime. A program built with `bun build --compile` does not have that folder; verified with drizzle-kit 0.31.11 and Drizzle 0.45.4, the compiled program fails with `Can't find meta/_journal.json file`.

Compile the migrations into the program instead:

1. After `drizzle-kit generate`, a script reads each context's `drizzle/meta/_journal.json` and writes `src/infrastructure/migrations.generated.ts`, with one text import per migration file:

   ```ts
   // Generated from drizzle/meta/_journal.json. Do not edit.
   import m0 from "../../drizzle/0000_init.sql" with { type: "text" };
   export const MIGRATIONS: readonly EmbeddedMigration[] = [{ tag: "0000_init", when: 1793690252594, sql: m0 }];
   ```

2. A small shared infrastructure package applies them in journal order. Each migration and its bookkeeping row run in one transaction; applied tags, recorded per owning context, are skipped:

   ```ts
   export function migrateEmbedded(sqlite: Database, owner: string, migrations: readonly EmbeddedMigration[]): readonly string[]
   ```

3. Each context exports `migrateBooking(sqlite)` (or its own equivalent) from its entry point, and the composition root calls them at startup.

4. The generated file also imports the journal and exports its tags. Before applying anything, `migrateEmbedded` compares them with the embedded list and refuses to start on any difference. Running `drizzle-kit generate` without the embed step would otherwise leave the new migration out of the binary, with no error until a request hit the missing table. A test per context makes the same comparison, so CI fails first.

TypeScript needs `"resolveJsonModule": true` for the journal and a `declare module "*.sql"` declaration for the text imports. Verified: the compiled program, run where no `drizzle/` folder exists, created the schema on first start and applied nothing on the second.

Each context owns its tables; no context writes another context's tables.

## Read Models

Query implementations use the plain `db` handle outside any unit of work, select only the columns the view needs, apply the visibility rule in `WHERE`, and cap the page size. See `drizzle-booking-queries.ts` in the example and [../query-side.md](../query-side.md).
