# Tactical Patterns

How to choose the building block. For how each block is written in TypeScript, read [typescript-modeling.md](./typescript-modeling.md).

## Choose The Right Building Block

### Entity

Use an entity when identity matters across time.

Typical signs:

- Lifecycle updates matter
- Equality is identity-based
- The object participates in business rules over time

Example candidates: `Booking`, `Room`, `Member`, `Invoice`

### Value Object

Use a value object when meaning comes from attributes and validation, not identity.

Typical signs:

- Immutable after creation
- Replaced instead of updated piecemeal
- Encapsulates validation and formatting

Example candidates: `TimeSlot`, `Money`, `EmailAddress`, `Capacity`

Identifiers such as `BookingId` are value objects too. In TypeScript they are written as branded types so that two identifier types can never be mixed up.

### Aggregate

Use an aggregate to protect a consistency boundary.

Rules:

- Expose one aggregate root
- Modify internal members only through the root
- Keep transactional invariants inside the boundary
- Reference other aggregates by identifier, not by object reference
- Never hand out a mutable reference to internal state; return copies or read-only views

Do not make aggregates too large. If one write use case regularly touches many unrelated entities, the boundary is probably wrong.

### Repository

Use a repository to load and persist aggregate roots.

Rules:

- Define the repository interface (port) around domain intent, next to the domain or application layer
- Load and save whole aggregates; do not expose per-table methods
- Avoid generic CRUD-only contracts when the domain has richer concepts
- Return domain objects, never ORM rows or query-builder results
- Keep query-specific read models separate if they do not serve aggregate consistency

### Domain Service

Use a domain service when business behavior:

- Belongs to the domain
- Uses domain concepts and rules
- Does not fit naturally on a single aggregate or value object

Write it as a plain function or a small class with no I/O. If it needs data, the application service loads that data and passes it in.

Do not use domain services as a dumping ground for orchestration or infrastructure code.

### Application Service

Use an application service to:

- Accept a validated command or query
- Do asynchronous work that must happen before the change, such as calling another system
- Load aggregates
- Call domain behavior
- Save the aggregate and its pending events in one transaction
- Return a `Result` for expected business failures

Do not place core business policy here if it can live in the domain model.

### Domain Event

Use a domain event for a completed business fact.

Good examples:

- `BookingConfirmed`
- `BookingCancelled`
- `RoomRetired`

Weak examples:

- `BookingUpdated`
- `RoomSaved`

Prefer past-tense names tied to business meaning. Model the set of events of one aggregate as a discriminated union on a `type` field.

## Aggregate Design Heuristics

Ask these questions:

- What must be consistent immediately after a command completes?
- Which object should guard that rule?
- Which changes can happen asynchronously through eventual consistency?
- Which references should be identifiers instead of nested objects?
- Can the command be decided with data the aggregate holds, or does the application service need to load and pass in more?

If a rule spans multiple aggregates, prefer:

1. Enforcing local invariants per aggregate
2. Recording a domain event
3. Handling downstream updates asynchronously or in an application workflow

A rule that needs a set of aggregates to be checked atomically, such as "no two bookings of one room overlap", needs an explicit decision: make one aggregate own the set (for example a `RoomSchedule` per room and day), or enforce it with a database constraint plus a translated failure. State which one and why.

## Common Mistakes

- Letting route handlers call repositories or aggregates directly
- Putting validation only in request schemas, so the domain accepts invalid state when called from elsewhere
- Treating entities as row-shaped types with public fields
- Using setters or public mutable fields for unrestricted mutation
- Returning internal arrays or objects that callers can mutate
- Passing identifiers as raw `string`, so one kind of ID can be passed where another is expected
- Making repositories return ORM rows or every relation eagerly
- Putting transaction scripts in classes named `*DomainService`
- Making domain methods `async` or letting them perform I/O
- Publishing domain events for technical persistence actions
- Publishing events directly after saving instead of writing them to the outbox in the same transaction
