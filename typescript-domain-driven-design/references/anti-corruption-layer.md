# Anti-Corruption Layer

## Purpose

Use an Anti-Corruption Layer (ACL) to prevent foreign models from leaking into the local bounded context.

Typical triggers:

- Integrating with a legacy system
- Calling a third-party API with incompatible terminology
- Consuming another bounded context whose concepts do not align with local ubiquitous language
- Consuming the output of a language model or any other source whose shape is not guaranteed
- Migrating from table-centric or service-centric designs into a richer local domain model

An ACL is a translation boundary, not just an HTTP client or a type mapper.

## What The ACL Should Do

An ACL may contain:

- External clients
- Schemas for foreign requests and responses
- Translators from foreign payloads to local commands, value objects, or snapshots
- Error and status mapping
- Retry, timeout, and protocol handling that belongs to the integration boundary

An ACL protects the local domain language. After translation, local application services work only with local concepts.

## What The ACL Should Not Do

Do not use the ACL for:

- Core aggregate invariants
- Local domain behavior
- Replacing application services
- Shared kernel abstractions
- Generic mapper utilities with no boundary ownership

If the code still speaks in upstream terms after crossing the boundary, the ACL is incomplete.

## Placement In A TypeScript Project

Place ACL code in `infrastructure/acl/<foreign-context>/`.

```text
booking/src/
  application/
    ports.ts                        # RoomCatalog port, expressed in booking's language
  domain/
    room-snapshot.ts                # the local type booking owns
  infrastructure/
    acl/
      room-catalog/
        room-catalog-client.ts      # speaks the foreign protocol (facade call or HTTP)
        room-catalog-schemas.ts     # zod schemas of the foreign payload
        room-catalog-translator.ts  # foreign payload -> RoomSnapshot
        room-catalog-errors.ts      # remote failures -> local integration errors
        room-catalog-adapter.ts     # implements the RoomCatalog port using the three above
```

Responsibilities:

- the client speaks the external protocol and nothing else
- the schemas describe the foreign contract as the local context understands it
- the translator converts foreign data into local types and rejects what cannot be expressed
- the error module converts remote failures into local integration errors
- the adapter implements the application's port by combining them

For cross-context reads, introduce a local snapshot rather than reusing the upstream model. Booking needs a room's capacity and whether it is bookable, not the room-catalog aggregate. Translate that into a `RoomSnapshot` owned by booking.

## Example

```ts
// booking/src/domain/room-snapshot.ts
export interface RoomSnapshot {
  readonly roomId: RoomId;
  readonly capacity: number;
  readonly bookable: boolean;
}
```

```ts
// booking/src/application/ports.ts
export interface RoomCatalog {
  findRoom(roomId: RoomId): Promise<RoomSnapshot | undefined>;
}
```

```ts
// booking/src/infrastructure/acl/room-catalog/room-catalog-schemas.ts
import { z } from "zod";

export const catalogRoomPayload = z.object({
  room_id: z.string(),
  seats: z.number().int().nonnegative(),
  lifecycle: z.enum(["DRAFT", "ACTIVE", "UNDER_MAINTENANCE", "RETIRED"]),
});
export type CatalogRoomPayload = z.infer<typeof catalogRoomPayload>;
```

```ts
// booking/src/infrastructure/acl/room-catalog/room-catalog-translator.ts
export function toRoomSnapshot(payload: CatalogRoomPayload): RoomSnapshot {
  return {
    roomId: toRoomId(payload.room_id),
    capacity: payload.seats,
    bookable: payload.lifecycle === "ACTIVE",
  };
}
```

```ts
// booking/src/infrastructure/acl/room-catalog/room-catalog-adapter.ts
export interface RoomCatalogClient {
  fetchRoom(roomId: string): Promise<unknown | undefined>;
}

export class RoomCatalogAdapter implements RoomCatalog {
  constructor(private readonly client: RoomCatalogClient) {}

  async findRoom(roomId: RoomId): Promise<RoomSnapshot | undefined> {
    const raw = await this.client.fetchRoom(roomId);
    if (raw === undefined) return undefined;
    const parsed = catalogRoomPayload.safeParse(raw);
    if (!parsed.success) throw new IntegrationError("ROOM_CATALOG_CONTRACT_VIOLATION", parsed.error.message);
    return toRoomSnapshot(parsed.data);
  }
}

export class IntegrationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
```

The client returns `unknown`. The adapter parses before translating, so a changed upstream contract fails at the boundary with a named error instead of corrupting local state.

## Translation Rules

Apply these rules:

- Parse every foreign payload with a schema before reading it; the client's return type is `unknown`
- Translate foreign identifiers into local branded types through their constructor functions
- Translate foreign statuses into local unions or booleans; never import a foreign enum
- Translate remote timestamps, money, and codes into local types (`EpochMillis`, local value objects)
- Reject or quarantine payloads that cannot be expressed safely in the local model
- Keep translation explicit; no generic deep-copy or reflection-style mappers

If translation is lossy, document the tradeoff and keep the loss at the boundary.

## Relationship To Other DDD Elements

- The shared kernel is for truly shared, stable abstractions; the ACL separates mismatched models
- The application service orchestrates the use case; the ACL performs foreign-to-local translation
- The domain model enforces invariants after translated input enters the local context
- The repository persists local aggregates; it does not speak a foreign protocol

## Shared Kernel Versus ACL

Choose the shared kernel when:

- Both contexts are controlled by closely aligned people
- The abstraction is stable and genuinely shared
- Coordination cost is acceptable

Choose an ACL when:

- The upstream model changes on its own cadence
- The local context needs only a translated subset of upstream data
- The same real-world concept has a different meaning across contexts
- You want to preserve local ubiquitous language without inheriting upstream design

Do not move context-specific snapshots such as `RoomSnapshot` into the shared kernel merely because several contexts integrate with rooms. If a type exists to protect one context from another, it belongs to the consuming context and its ACL.

## Decision Test

Use an ACL when one or more of these are true:

1. The upstream model uses terms your local domain should not adopt
2. The upstream lifecycle or status model does not match your aggregate lifecycle
3. You need explicit validation, translation, or sanitization before invoking local domain logic
4. Direct reuse of upstream types would leak technical or business coupling into the domain

If none of these are true, a plain adapter may be enough. If they are true, prefer a named ACL over informal mapping scattered across the code.
