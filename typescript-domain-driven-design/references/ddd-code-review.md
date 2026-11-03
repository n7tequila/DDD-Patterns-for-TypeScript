# DDD Code Review

## Purpose

Review existing TypeScript code against Domain-Driven Design principles. Unlike the checklist, which verifies your own work before delivery, this reference guides a critical review of code you did not necessarily write, where design intent may not be documented and problems must be inferred from the code itself.

TypeScript adds failure modes that Java does not have: structural typing makes identifiers interchangeable, types disappear at runtime, and synchronous database drivers silently ignore asynchronous transaction callbacks. This catalog lists them next to the classic DDD smells.

## When To Use

- Reviewing a pull request for DDD adherence
- Auditing an existing codebase for architectural health
- Evaluating legacy code before a refactoring initiative
- Assessing whether a team's code follows its stated DDD conventions

## Review Workflow

Follow this sequence:

1. **Map the structure.** Identify workspace packages, folders, public entry points, and import directions before reading function bodies. If the project has dependency-cruiser or lint configured, note which rules exist and whether they run in CI.
2. **Locate the domain.** Find where business logic lives and where it has leaked.
3. **Check layer boundaries.** Verify that each layer imports only layers closer to the domain, and that no code deep-imports another context's internals.
4. **Check the type-level guarantees.** Look for identifiers typed as `string`, casts to branded types, classes without private state, and unparsed input crossing a boundary.
5. **Check transactions and side effects.** Look for asynchronous transaction callbacks, transaction handles kept beyond their callback, events published outside the transaction that saved the aggregate, and floating promises.
6. **Evaluate tactical patterns.** Assess whether entities, value objects, aggregates, and services are used correctly.
7. **Assess strategic alignment.** Determine whether bounded context boundaries are respected.
8. **Report findings.** Use the severity model and the catalog below, highest consequence first.

Do not skip step 1. Reviewing function-level details without the structural picture leads to shallow findings.

## Severity Model

| Level | Meaning | Action |
|-------|---------|--------|
| CRITICAL | Business logic is lost, invariants are unprotected, data can be written half-way or to the wrong owner, or a layer boundary is fundamentally broken | Must fix before merge or before the next feature touches this area |
| HIGH | A DDD pattern is misapplied in a way that will cause maintenance pain or subtle bugs | Should fix soon; flag for the next iteration |
| MEDIUM | Design drift that reduces clarity but does not immediately risk correctness | Track and address when the area is next modified |
| LOW | Naming, style, or minor structural improvement | Optional; fix opportunistically |

Assign severity by the consequence, not by how easy the problem is to spot.

A violation of any numbered rule in [strong-rules.md](./strong-rules.md) is at least HIGH. Strong rules 5, 10, 11, 12, and 13 are CRITICAL when the affected data belongs to a user or crosses a trust boundary.

## Code Smell Catalog

### Layer Violations

| Smell | Signs | Severity | Fix |
|-------|-------|----------|-----|
| Domain depends on infrastructure or libraries | Domain file imports an ORM, zod, Hono, an HTTP client, `node:*`, `bun:*`, or calls `fetch`, `Date.now()`, `crypto.randomUUID()` | CRITICAL | Define a port or pass the value in; move the implementation to infrastructure |
| Route handler calls a repository or aggregate | A handler loads, changes, or saves an aggregate itself | CRITICAL | Introduce an application service; the handler builds a command and delegates |
| Business logic in a route handler | A handler derives roles, checks ownership or state, fills business defaults, or branches on domain conditions | CRITICAL | Move the decision into the aggregate or the application service; the handler only parses, delegates, and maps |
| Business logic in a repository adapter | The adapter filters, calculates, or decides | HIGH | Move it to the aggregate or a domain service; keep the adapter as persistence |
| Application service contains domain policy | The service decides what an aggregate or value object should decide | HIGH | Move the policy into the domain; the service coordinates |
| Business default in the application or assembler | A missing field is filled with a value that carries business meaning, such as a currency or a time zone | HIGH | Make the field required in the command, or let the domain own the default explicitly |
| Infrastructure type used by the interfaces layer | A route file imports an ORM schema or a repository | HIGH | Route types and ports belong in application (strong rule 2) |
| Deep import into another context | `import ... from "../../other-context/src/domain/..."` or a package path past its entry point | HIGH | Use the other context's facade or published contract (strong rule 8) |
| Layer rules not enforced | No dependency-cruiser or equivalent in CI, or rules set to warn | HIGH | Add the rules from [enforcement.md](./enforcement.md) as errors (strong rule 4) |

### Type-Level Guarantees

| Smell | Signs | Severity | Fix |
|-------|-------|----------|-----|
| Interchangeable identifiers | IDs typed as `string`, or identifier classes with only public fields (`class OrderId { constructor(readonly value: string) {} }`), so one kind of ID is accepted where another is expected | CRITICAL when the ID decides ownership or access, otherwise HIGH | Branded types created only by constructor functions (strong rule 12) |
| Cast to a branded type outside its constructor | `raw as MemberId`, `body.id as BookingId` | HIGH | Call the constructor function; it validates |
| Unparsed input crossing a boundary | `await req.json() as CreateRequest`, `JSON.parse(text) as Event`, environment variables read without a schema, model output trusted as typed | CRITICAL at a trust boundary | Parse with a schema at the boundary (strong rule 13) |
| Forgeable value object | A value object class has only public `readonly` fields, so an object literal passes for it without validation | HIGH | Keep state in `#private` fields; read them in `equals` |
| Enumeration column trusted on read | An ORM column typed as a union (`$type<Status>()`) is passed into the aggregate unchecked | HIGH | Rebuild it through a constructor function that rejects unknown values |
| Runtime privacy assumed from `private` | Sensitive state relies on the `private` keyword, which is readable at runtime and serialized by `JSON.stringify` | MEDIUM | Use `#private` |
| `enum` in the domain | TypeScript `enum` used for domain states | LOW | Use a string literal union |

### Transactions And Side Effects

| Smell | Signs | Severity | Fix |
|-------|-------|----------|-----|
| Asynchronous transaction callback | `db.transaction(async (tx) => ...)` with a synchronous driver, or an `await` inside a transaction | CRITICAL | Do asynchronous work before the transaction; enter it through a unit of work whose callback type rejects promises (strong rule 11) |
| Transaction handle escapes its callback | `tx` or a transaction-bound repository is stored in a variable, field, or closure used later | CRITICAL | Pass only a scope that refuses to work after the transaction ends |
| Events published outside the transaction | `await repo.save(x); bus.publish(event)` | CRITICAL | Write events to the outbox in the same transaction; deliver from the outbox (strong rule 10) |
| Floating promise | A promise neither awaited, returned, nor supervised; often `eventBus.publish(e)` without `await` | HIGH | Await or supervise it; enable `no-floating-promises` (strong rule 14) |
| Side effects written by a wrapper | A decorator, middleware, or higher-order function writes audit or messages around the use case | HIGH | Route them through the outbox in the business transaction |
| Read-then-write without the write lock | The invariant check reads, then writes, in a transaction that takes the lock only at the first write | MEDIUM | Start the transaction as `IMMEDIATE` (SQLite) or use a constraint or lock |
| Relay without containment or re-entrancy | One failing delivery stops the loop, or overlapping runs deliver the same row | HIGH | Per-message failure handling and a re-entrancy guard |

### Anemic Domain Model

| Smell | Signs | Severity | Fix |
|-------|-------|----------|-----|
| Entity is a row-shaped type | Aggregate is an `interface` or a class with public mutable fields; all logic lives in services | CRITICAL | Add intention-revealing methods that enforce the invariants; hide state in `#private` fields |
| Service does what the entity should | A service reads an aggregate's fields, decides, and writes them back | HIGH | Move the decision onto the aggregate |
| Mutable value object | Value object fields are writable, or operations mutate in place | HIGH | Make it immutable; operations return new instances |
| Internal collection handed out | A getter returns the aggregate's own array or map | HIGH | Return a copy or a read-only view |
| Validation only in request schemas | Business rules exist only in zod schemas at the edge | HIGH | Enforce invariants in the domain factory or method; the schema gives early feedback |

### Aggregate Design

| Smell | Signs | Severity | Fix |
|-------|-------|----------|-----|
| Aggregate too large | One root owns many unrelated entities; loading it is expensive; writes often conflict | HIGH | Split; connect by identifiers and events |
| Aggregate boundary missing | No clear root; code changes child entities directly | CRITICAL | Designate a root; all writes go through its methods |
| Cross-aggregate object reference | One aggregate holds another aggregate object instead of its identifier | HIGH | Reference by identifier |
| Repository per entity | Non-root entities have their own repositories | HIGH | One repository per aggregate root |
| Transaction spans aggregates | One use case modifies two roots in one transaction without a stated reason | MEDIUM | Merge the aggregates or use eventual consistency |
| Row-level authorization outside the aggregate | Ownership is checked in middleware, a handler, or not at all; only the role is checked | CRITICAL | A guard method on the aggregate, called before any change; same rule in query `WHERE` clauses (strong rule 5) |
| Reconstitution records events | Loading from storage goes through `create` or records events | HIGH | Separate `create` and `reconstitute` |

### Bounded Context

| Smell | Signs | Severity | Fix |
|-------|-------|----------|-----|
| One giant context | One package mixes concepts with different language | HIGH | Split along language boundaries |
| Foreign model leaks in | Another context's or system's types, enums, or payloads are used directly in domain or application code | CRITICAL | Introduce an ACL that parses and translates |
| Shared database as integration | Two contexts read and write the same tables | HIGH | Owned tables per context; integrate through facades, events, or contracts |
| Domain types in published contracts | Contracts export classes, branded types, or `Date`, or import domain modules | HIGH | Plain-data schemas in a contracts package |
| Shared kernel is bloated | The kernel holds context-specific logic, schemas, ORM code, or runtime dependencies | MEDIUM | Trim it to stable, domain-neutral abstractions |

### Domain Events

| Smell | Signs | Severity | Fix |
|-------|-------|----------|-----|
| CRUD events | `*Updated`, `*Saved`, `*Changed` with no business meaning | MEDIUM | Name the business fact |
| Event carries the aggregate | The payload is the aggregate or its snapshot | MEDIUM | Carry only what consumers need; convert to a published contract |
| Event used as a command | Imperative event names; the handler makes the caller's decision | HIGH | Use a command; keep events for completed facts |
| Events not a discriminated union | Events are untyped objects or classes without a literal `type` | LOW | A union with a literal `type` and exhaustive handling |

### Repositories

| Smell | Signs | Severity | Fix |
|-------|-------|----------|-----|
| Repository returns ORM rows | Methods return query-builder results or row types | HIGH | Return aggregates rebuilt through `reconstitute` |
| Generic CRUD repository | `save`, `delete`, `findAll` with no domain intent | MEDIUM | Intention-revealing methods |
| Reads forced through the aggregate repository | Lists and reports load aggregates | MEDIUM | A query port with read models |
| Port defined in infrastructure | The repository interface lives next to its implementation | MEDIUM | Move it to domain or application |
| Unbounded list query | No limit, or a client-controlled limit without a cap | MEDIUM | Cap the page size in the query |

### Error Handling

| Smell | Signs | Severity | Fix |
|-------|-------|----------|-----|
| Generic `Error` everywhere | Invariant violations throw `new Error("...")` without a code | HIGH | Typed domain errors with stable codes |
| Thrown strings or objects | `throw "invalid"`, `throw { code }` | HIGH | Throw `Error` subclasses only |
| Expected outcome thrown, or invariant returned | A normal business outcome (slot taken) is thrown, or an invariant violation is returned as a `Result` | MEDIUM | Apply the throw-or-return test in [error-handling.md](./error-handling.md) |
| Infrastructure error reaches the domain or the client | Driver errors caught in domain code, or returned to clients | CRITICAL | Translate at the adapter boundary; map in one place |
| Silent failure | Empty `catch`, or a `catch` that only logs and continues after a failed business write | CRITICAL | Narrow the catch; translate or rethrow |
| Raw input echoed in messages | Error messages include the client's input and reach the response | MEDIUM | Name the field, not its content |
| Matching only by `instanceof` | Error mapping relies on class identity across packages | LOW | Match on `code` |

### Naming And Language

| Smell | Signs | Severity | Fix |
|-------|-------|----------|-----|
| Technical names in the domain | `*Manager`, `*Handler`, `*Processor`, `*Util` | MEDIUM | Use the ubiquitous language |
| Generic method names | `process`, `handle`, `update` on aggregates | MEDIUM | Business verbs: `confirm`, `cancel`, `checkIn` |
| Inconsistent language across contexts | One concept, several names, no explicit translation | MEDIUM | Document the translation; keep each context consistent |

## Reverse-Engineering Guidance

When reviewing code without design documentation, reconstruct the domain model before judging it:

1. **Find the nouns.** Type, class, and field names reveal the implicit ubiquitous language.
2. **Find the verbs.** Exported functions and methods on services and routes reveal the implicit commands.
3. **Trace the writes.** Follow every path that changes state, including the transaction it runs in and what is published afterwards.
4. **Map the imports.** Draw the actual import graph between folders and packages (dependency-cruiser can output it). Compare it to the intended layering.
5. **Follow the identifiers.** For each kind of ID, find where it is created, where it is cast, and where it decides ownership.
6. **Identify the seams.** Find where integration happens and whether foreign data is parsed there.

After reconstruction, compare the implicit model to the DDD ideal. Gaps are findings.

## Review Output Template

```
## DDD Code Review: [Scope]

### Structure Summary
- What was reviewed (packages, folders, key modules)
- Import direction assessment (correct or violated); enforcement tooling present or absent

### Findings

#### [CRITICAL] Title
- Location: path/to/file.ts:line
- Problem: what is wrong
- Evidence: the specific code, import, or missing guard
- Rule: strong rule number or catalog smell
- Fix: concrete remediation step

#### [HIGH] Title
...

#### [MEDIUM] Title
...

#### [LOW] Title
...

### Overall Assessment
- One paragraph on the most important structural issues
- Prioritized list of what to fix first

### Positive Observations
- Patterns done well and worth keeping
```

Do not list every minor issue at the top. Lead with the findings that have the highest consequence. Do not report a smell without evidence from the code; if a finding depends on behavior you could not see, say so.

## Integration With Other References

- [strong-rules.md](./strong-rules.md) for merge-blocking rules and their severity
- [tactical-patterns.md](./tactical-patterns.md) and [typescript-modeling.md](./typescript-modeling.md) to judge building blocks and their TypeScript form
- [typescript-ddd-layout.md](./typescript-ddd-layout.md) and [workspace-structures.md](./workspace-structures.md) to judge structure
- [consistency-and-sagas.md](./consistency-and-sagas.md) and [bindings/drizzle.md](./bindings/drizzle.md) for transactions and the outbox
- [anti-corruption-layer.md](./anti-corruption-layer.md) for cross-context integration
- [error-handling.md](./error-handling.md) for failure patterns
- [testing-strategy.md](./testing-strategy.md) to judge whether tests match layer responsibilities
- [ddd-checklist.md](./ddd-checklist.md) as a lighter self-check after fixes
