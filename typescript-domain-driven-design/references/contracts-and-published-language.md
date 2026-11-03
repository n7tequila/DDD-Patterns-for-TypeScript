# Contracts And Published Language

## Purpose

Use published language for stable schemas shared across bounded contexts, services, clients, or deployments.

Typical examples:

- integration event payloads written to the outbox
- public API request and response schemas
- schemas shared between the backend and a TypeScript frontend

Published language is not the same as local domain language.

## Rules

- Keep published contracts separate from local aggregates, value objects, and snapshots
- Define each contract as a schema (zod in the default stack) and export the inferred type; the schema is the source of truth
- Contracts contain plain data only: strings, numbers, booleans, arrays, plain objects. No classes, no branded types, no `Date`
- Version contracts when compatibility matters; put the version in the event type name or a `version` field
- Translate between contracts and local models at the boundary, in an assembler
- Consumers parse contracts they receive; producers build them through the schema type so the compiler checks the shape

Branded types do not survive serialization and mean nothing to another context. A consumer turns contract strings back into its own branded types when it translates.

## Integration Event Envelope

```ts
// contracts/src/booking-events.ts
import { z } from "zod";

export const bookingConfirmedV1 = z.object({
  type: z.literal("booking.confirmed"),
  version: z.literal(1),
  eventId: z.string(),
  occurredAt: z.number().int(),
  payload: z.object({
    bookingId: z.string(),
    roomId: z.string(),
    start: z.number().int(),
    end: z.number().int(),
  }),
});
export type BookingConfirmedV1 = z.infer<typeof bookingConfirmedV1>;
```

Compatibility rules for a published version:

- Adding an optional field is compatible
- Removing a field, renaming it, changing its type, or making it required is breaking: publish a new version and keep producing the old one until consumers have moved
- Consumers accept unknown extra fields (do not use strict object parsing on received events)

## Placement

Possible locations:

- a dedicated `contracts` workspace package, when several contexts or a frontend consume the contract
- `infrastructure/messaging/contracts/` inside the producing context, when only one consumer exists
- `interfaces/http/schemas.ts` for API schemas that only that context serves

Choose one approach per kind of contract and keep it consistent.

## What Not To Do

Do not:

- serialize domain events or aggregates as event payloads
- expose internal aggregate structure directly over APIs
- put internal command types or `Result` failure unions into the shared contracts package
- import domain types into the contracts package; the dependency goes the other way, from the context's assemblers to the contracts

## Shared Kernel Versus Contracts

- `shared-kernel` contains stable modeling abstractions used inside contexts
- `contracts` contains published schemas for communication between contexts, services, and clients

If a type exists to cross a boundary, it is more likely a contract than shared kernel.
