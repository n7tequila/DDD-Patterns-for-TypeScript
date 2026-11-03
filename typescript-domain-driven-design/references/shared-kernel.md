# Shared Kernel

## Purpose

Use a `shared-kernel` package only for domain abstractions that are:

- Stable over time
- Shared by at least two bounded contexts
- Independent from frameworks, ORMs, validation libraries, HTTP, messaging, and runtime-specific APIs
- Small enough that changes remain rare and carefully coordinated

Prefer duplication over premature sharing. Move code into the kernel only after the abstraction has proven stable.

## Good Candidates

These usually fit a shared kernel:

- `Brand<T, B>`, the helper type for branded identifiers and scalars
- Identifier types that several contexts genuinely share, such as `MemberId` when membership is owned elsewhere and referenced everywhere
- `EpochMillis` and other domain-neutral scalars
- `DomainError` base class
- `Result<T, E>` with `ok` and `err` helpers
- `assertNever`
- Port interfaces with no business meaning: `Clock`, `IdGenerator`
- Optimistic-concurrency markers such as a `Versioned` interface

Keep these abstractions minimal. They should support modeling, not force every context into a heavy inheritance tree.

## Bad Candidates

Do not place these in the shared kernel:

- Business-specific entities, aggregates, or value objects
- Context-specific repository ports
- zod schemas, ORM table definitions, or row types
- HTTP request and response types
- Shared service implementations with business behavior
- Utility modules created only to reduce duplication
- Base classes that expose setters, persistence state, or framework hooks
- Published integration contracts; those belong in a `contracts` package (see [contracts-and-published-language.md](./contracts-and-published-language.md))

If an abstraction contains language from one bounded context, it probably does not belong in the shared kernel.

## Design Rules

When using a shared kernel, enforce these rules:

- The package must remain smaller than any business context package
- Public abstractions must be intention-revealing and framework-free
- Do not provide an `AggregateRoot` or `Entity` base class. Each aggregate records its own events in a `#private` list; code that drains events, such as the outbox writer, depends only on the structural interface `{ pullPendingEvents(): readonly E[] }`. This keeps the kernel decoupled from every aggregate, so one aggregate can change how it records events without touching the others
- Prefer types, interfaces, and functions over base classes
- Aggregate invariants still live in the concrete domain model, not in the kernel
- Repository implementations never belong in the kernel
- The kernel has no runtime dependencies at all; its `package.json` lists none

## Example Shape

```text
packages/shared-kernel/
  package.json
  src/
    index.ts          # the only public entry point
    brand.ts          # Brand<T, B>
    result.ts         # Result<T, E>, ok, err
    errors.ts         # DomainError
    assert-never.ts
    ports.ts          # Clock, IdGenerator
    time.ts           # EpochMillis, toEpochMillis
```

Example use:

- `@acme/booking` depends on `@acme/shared-kernel`
- `@acme/room-catalog` depends on `@acme/shared-kernel`
- `@acme/notifications` depends on `@acme/shared-kernel`

The reverse must never happen. The shared kernel cannot depend on any bounded context.

## Shared Identifiers

Sharing an identifier type is the most common reason to touch the kernel, and the most common mistake.

- Share an identifier only when one context owns the concept and the others merely reference it.
- Keep the brand name stable. Changing `Brand<string, "MemberId">` to another name is a breaking change for every context.
- Each consuming context still validates the identifier when it enters from outside, through the shared constructor function.

## Decision Test

Before moving something into the shared kernel, ask:

1. Is it used by at least two bounded contexts today?
2. Is the concept domain-neutral rather than business-specific?
3. Will changes to it be rare and coordinated?
4. Would duplication be safer than sharing at this stage?

If any answer is unclear, keep the code inside the bounded context for now.
