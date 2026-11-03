# TypeScript DDD Layout

## Recommended Folder Structure

Use a feature-oriented layout inside each bounded context. One context is one workspace package (see [workspace-structures.md](./workspace-structures.md)) or, in a single-package service, one top-level folder.

```text
booking/
  package.json                     # "exports" points only at src/index.ts
  src/
    index.ts                       # the public entry point: module factory, facade types, published contracts
    module.ts                      # module factory: wires this context from runtime-level dependencies
    domain/
      ids.ts                       # BookingId, RoomId, MemberId and their constructors
      time-slot.ts                 # value object
      booking.ts                   # aggregate root, its events and snapshot type
      booking-repository.ts        # repository port (interface)
      errors.ts                    # domain errors of this context
    application/
      commands.ts                  # command and query input types (already-parsed, domain-typed)
      book-room.ts                 # application service, one file per use case
      cancel-booking.ts
      ports.ts                     # ports the application needs: RoomCatalog, UnitOfWork, Outbox
      results.ts                   # Result types returned by the use cases
      facade.ts                    # what other contexts and the app package may call
    infrastructure/
      persistence/
        schema.ts                  # ORM table definitions
        booking-row-mapper.ts      # row <-> snapshot / aggregate
        drizzle-booking-repository.ts
        drizzle-unit-of-work.ts
        outbox-writer.ts
      acl/
        room-catalog/
          room-catalog-client.ts   # calls the other context through its facade or API
          room-catalog-translator.ts
      messaging/
        outbox-relay.ts
    interfaces/
      http/
        routes.ts                  # route registration
        schemas.ts                 # request and response schemas (zod)
        error-mapping.ts
        response-assembler.ts
  test/
    domain/
    application/
    infrastructure/
```

If the project has multiple bounded contexts, repeat this structure per context instead of creating one global `domain` folder for everything.

When a context integrates with a foreign model, put the client, the foreign payload schemas, and the translator under `infrastructure/acl/<foreign-context>/`. Place the translated local type, such as a `RoomSnapshot` the booking context owns, in the consuming context's `domain` or `application` folder, not inside the ACL folder. The ACL owns translation; the consuming context owns the translated type.

## Public Entry Point

Each context exposes exactly one entry point, `src/index.ts`, and its `package.json` declares only that entry in `"exports"`.

- Export a module factory (`createBookingModule(deps)`) that takes runtime-level dependencies (database handle, clock, ID generator, clients of other contexts) and wires the context's own internals. The composition root calls it and never imports the context's infrastructure.
- Export the facade and route types callers need, the command and result types, and the context's migration function, which the composition root calls at startup.
- Do not export aggregates, repositories, ORM schemas, or infrastructure classes.
- Do not use barrel files inside a context to re-export everything; they hide the import graph and create cycles. The single public `index.ts` is the only barrel.

Deep imports such as `booking/src/domain/booking` from another package are forbidden. Package `"exports"` makes them fail to resolve; dependency-cruiser catches the rest (see [enforcement.md](./enforcement.md)).

## Dependency Direction

Keep imports pointing inward toward domain intent:

- `interfaces -> application`, plus domain identifier constructors, value objects, and errors for building commands
- `infrastructure -> application, domain`
- `application -> domain`
- `domain -> shared kernel only`

The composition root, in the app package, is the only place that creates runtime adapters (database, server, clock) and hands them to each context's module factory.

Avoid cyclic dependencies between bounded contexts. Use facades, published events, or anti-corruption layers.

## Coding Conventions

Prefer these conventions:

- File names in kebab-case, one main export per file; type and class names in PascalCase
- Aggregate root methods use business verbs: `confirm()`, `checkIn()`, `cancel()`
- Value objects validate themselves in their factory
- Repository ports express intent: `findById`, `save`, `existsOverlapping`
- Application services are named by use case (`bookRoom`, `cancelBooking`), not by generic entity CRUD
- Request and response types stay in the interfaces layer
- Assemblers stay near the boundary they translate for
- Ports are `interface` types; adapters are classes or factory functions that implement them

## Persistence Placement

- ORM table definitions, row types, and query code stay in `infrastructure/persistence`
- Repositories implement domain ports and translate between rows and aggregates
- Rows become aggregates only through `reconstitute`, with value objects rebuilt through their factories
- ORM-specific concepts (lazy relations, query builders, transaction handles) never reach domain or application code; application code sees only the `UnitOfWork` port

Do not let ORM schema types double as domain types, even when the shapes match today.

## ACL Placement

Use an Anti-Corruption Layer when:

- A legacy system has incompatible terminology or data shape
- Another bounded context exposes concepts that do not match local language
- A third-party API or a model response forces technical statuses or payload structures that should not enter the domain

Recommended responsibilities:

- Calling the external client
- Validating the foreign payload with a schema
- Translating it into local commands, value objects, and snapshots
- Isolating retries, timeouts, remote error mapping, and protocol details

Do not place aggregate rules in the ACL. The ACL protects the domain boundary; it does not replace the domain model. See [anti-corruption-layer.md](./anti-corruption-layer.md).

## Assembler Placement

Use assemblers to keep conversion logic out of route handlers, application services, and adapters when the mapping is non-trivial or repeated.

Recommended placement:

- `interfaces/http/`: parsed request to command, result or read model to response body
- `application/`: conversion between use-case input types, when needed
- `infrastructure/persistence/`: row to snapshot and aggregate, aggregate to row
- `infrastructure/acl/<foreign>/`: foreign payload to local snapshot, command, or value object

Do not centralize all conversions in one global `mappers` folder. See [assemblers.md](./assemblers.md).

## Query Side

When the use case is read-heavy, add dedicated query-side code instead of forcing everything through aggregate repositories.

Common locations:

- `application/queries/` for query handlers and read model types
- `infrastructure/projections/` for SQL that builds read models or keeps projection tables up to date
- `interfaces/http/` for response shapes

Keep aggregate repositories focused on write consistency. See [query-side.md](./query-side.md).

## Package Layout

For medium or large systems, prefer:

- `shared-kernel`
- one package per bounded context, such as `booking`, `room-catalog`, `notifications`
- an optional `contracts` package for published language shared across contexts
- one `app` package with the composition root, configuration, HTTP server, and process lifecycle

Keep dependencies one-way:

- context packages may depend on `shared-kernel` and `contracts`
- `app` may depend on every context package
- context packages do not depend on each other's internals
- cross-context interaction goes through facades, published events, or ACLs

## Response Template For Coding Tasks

When producing code, prefer this order:

1. State assumptions in 2–5 lines
2. Show the folder or package structure
3. Implement the domain model
4. Implement the application service
5. Implement the repository port and adapter sketch
6. Implement the interfaces layer if requested
7. Show the composition root wiring
8. End with short notes on invariants, transaction boundaries, and extension points
