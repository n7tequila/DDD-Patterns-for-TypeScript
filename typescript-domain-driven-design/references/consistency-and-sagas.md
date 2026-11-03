# Consistency And Sagas

## Default Rule

Keep strong consistency inside one aggregate boundary whenever possible.

## Transaction Boundaries

- Application services define transaction boundaries
- One command usually modifies one aggregate root
- Cross-aggregate updates inside one database transaction are rare and must be justified in the design
- Every transaction is entered through one unit-of-work port; application code never touches the ORM's transaction API

## No Asynchronous Work Inside A Transaction

Do all asynchronous work first, then open the transaction, then do only synchronous reads and writes.

- Calls to other contexts, remote services, language models, file storage, or clocks that need awaiting happen before the transaction starts.
- The transaction callback is a plain synchronous function. Its return type must not be a promise.
- With synchronous drivers such as `bun:sqlite`, Drizzle runs the callback synchronously. An `async` callback returns a promise immediately, so the transaction commits before the awaited work runs, and a later failure rolls nothing back. Verified with Bun 1.3.12 and Drizzle 0.45.4: an `async` callback that throws, with or without an `await` before the throw, leaves every write committed.
- A transaction handle must never escape its callback. Verified with the same versions: a handle kept in a variable and used after the transaction ended raised no error, and its write was committed on its own, outside any transaction.

These two failures are silent: the caller may even see the error, but the data is already half-written. The unit-of-work port makes the safe shape the only shape.

```ts
// booking/src/application/ports.ts
export interface BookingRepository {
  findById(id: BookingId): Booking | undefined;
  existsOverlapping(roomId: RoomId, slot: TimeSlot): boolean;
  save(booking: Booking): void;
}

export interface OutboxWriter {
  append(events: readonly BookingEvent[]): void;
}

export interface TransactionScope {
  readonly bookings: BookingRepository;
  readonly outbox: OutboxWriter;
}

type NotPromise<T> = T extends PromiseLike<unknown> ? never : T;

export interface UnitOfWork {
  run<T>(work: (scope: TransactionScope) => NotPromise<T>): T;
}
```

Rules:

- Repositories and the outbox writer inside a transaction are synchronous. They are created by the unit of work for that one transaction and are bound to it.
- `NotPromise<T>` turns an `async` callback into a compile error.
- The scope object is the only thing the callback receives; it carries no raw transaction handle.
- The binding in [bindings/drizzle.md](./bindings/drizzle.md) implements this port.

## Outbox

Save the aggregate and its pending events in the same transaction. Publish after commit, from the outbox.

```ts
// booking/src/application/commands.ts
export interface BookRoomCommand {
  readonly roomId: RoomId;
  readonly organizer: MemberId;
  readonly slot: TimeSlot;
}
```

```ts
// booking/src/application/book-room.ts
export class BookRoom {
  constructor(
    private readonly rooms: RoomCatalog,
    private readonly uow: UnitOfWork,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: BookRoomCommand): Promise<BookRoomResult> {
    // 1. Asynchronous work first: ask the other context, outside any transaction.
    const room = await this.rooms.findRoom(command.roomId);
    if (room === undefined) return err({ kind: "RoomNotFound", roomId: command.roomId });
    if (!room.bookable) return err({ kind: "RoomRetired", roomId: command.roomId });

    // 2. Then one synchronous transaction: check, change one aggregate, write its events.
    return this.uow.run((scope): BookRoomResult => {
      if (scope.bookings.existsOverlapping(command.roomId, command.slot)) {
        return err({ kind: "SlotTaken", roomId: command.roomId, slot: command.slot });
      }
      const booking = Booking.create(
        { id: toBookingId(this.ids.next()), roomId: command.roomId, organizer: command.organizer, slot: command.slot },
        this.clock.now(),
      );
      scope.bookings.save(booking);
      scope.outbox.append(booking.pullPendingEvents());
      return ok({ bookingId: booking.id });
    });
  }
}
```

Points to notice:

- The overlap check and the insert happen in the same transaction. With SQLite, transactions are serialized, so no other booking can slip in between; with databases that allow concurrent writers, back the rule with a constraint or a lock and translate the violation into `SlotTaken`.
- The room information read before the transaction may be stale by the time of the write. That is acceptable here because a room retired a moment ago is a business-tolerable race; when it is not, move the check into the same database or make it an invariant of an aggregate that owns both facts.
- The outbox writer converts domain events into published contracts (see [contracts-and-published-language.md](./contracts-and-published-language.md)) before storing them.

## Outbox Relay

A relay process reads committed outbox rows and delivers them. It has three defenses, and each is required:

| Defense | How | Prevents |
|---|---|---|
| Timing | Events are written in the business transaction; the relay reads only committed rows | Side effects for changes that were rolled back |
| Isolation | Each delivery and its "mark as sent" run in their own transaction, opened by the relay through the unit of work | A failing side effect corrupting or blocking the business write |
| Containment | The relay catches each delivery's failure, records it, retries with backoff, and keeps running | One bad message stopping all others, or crashing the process |

Consumers must be idempotent by `eventId`, because the relay delivers at least once.

Code that runs after the business transaction (the relay, scheduled jobs, delayed handlers) has no enclosing transaction. It must open its own through the unit of work. Writing through a handle or repository from a finished transaction does not fail; it commits outside any transaction.

## Eventual Consistency

Use eventual consistency when:

- a workflow spans multiple aggregates
- multiple bounded contexts participate
- remote systems are involved

Use domain events, integration events from the outbox, or process managers to coordinate follow-up steps.

## Sagas Or Process Managers

Use a saga or process manager when:

- the workflow is long-running
- multiple steps may fail independently
- compensation or retries are required
- state transitions must be coordinated across boundaries

Model the process manager's state as a discriminated union and persist it like an aggregate. Each step is: receive an event, decide the next command, record the new state, all in one transaction; the command's own effects happen in their own transactions.

Keep saga logic in application or workflow code, not in aggregates.

## What Not To Do

Do not:

- create transactions that span bounded contexts
- let one context write another context's tables
- hide distributed workflow complexity inside repositories
- publish events directly after `save` instead of through the outbox
- pass an `async` function to a transaction, or keep a transaction handle beyond its callback
