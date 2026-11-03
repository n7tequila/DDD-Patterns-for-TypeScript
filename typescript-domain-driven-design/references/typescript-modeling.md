# TypeScript Modeling

How DDD building blocks are expressed in TypeScript. The examples use a meeting-room booking domain and compile together under the strict configuration in [enforcement.md](./enforcement.md).

TypeScript compares types by structure, not by name. Two classes with the same public shape are interchangeable, and any object literal with the right fields is accepted where a class is expected. Most rules below exist to win back the guarantees that Java gives for free.

## Branded Identifiers

Give every identifier its own branded type.

```ts
// shared-kernel/src/brand.ts
declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };
```

```ts
// booking/src/domain/ids.ts
export type BookingId = Brand<string, "BookingId">;
export type RoomId = Brand<string, "RoomId">;
export type MemberId = Brand<string, "MemberId">;

const ID_PATTERN = /^[0-9a-f-]{36}$/;

export function toBookingId(raw: string): BookingId {
  if (!ID_PATTERN.test(raw)) throw new InvalidIdentifierError("BookingId", raw);
  return raw as BookingId;
}

export function toRoomId(raw: string): RoomId {
  if (!ID_PATTERN.test(raw)) throw new InvalidIdentifierError("RoomId", raw);
  return raw as RoomId;
}

export function toMemberId(raw: string): MemberId {
  if (!ID_PATTERN.test(raw)) throw new InvalidIdentifierError("MemberId", raw);
  return raw as MemberId;
}
```

Rules:

- The only `as` casts to a branded type live in these constructor functions. Anywhere else, a cast to a brand is a review finding.
- A plain `class BookingId { constructor(readonly value: string) {} }` is **not** enough: a `MemberId` class with the same shape is assignable to it. A class becomes nominal only when it declares a private member, either `#private` or the `private`/`protected` keyword. Prefer branded primitives for identifiers; they also serialize and compare as plain strings.
- New identifiers come from an injected generator (see Time And Randomness), never from `crypto.randomUUID()` inside the domain.
- Brand the persistence columns as well (see [bindings/drizzle.md](./bindings/drizzle.md)), so a row cannot carry the wrong kind of ID either.

## Value Objects

Use a class with `readonly` fields, a private constructor, a validating factory, and `equals`. Freeze the instance.

```ts
// booking/src/domain/time-slot.ts
export type EpochMillis = Brand<number, "EpochMillis">;

export function toEpochMillis(raw: number): EpochMillis {
  if (!Number.isSafeInteger(raw) || raw < 0) throw new InvalidValueError("EpochMillis", String(raw));
  return raw as EpochMillis;
}

export class TimeSlot {
  static readonly MAX_MINUTES = 8 * 60;

  readonly #start: EpochMillis;
  readonly #end: EpochMillis;

  private constructor(start: EpochMillis, end: EpochMillis) {
    this.#start = start;
    this.#end = end;
    Object.freeze(this);
  }

  static of(start: EpochMillis, end: EpochMillis): TimeSlot {
    if (end <= start) throw new InvalidValueError("TimeSlot", "end must be after start");
    if (end - start > TimeSlot.MAX_MINUTES * 60_000) {
      throw new InvalidValueError("TimeSlot", "slot is longer than the maximum");
    }
    return new TimeSlot(start, end);
  }

  get start(): EpochMillis { return this.#start; }
  get end(): EpochMillis { return this.#end; }

  overlaps(other: TimeSlot): boolean {
    return this.#start < other.#end && other.#start < this.#end;
  }

  equals(other: TimeSlot): boolean {
    return this.#start === other.#start && this.#end === other.#end;
  }
}
```

Rules:

- Keep the state in `#private` fields. With only public `readonly` fields the class is structural: an object literal such as `{ start, end, overlaps, equals }` is accepted wherever a `TimeSlot` is expected and skips the factory's validation. Making `equals` read `other.#start` also proves the argument is a real instance.
- Operations return new instances; nothing mutates.
- Use a branded primitive instead of a class when the value object is a single constrained scalar (`EpochMillis`, `Capacity`, `EmailAddress`).
- Do not use a validation library inside the domain. The factory is the validation. Request schemas at the boundary may repeat a rule to give early feedback; the factory remains the authority.

## Aggregates

Model the aggregate root as a class. Keep state in `#private` fields, expose read-only getters, and change state only through methods named with business verbs.

```ts
// booking/src/domain/booking.ts
export type BookingStatus = "confirmed" | "checked-in" | "cancelled";

export type BookingEvent =
  | { readonly type: "BookingConfirmed"; readonly bookingId: BookingId; readonly roomId: RoomId; readonly slot: TimeSlot }
  | { readonly type: "BookingCancelled"; readonly bookingId: BookingId; readonly cancelledBy: MemberId }
  | { readonly type: "MemberCheckedIn"; readonly bookingId: BookingId; readonly at: EpochMillis };

export interface BookingSnapshot {
  readonly id: BookingId;
  readonly roomId: RoomId;
  readonly organizer: MemberId;
  readonly slot: TimeSlot;
  readonly status: BookingStatus;
  readonly version: number;
}

export class Booking {
  #id: BookingId;
  #roomId: RoomId;
  #organizer: MemberId;
  #slot: TimeSlot;
  #status: BookingStatus;
  #version: number;
  #pendingEvents: BookingEvent[] = [];

  private constructor(snapshot: BookingSnapshot) {
    this.#id = snapshot.id;
    this.#roomId = snapshot.roomId;
    this.#organizer = snapshot.organizer;
    this.#slot = snapshot.slot;
    this.#status = snapshot.status;
    this.#version = snapshot.version;
  }

  static create(
    input: { id: BookingId; roomId: RoomId; organizer: MemberId; slot: TimeSlot },
    now: EpochMillis,
  ): Booking {
    if (input.slot.start <= now) throw new BookingRuleViolation("SLOT_IN_PAST", "a booking must start in the future");
    const booking = new Booking({ ...input, status: "confirmed", version: 0 });
    booking.#record({ type: "BookingConfirmed", bookingId: input.id, roomId: input.roomId, slot: input.slot });
    return booking;
  }

  static reconstitute(snapshot: BookingSnapshot): Booking {
    return new Booking(snapshot);
  }

  get id(): BookingId { return this.#id; }
  get roomId(): RoomId { return this.#roomId; }
  get slot(): TimeSlot { return this.#slot; }
  get status(): BookingStatus { return this.#status; }

  isOrganizedBy(member: MemberId): boolean {
    return this.#organizer === member;
  }

  cancel(by: MemberId): void {
    if (!this.isOrganizedBy(by)) throw new BookingRuleViolation("NOT_ORGANIZER", "only the organizer can cancel");
    if (this.#status === "cancelled") return;
    if (this.#status === "checked-in") throw new BookingRuleViolation("ALREADY_STARTED", "a started booking cannot be cancelled");
    this.#status = "cancelled";
    this.#record({ type: "BookingCancelled", bookingId: this.#id, cancelledBy: by });
  }

  checkIn(at: EpochMillis): void {
    if (this.#status !== "confirmed") throw new BookingRuleViolation("NOT_CHECKABLE", "only a confirmed booking can be checked in");
    if (at < this.#slot.start - 10 * 60_000 || at > this.#slot.end) {
      throw new BookingRuleViolation("OUTSIDE_CHECK_IN_WINDOW", "check-in is only possible from 10 minutes before the start until the end");
    }
    this.#status = "checked-in";
    this.#record({ type: "MemberCheckedIn", bookingId: this.#id, at });
  }

  toSnapshot(): BookingSnapshot {
    return {
      id: this.#id,
      roomId: this.#roomId,
      organizer: this.#organizer,
      slot: this.#slot,
      status: this.#status,
      version: this.#version,
    };
  }

  pullPendingEvents(): readonly BookingEvent[] {
    const events = this.#pendingEvents;
    this.#pendingEvents = [];
    return events;
  }

  #record(event: BookingEvent): void {
    this.#pendingEvents.push(event);
  }
}
```

Rules:

- Two construction paths. `create` validates every rule, including creation-time policies such as "must start in the future", and records events. `reconstitute` rebuilds stored state and records no events.
- `reconstitute` does not re-run creation-time policies: stored data may legitimately fail them later (time passes, policies change). It does rely on value objects, which reject structurally impossible data, such as a slot whose end precedes its start. Repositories rebuild value objects through their factories, so corrupted rows fail loudly instead of entering the model.
- Both `#private` and the `private` keyword make the class nominal at compile time. Prefer `#private` because only it is private at runtime: a `private` keyword field is still readable and writable through bracket access, casts, or plain JavaScript, and `JSON.stringify` includes it.
- Getters return values or read-only views. Never return an internal array or object that the caller could mutate.
- Domain methods are synchronous and do no I/O. Data the method needs is passed in by the application service.
- Expose `toSnapshot()` for persistence and read models instead of letting adapters reach into fields.
- `version` supports optimistic concurrency; the repository checks and increments it.

## Discriminated Unions

Use a union of object types with a literal `type` (or `kind`, `status`) field for:

- The events of one aggregate (`BookingEvent` above)
- State machines whose states carry different data
- Expected failures returned by application services (see [error-handling.md](./error-handling.md))

Handle unions with an exhaustive `switch` that ends in an `assertNever` call, so adding a variant fails compilation wherever it is not handled.

```ts
// shared-kernel/src/assert-never.ts
export function assertNever(value: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(value)}`);
}
```

Prefer string literal unions over `enum`. They need no runtime object, serialize as plain strings, and work with exhaustive checks.

## Immutability

- Mark value object fields `readonly` and freeze value object instances.
- Type collections that leave an aggregate as `readonly T[]` or `ReadonlyMap`, and return copies.
- Type event and snapshot fields `readonly`.
- `readonly` is a compile-time check only. It does not stop a cast or plain JavaScript from writing. `Object.freeze` and `#private` are the runtime guards.

## Boundary Validation

Everything that enters the process is untyped until proven otherwise: HTTP bodies, query strings, environment variables, files, database rows written by other programs, messages, and responses from other systems or models.

- Parse it with a schema at the boundary (zod in the default stack), in the interface layer or the ACL.
- Turn the parsed result into domain types through the domain factories (`toBookingId`, `TimeSlot.of`).
- Never cast unparsed input (`body as CreateBookingRequest`). A cast is a promise the compiler cannot check.

## Time And Randomness

The domain stays deterministic.

```ts
// shared-kernel/src/ports.ts
export interface Clock {
  now(): EpochMillis;
}

export interface IdGenerator {
  next(): string;
}
```

- Inject `Clock` and `IdGenerator` into application services and pass the values into domain methods.
- Represent instants as `EpochMillis` (UTC milliseconds) in the domain. `Date` is mutable and carries a local-time API that invites time-zone bugs.
- Convert to and from calendar dates and time zones only at the boundaries, with an explicit zone.
- Tests use a fixed clock and a sequential generator.

## Serialization

- `#private` fields are not serialized by `JSON.stringify`. Never serialize an aggregate directly; serialize `toSnapshot()` or a dedicated read model.
- Persistence adapters map snapshots to rows and rows back through `reconstitute`.
- Events written to the outbox are converted to a published contract shape first (see [contracts-and-published-language.md](./contracts-and-published-language.md)), so internal refactoring does not break consumers.

## Promises

- Domain code never returns a promise.
- Application and infrastructure code awaits, returns, or explicitly supervises every promise. A floating promise loses its error and its ordering.
- Enforce this with the `@typescript-eslint/no-floating-promises` and `@typescript-eslint/no-misused-promises` rules (see [enforcement.md](./enforcement.md)).
- Never pass an `async` function to a synchronous transaction API. See [bindings/drizzle.md](./bindings/drizzle.md).

## Errors Used Above

```ts
// shared-kernel/src/errors.ts
export abstract class DomainError extends Error {
  abstract readonly code: string;
}

export class InvalidIdentifierError extends DomainError {
  readonly code = "INVALID_IDENTIFIER";
  constructor(kind: string, raw: string) {
    super(`${kind} is malformed: ${raw}`);
  }
}

export class InvalidValueError extends DomainError {
  readonly code = "INVALID_VALUE";
  constructor(kind: string, reason: string) {
    super(`${kind}: ${reason}`);
  }
}

export class BookingRuleViolation extends DomainError {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
```

Match errors by `code`, not only by `instanceof`: two copies of a package in one process produce two different classes. See [error-handling.md](./error-handling.md) for when to throw and when to return a `Result`.
