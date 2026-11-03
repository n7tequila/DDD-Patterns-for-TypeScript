# Assemblers

## Purpose

Use an assembler for pure type conversion, so route handlers, application services, persistence adapters, and ACL code do not fill up with repetitive mapping logic.

An assembler is a conversion function, not a business component.

## What Belongs In An Assembler

Good assembler responsibilities:

- Parsed request to command
- Result or read model to response body
- Row to snapshot, and snapshot to row
- Domain event to published integration event
- Foreign payload to local snapshot or value object, inside an ACL

Assemblers are deterministic and side-effect free.

## What Does Not Belong In An Assembler

Do not put these in an assembler:

- Aggregate invariants
- Domain decisions
- Transaction boundaries
- Repository calls or any other I/O
- Service orchestration
- Authorization rules
- Default values that carry business meaning
- Multi-step business workflows

If a function chooses what the business should do, it is not an assembler.

## Shape In TypeScript

Write assemblers as exported functions, not classes. Name them by direction.

```ts
// booking/src/interfaces/http/schemas.ts
import { z } from "zod";

export const bookRoomRequest = z.object({
  roomId: z.string(),
  start: z.number().int(),
  end: z.number().int(),
});
```

```ts
// booking/src/interfaces/http/booking-assemblers.ts
import type { z } from "zod";
import { bookRoomRequest } from "./schemas";

export function toBookRoomCommand(body: z.infer<typeof bookRoomRequest>, organizer: MemberId): BookRoomCommand {
  return {
    roomId: toRoomId(body.roomId),
    organizer,
    slot: TimeSlot.of(toEpochMillis(body.start), toEpochMillis(body.end)),
  };
}
```

Rules:

- Input is already parsed by a schema; output is domain-typed.
- Branded identifiers and value objects are built through their constructor functions and factories, so invalid data is rejected, not normalized.
- Keep each function small enough to test with a table of inputs and outputs.
- Return types owned by the target boundary.

If conversion needs I/O, split it: the adapter performs the I/O, the assembler converts.

## Placement Rules

Place assemblers next to the boundary they serve:

- `interfaces/http/`
- `application/`
- `infrastructure/persistence/`
- `infrastructure/acl/<foreign>/`

Avoid one global `mappers` folder shared by unrelated layers. It hides ownership and mixes dependencies.

## Relationship To ACL

An ACL contains translators, but an ACL and an assembler are not the same concept.

- An assembler answers: how do these two types convert?
- An ACL answers: how do we protect this bounded context from a foreign model?

So:

- Every ACL contains translation functions
- Not every assembler belongs to an ACL

Examples:

- `toBookRoomCommand`: interface-layer conversion, not ACL
- `toBookingRow`, `fromBookingRow`: persistence mapping, not ACL
- `toRoomSnapshot`: ACL translation, because it protects booking from room-catalog

## Naming

Use direction-revealing names: `toBookRoomCommand`, `toBookingResponse`, `toBookingRow`, `fromBookingRow`, `toRoomSnapshot`, `toBookingConfirmedV1`.

Use "translator" for files that perform cross-context, foreign-to-local translation, and "assembler" or "mapper" for boundary-local conversion. Either is fine if the role is clear.
