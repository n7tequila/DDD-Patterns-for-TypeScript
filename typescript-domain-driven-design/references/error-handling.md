# Error Handling

## Purpose

Separate failure types by layer so business errors, integration failures, and transport responses do not collapse into one generic `Error`.

TypeScript has no checked exceptions: a function's type does not say what it throws. This reference splits failures into two channels so that the ones callers must handle are visible in the type.

## Failure Categories

- **Domain failures**: invariant violations and invalid state transitions. Thrown as typed `DomainError` subclasses.
- **Expected business outcomes**: results a caller must handle as part of normal flow, such as "the room is already booked for that slot". Returned by application services as a `Result`.
- **Integration failures**: remote systems, models, the database, messaging. Thrown by adapters as integration errors, after translation.
- **Interface failures**: malformed input and transport concerns. Produced and mapped by the interfaces layer.
- **Programming errors**: bugs. Never caught to continue; they reach the top-level handler and are logged.

## Throw Or Return

Decide per failure, using one test: **can a correct caller trigger it in normal use?**

- Yes, and the caller should react (show a message, offer another slot): return it in a `Result` from the application service.
- No, it means the caller or the data is wrong (an organizer check bypassed, a corrupted row, an impossible value): throw.

Domain methods throw. Application services catch nothing from the domain by default; they decide the expected outcomes before calling the domain, or translate a specific domain error into a `Result` when the use case treats it as expected.

```ts
// shared-kernel/src/result.ts
export type Result<T, E extends { readonly kind: string }> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): { readonly ok: true; readonly value: T } => ({ ok: true, value });
export const err = <E extends { readonly kind: string }>(error: E): { readonly ok: false; readonly error: E } => ({ ok: false, error });
```

```ts
// booking/src/application/results.ts
export type BookRoomFailure =
  | { readonly kind: "RoomNotFound"; readonly roomId: RoomId }
  | { readonly kind: "RoomRetired"; readonly roomId: RoomId }
  | { readonly kind: "SlotTaken"; readonly roomId: RoomId; readonly slot: TimeSlot };

export type BookRoomResult = Result<{ readonly bookingId: BookingId }, BookRoomFailure>;
```

Callers handle a `Result` with an exhaustive `switch` on `error.kind` ending in `assertNever`, so adding a failure variant breaks compilation where it is not handled.

## Rules

- Throw only `Error` subclasses. Never throw strings, plain objects, or `Result` values.
- Every domain and integration error carries a stable `code`. Match on `code`, not only on `instanceof`, because two copies of a package produce two classes.
- Do not expose raw infrastructure errors (driver errors, HTTP client errors, constraint violations) to application or domain code. Adapters translate them: a unique-constraint violation on the booking slot becomes the `SlotTaken` outcome or a typed integration error, decided in one place.
- Keep `catch` blocks narrow. Catch a specific code, translate it, and rethrow everything else. Never `catch {}` and continue.
- With `useUnknownInCatchVariables`, the caught value is `unknown`; narrow it before use.
- Map every failure to a response in one place in the interfaces layer: `Result` failures by `kind`, thrown errors by `code`, unknown errors to a generic 500 without internal details.
- Keep messages for logs and codes for clients. Clients receive a stable code and a safe message; stack traces and internal identifiers stay in logs.
- Do not use exceptions for control flow inside the domain, and do not use `Result` for invariant violations.

## Placement

- `domain/errors.ts` for domain errors of a context
- `application/results.ts` for the `Result` failure unions of its use cases
- `infrastructure/**/errors.ts` for integration errors and the translation of driver errors
- `interfaces/http/error-mapping.ts` for the single mapping to responses
- `shared-kernel` for `DomainError`, `Result`, `ok`, `err`, `assertNever`

The Hono binding shows the interfaces-layer mapping in [bindings/hono.md](./bindings/hono.md).
