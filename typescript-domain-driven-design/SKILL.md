---
name: typescript-domain-driven-design
description: Design, implement, and review TypeScript backends with Domain-Driven Design, including bounded contexts, aggregates, entities, value objects, branded identifiers, repositories, domain services, application services, domain events, outbox, anti-corruption layers, shared kernel, published contracts, query-side models, sagas, and modular monorepo or workspace structure. Use this skill whenever the user asks for TypeScript or Node/Bun backend architecture or coding that should reflect DDD, clean or hexagonal architecture, rich domain models, modular monolith design, aggregate modeling, CQRS-style read models, cross-context integration, or domain-focused refactoring, even if the user does not explicitly say "DDD". Also use it when reviewing TypeScript code for DDD adherence, auditing a codebase for architectural health, or checking whether layer boundaries, transactions, and identifiers are sound.
---

# TypeScript Domain Driven Design

## Overview

Design code around domain language and business invariants first, then fit frameworks and persistence around that model. Keep the domain layer free of frameworks, ORMs, validation libraries, and runtime-specific APIs.

When the user does not name a stack, default to TypeScript in strict mode, Bun, Hono, Drizzle with SQLite, zod at the boundaries, and `bun test`. Binding guides exist for Hono and Drizzle; for any other framework or ORM, apply the same layer rules and keep the binding in infrastructure.

## Working Mode

Choose the mode that matches the request.

### Design And Build Mode

Follow this sequence unless the user asks for only one step:

1. Identify the core domain language.
2. Separate bounded contexts before writing classes.
3. Model aggregates and invariants before repositories or route handlers.
4. Implement application services as orchestration only.
5. Adapt infrastructure to the domain instead of leaking infrastructure into the domain.
6. Wire everything in one composition root.
7. Return a concrete code structure, not only theory.

### Code Review Mode

Use this mode when the user asks to review, audit, or evaluate existing TypeScript code against DDD principles. Read [references/ddd-code-review.md](./references/ddd-code-review.md) for the code smell catalog, the severity model, and the report template.

Follow this sequence:

1. Map the structure. Identify packages, folders, entry points, and import directions before reading function bodies.
2. Locate the domain. Find where business logic lives and where it has leaked.
3. Check layer boundaries. Verify that each layer only imports layers closer to the domain, and that no code deep-imports another context's internals.
4. Check the type-level guarantees. Look for interchangeable identifiers, unvalidated input crossing a boundary, and mutable state escaping an aggregate.
5. Check transaction and side-effect timing. Look for async work inside transactions, events published outside the transaction that saved the aggregate, and floating promises.
6. Evaluate tactical patterns and strategic alignment.
7. Report findings with the severity model, highest severity first.

When reviewing code without design documentation, reconstruct the implicit domain model first: find the nouns, verbs, write paths, the import graph, and the integration seams. Then compare it to DDD ideals. Gaps are findings.

## Start With Domain Discovery

Before coding, extract:

- Primary business capability
- Key actors and use cases
- Ubiquitous language terms
- Invariants that must always hold
- Commands that change state
- Queries that read state
- External systems or integration points

If the request is underspecified, state the assumptions explicitly and continue. Do not block on perfect requirements.

## Define Strategic Boundaries

Use bounded contexts when the domain has distinct language or rules. Do not force one giant model.

For each context, name:

- Responsibility
- Upstream and downstream dependencies
- Aggregate roots
- Domain events it publishes or consumes
- Public entry points: the application facade and the published contracts

If the user asks for a small feature, still say which bounded context owns it.

When another bounded context or an external system exposes a model that would pollute local language, introduce an Anti-Corruption Layer instead of reusing upstream terms directly.

## Model Tactical Patterns

Read [references/tactical-patterns.md](./references/tactical-patterns.md) when choosing between entity, value object, aggregate, domain service, repository, factory, and domain event. Read [references/typescript-modeling.md](./references/typescript-modeling.md) for how each building block is expressed in TypeScript.

Apply these defaults:

- Model aggregate roots as classes. Keep state in `#private` fields and change it only through methods that enforce invariants.
- Give every aggregate two construction paths: `create(...)` for new instances, which validates and records events, and `reconstitute(...)` for loading from storage, which records no events.
- Model value objects as immutable classes with `equals`, or as branded primitives when they are a single constrained scalar.
- Give every identifier its own branded type. Never pass a raw `string` or `number` as an ID inside the domain.
- Use discriminated unions for domain events, state machines, and expected failures.
- Reference other aggregates by identifier only.
- Keep the domain synchronous and deterministic. Inject a `Clock` and an ID generator instead of calling `Date.now()` or `crypto.randomUUID()` inside the domain.

## Code Structure Rules

Read [references/typescript-ddd-layout.md](./references/typescript-ddd-layout.md) for folder layout and [references/workspace-structures.md](./references/workspace-structures.md) for workspace and package structure.

Enforce these dependency rules:

- `domain` imports only the TypeScript standard library and the shared kernel. No framework, ORM, validation library, HTTP type, or runtime-specific module.
- `application` imports `domain` only, plus port interfaces it defines itself.
- `infrastructure` imports `application` and `domain`, and implements their ports.
- `interfaces` (HTTP routes, CLI, message consumers) imports `application` only, never repositories or aggregates for write workflows.
- Another bounded context is reached only through its public entry point: its application facade or its published contracts. Deep imports into another context are forbidden.
- Domain and application code use only ECMAScript built-ins such as `Math`, `Array`, `Map`, `JSON`, and `Intl`. Runtime-specific APIs (`Bun.*`, every `bun:*` and `node:*` module, including pure computation such as `node:crypto`) and platform globals that do I/O or read time or randomness (`fetch`, `crypto`, `setTimeout`, `setInterval`, `performance`, `Date.now`) appear only in infrastructure adapters; those capabilities reach the core through injected ports. See [references/runtime-portability.md](./references/runtime-portability.md).

Enforce these rules with tooling, not discipline. Read [references/enforcement.md](./references/enforcement.md) for the strict `tsconfig`, dependency-cruiser rules, lint rules, and architecture tests; ready-to-copy files live in [assets/](./assets/).

For medium or large systems, prefer one workspace package for the shared kernel, one package per bounded context, and one app package that holds the composition root. Keep the shared kernel thin; read [references/shared-kernel.md](./references/shared-kernel.md) before adding anything to it.

If the solution uses an Anti-Corruption Layer, read [references/anti-corruption-layer.md](./references/anti-corruption-layer.md):

- Place translation logic at the boundary, in infrastructure or a dedicated integration folder.
- Validate foreign data with a schema before translating it.
- Translate upstream DTOs, events, and error semantics into local commands, value objects, and domain concepts.
- Do not leak foreign names, enums, status codes, or persistence rows into the local domain.

If the solution uses assemblers, read [references/assemblers.md](./references/assemblers.md):

- Use them for pure type conversion at boundaries.
- Do not put business decisions, invariants, transaction control, or workflow orchestration in assemblers.

If the solution shares contracts across contexts, read [references/contracts-and-published-language.md](./references/contracts-and-published-language.md):

- Define published schemas and integration events separately from the domain model.
- Do not treat published contracts as equivalent to local aggregates or entities.

If the solution includes read-heavy features, read [references/query-side.md](./references/query-side.md):

- Separate write-side aggregates from query-side read models.
- Do not force dashboards, search, or reports through aggregate repositories.

If the solution spans multiple aggregates or contexts in one business process, read [references/consistency-and-sagas.md](./references/consistency-and-sagas.md):

- Modify one aggregate per transaction whenever possible.
- Save the aggregate and its pending events in the same transaction (outbox). Publish from the outbox after commit.
- Do no asynchronous work inside a transaction. Call remote services, models, and other I/O before the transaction starts.
- Use process managers or sagas for long-running or cross-context workflows.

## Implementation Defaults

When generating code, prefer:

- `strict` TypeScript plus the extra flags in [references/enforcement.md](./references/enforcement.md)
- Immutable value objects and branded identifiers
- Rich domain methods over setter-based models
- Factory validation for invariants
- Repository interfaces (ports) defined next to the domain or application layer
- Separate command and query types at the interfaces layer, validated with schemas
- Transaction boundaries owned by application services, entered through one unit-of-work wrapper
- No floating promises: every promise is awaited, returned, or explicitly handed to a supervised runner

Error strategy (read [references/error-handling.md](./references/error-handling.md)):

- Invariant violations and programming errors throw typed domain errors.
- Expected business failures, such as a conflicting booking, are returned by application services as a discriminated-union `Result`.
- Integration failures are translated at the adapter boundary.
- The interfaces layer maps both thrown errors and `Result` failures to responses in one place.

Apply the strong rules in [references/strong-rules.md](./references/strong-rules.md). They come from real review regressions and block a merge when violated.

## Framework And Persistence Bindings

Keep framework code at the edges:

- Route handlers parse input, build a command, call one application service, and map the result. No business decisions.
- Wire adapters to ports in a single composition root with constructor injection. A dependency-injection container is optional and never required by the domain.
- Keep ORM schemas and row types in infrastructure. Map rows to aggregates with `reconstitute`, and aggregates to rows explicitly in the repository.

Binding guides:

- [references/bindings/hono.md](./references/bindings/hono.md) for routes, validation, error mapping, and the composition root.
- [references/bindings/drizzle.md](./references/bindings/drizzle.md) for repositories, branded columns, the unit-of-work wrapper, and the outbox. With synchronous drivers such as `bun:sqlite`, a transaction callback must be synchronous: an `async` callback commits as soon as it returns a promise and never rolls back.

## Output Expectations

When asked to design or code, provide the most useful artifact for the request:

- For architecture requests: bounded context map, workspace or folder structure, aggregate definitions, and dependency rules
- For feature requests: command flow, domain model changes, application service, repository port, and adapter sketch
- For coding requests: TypeScript that compiles under the strict configuration, with concise comments only where necessary
- For refactoring requests: target design, migration steps, and the first safe slice to implement
- For review requests: the report template in [references/ddd-code-review.md](./references/ddd-code-review.md)

Prefer concrete type, file, and folder names over abstract advice. For substantial responses, follow [references/output-template.md](./references/output-template.md).

## Delivery Checklist

Before finishing, verify:

- The ubiquitous language is reflected in type, function, file, and folder names.
- Each aggregate has a clear consistency boundary and enforces its invariants in its own methods.
- Every identifier has its own branded type; no two identifier types are interchangeable.
- Input from outside the process is validated by a schema before it reaches application code.
- Route handlers and adapters contain no core business decisions.
- Repositories are defined around aggregate access, not arbitrary tables.
- Cross-context interactions go through public entry points or published contracts.
- ACL boundaries are explicit wherever foreign models would otherwise leak in.
- Query-side models are separated from write-side aggregates where appropriate.
- Each transaction modifies one aggregate, writes its events to the outbox, and contains no asynchronous work.
- No promise is left floating.
- Failure types are mapped at the correct layer.
- Layer and import rules are enforced by tooling that fails the build.
- The response includes enough code or structure that the next step can be implemented immediately.

Use [references/ddd-checklist.md](./references/ddd-checklist.md) for the full final review pass.

## References

- [references/tactical-patterns.md](./references/tactical-patterns.md): choosing building blocks and sizing aggregates.
- [references/typescript-modeling.md](./references/typescript-modeling.md): branded types, classes with private state, discriminated unions, immutability, boundary validation, time, serialization.
- [references/typescript-ddd-layout.md](./references/typescript-ddd-layout.md): folder layout, import direction, public entry points.
- [references/workspace-structures.md](./references/workspace-structures.md): workspaces, package exports, project references.
- [references/shared-kernel.md](./references/shared-kernel.md): what may and may not be shared.
- [references/anti-corruption-layer.md](./references/anti-corruption-layer.md): integrating across contexts and external systems.
- [references/assemblers.md](./references/assemblers.md): boundary-local type conversion.
- [references/contracts-and-published-language.md](./references/contracts-and-published-language.md): integration schemas and events.
- [references/query-side.md](./references/query-side.md): read models and query flows.
- [references/consistency-and-sagas.md](./references/consistency-and-sagas.md): transactions, outbox, eventual consistency, process managers.
- [references/error-handling.md](./references/error-handling.md): domain errors, `Result`, integration failures, interface mapping.
- [references/strong-rules.md](./references/strong-rules.md): merge-blocking rules from real review regressions.
- [references/runtime-portability.md](./references/runtime-portability.md): keeping runtime-specific APIs out of the core.
- [references/enforcement.md](./references/enforcement.md): compiler flags, dependency rules, lint, architecture tests.
- [references/testing-strategy.md](./references/testing-strategy.md): what to test at each layer.
- [references/bindings/hono.md](./references/bindings/hono.md) and [references/bindings/drizzle.md](./references/bindings/drizzle.md): first-party bindings.
- [references/ddd-code-review.md](./references/ddd-code-review.md): review workflow, smell catalog, severity, report template.
- [references/ddd-checklist.md](./references/ddd-checklist.md): final review pass.
- [references/output-template.md](./references/output-template.md): response shape for design and code tasks.
