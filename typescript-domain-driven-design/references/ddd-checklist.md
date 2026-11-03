# TypeScript DDD Checklist

A final self-check before delivering architecture or code. For reviewing code someone else wrote, use [ddd-code-review.md](./ddd-code-review.md).

## Strategic Design

### Bounded Contexts

- [ ] Domain boundaries are identified and documented
- [ ] The context map shows relationships such as ACL, Conformist, Published Language, or Shared Kernel
- [ ] Each bounded context has clear ownership and owns its tables
- [ ] Ubiquitous language is defined per bounded context
- [ ] Integration style is explicit: in-process facade, HTTP, events from the outbox, or batch

### Published Language And Contracts

- [ ] Shared contracts are zod schemas with exported inferred types, versioned when compatibility matters
- [ ] Contracts contain plain data only; no classes, branded types, or `Date`
- [ ] Contracts are separate from local aggregates and snapshots, and import nothing from a domain

### Anti-Corruption Layer

- [ ] An ACL is introduced wherever upstream language would otherwise pollute the local model
- [ ] The ACL client returns `unknown`, and the adapter parses before translating
- [ ] Foreign enums, statuses, and payloads do not leak into the local domain
- [ ] Context-specific snapshots are used when upstream data is needed locally

### Ubiquitous Language

- [ ] Code uses domain terminology instead of technical jargon
- [ ] Type, function, file, folder, and event names reflect the agreed language

## Tactical Design

### Identifiers

- [ ] Every identifier has its own branded type
- [ ] Branded values are created only by constructor functions; no other casts
- [ ] Persistence columns for identifiers and enumerations are declared with their domain types

### Entities And Aggregates

- [ ] The aggregate root is a class with state in `#private` fields
- [ ] State changes happen through methods named with business verbs that enforce invariants
- [ ] `create` validates and records events; `reconstitute` records none
- [ ] Other aggregates are referenced by identifier
- [ ] Getters never return mutable internal collections
- [ ] Row-level authorization is a guard method on the aggregate
- [ ] The aggregate's size matches its consistency needs

### Value Objects

- [ ] Immutable, frozen, with state in `#private` fields
- [ ] Equality is based on attributes
- [ ] Validation happens in the factory; operations return new instances
- [ ] Single constrained scalars are branded primitives

### Domain Events

- [ ] Events are a discriminated union with a literal `type`, named in the past tense
- [ ] Events are drained with `pullPendingEvents()` and written to the outbox in the saving transaction
- [ ] Payloads published to other contexts are converted to contracts first

### Repositories

- [ ] Ports live in domain or application; implementations in infrastructure
- [ ] Repositories return aggregates, never rows
- [ ] Rows are rebuilt through constructor functions, including enumerations
- [ ] Optimistic concurrency is checked on update

### Domain Services

- [ ] Used only when behavior does not fit an aggregate or value object
- [ ] Synchronous, no I/O, named in domain language

## Layered Architecture

### Domain Layer

- [ ] Imports only ECMAScript built-ins, the shared kernel, and its own domain
- [ ] No `Date.now()`, `crypto`, `fetch`, timers, or runtime modules
- [ ] Domain rules are testable without infrastructure

### Application Layer

- [ ] Use cases coordinate workflows and own transaction boundaries
- [ ] Asynchronous work happens before the transaction; the transaction callback is synchronous
- [ ] Expected business failures are returned as discriminated-union results
- [ ] Commands are domain-typed, so an unvalidated command does not compile
- [ ] Types used by both the interfaces and infrastructure layers live here

### Infrastructure Layer

- [ ] Adapters implement ports; no domain behavior is redefined here
- [ ] All transactions go through the unit of work; no raw transaction handle leaves it
- [ ] Runtime-specific APIs appear only here
- [ ] The outbox relay contains failures per message and does not run concurrently with itself

### Interfaces Layer

- [ ] Handlers parse with schemas, build a command, call one service, and map the result
- [ ] No business decisions, role derivation, or business defaults in handlers
- [ ] Failures are mapped in one place; unknown errors become a generic 500 and are logged
- [ ] Error messages do not echo client input

### Composition

- [ ] Each context exposes a module factory as its public entry point
- [ ] The composition root creates runtime adapters and passes them to module factories; it imports no context internals
- [ ] A smoke test builds the full graph and runs one main flow

### Query Side

- [ ] Read models are separate from write-side aggregates where reads differ
- [ ] Visibility rules are part of the query; pages are capped

## TypeScript And Tooling Specifics

- [ ] `strict` plus the extra flags from [enforcement.md](./enforcement.md)
- [ ] dependency-cruiser rules run in CI as errors
- [ ] `no-floating-promises` and `no-misused-promises` are errors
- [ ] A type-guard file with `@ts-expect-error` lines is checked by `tsc`
- [ ] TypeScript version is compatible with the lint and dependency tooling in use
- [ ] For single-file builds, migrations are embedded and checked against the generator's journal at startup

## Testing

- [ ] Domain logic has focused unit tests, including events and invariants
- [ ] Application services are tested with an in-memory unit of work of the same synchronous shape
- [ ] Persistence is tested against the real driver: rollback, leaked scope, locking, corrupted rows
- [ ] ACL translators and assemblers have mapping tests
- [ ] Each test that guards a strong rule has been seen failing once

## Error Handling

- [ ] Domain invariant failures are distinct from integration and transport failures
- [ ] Every thrown error is an `Error` subclass with a stable `code`
- [ ] Integration failures are translated at the adapter boundary

## Anti-Patterns Avoided

- [ ] No anemic domain model
- [ ] No business logic in handlers, assemblers, or repository adapters
- [ ] No direct repository access from handlers
- [ ] No circular dependency between contexts
- [ ] No aggregate designed purely around database tables
- [ ] No events published outside the transaction that saved the aggregate
