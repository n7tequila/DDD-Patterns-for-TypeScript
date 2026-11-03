# Strong Rules

Rules that block a merge when violated. Each one comes from a real review regression: the TypeScript counterpart of the Java version's ten rules, plus rules that only TypeScript needs. Methodology lives in the other references; this file lists only what must stop a change.

## Layer Dependencies

1. **Domain import allowlist.** Domain files import only ECMAScript built-ins, the shared kernel, and other files of the same context's domain. No framework, ORM, validation library, HTTP type, runtime module, or I/O global. See [runtime-portability.md](./runtime-portability.md).
2. **Types shared by the interfaces and infrastructure layers live in application.** Commands, query inputs, result unions, read models, and ports are defined in `application`, never in `infrastructure`. Otherwise the interfaces layer must import infrastructure, which inverts the layering.
3. **Cross-cutting helpers the application layer uses are defined as application ports.** An audit trail, a request context, or an authorization checker is an interface in `application` or a shared support package, implemented in infrastructure. A business context's `infrastructure` folder never exports something that `application` must import.
4. **Rules 1–3 are enforced by tooling that fails the build.** dependency-cruiser runs in CI with these rules as errors; a layering rule that exists only in a document does not exist. See [enforcement.md](./enforcement.md).

## Authorization And Read Models

5. **Row-level authorization belongs to the aggregate, for reads and writes alike.** Who may see or change one record is a guard method on the aggregate root (`isOrganizedBy(member)`, `canBeCancelledBy(member, role)`). Route-level middleware checks only the role. A role check alone lets user B change user A's record. Every write command carries the acting member and role; the application service loads the aggregate and calls the guard before any change. Query handlers apply the same rule in their `WHERE` clause.
6. **A detail query returns the complete read model in one call.** The application layer assembles everything the screen needs within its own context. Route handlers do not combine several calls.
7. **Route handlers contain no business logic.** They parse input with a schema, build the command, call one application service, and map the result. No role derivation, state conditions, or business defaults; those belong in the command or below it.

## Cross-Context

8. **Identifiers and enumerations shared across contexts live in the shared kernel; a context's domain is never imported by another context.** Cross-context calls go through the other context's facade with published types. Otherwise the downstream context couples to the upstream domain model and the next refactor creates a cycle.
9. **Wiring that depends on several contexts lives in the app package.** Middleware, adapters, or event routers that need more than one context are composed in the composition root, not copied into each context. The app package has a smoke test that builds the full object graph and starts the server, so a missing or duplicated adapter fails in CI instead of at startup in production.

## Transactions And Side Effects

10. **Side effects of a business change go through the outbox, with three defenses.**

| Defense | How | Prevents |
|---|---|---|
| Timing | Write the events to the outbox in the same transaction as the aggregate; deliver only committed rows | Side effects for rolled-back changes ("ghost" emails, audit rows, messages) |
| Isolation | Deliver each event in its own transaction, opened by the relay | A failing side effect affecting the business write |
| Containment | Catch and record each delivery failure, retry, keep the relay running | One bad event blocking or crashing everything |

Anti-patterns: publishing right after `save` (lost on crash, sent on rollback); writing side effects from a wrapper around the use case (committed even when the business transaction rolls back); isolation alone without the outbox (does not fix timing).

11. **No asynchronous work inside a transaction, and no transaction handle outside one.** All transactions go through the unit-of-work port whose callback type rejects promises. Do remote calls before the transaction. Never store a transaction handle or a transaction-bound repository for later use. Both failures are silent with synchronous drivers: an `async` callback commits immediately and never rolls back, and a leaked handle commits writes outside any transaction. See [consistency-and-sagas.md](./consistency-and-sagas.md).

    **Corollary (silent data loss or corruption):** code that runs after a transaction, such as the outbox relay, scheduled jobs, and delayed handlers, has no enclosing transaction and must open its own.

## Type-Level Guarantees

12. **Every identifier has its own branded type, created only by its constructor function.** A cast to a branded type outside that function, or an identifier typed as `string` in a domain or application signature, blocks the merge. Structural typing makes `MemberId` and `RoomId` interchangeable otherwise, and a mixed-up owner identifier is a data leak.
13. **Nothing from outside the process reaches application code without a schema parse.** HTTP input, messages, files, environment, other contexts' payloads, and model output are parsed at the boundary. `as SomeType` on unparsed data blocks the merge.
14. **No floating promises.** `@typescript-eslint/no-floating-promises` and `no-misused-promises` are errors. A forgotten `await` loses the error and the ordering.

## Command Validation Layers

- The interfaces layer parses requests with a schema; this is the main validation and gives clients field-level errors.
- Commands are domain-typed (branded identifiers, value objects), so an unvalidated command does not compile.
- Value object factories and aggregate methods are the final authority; a failure there that reaches the interfaces layer means a schema is missing a rule, and it maps to a 400 with a log entry, not a silent fix.

## Using This File In Reviews

In code review mode, a violation of any numbered rule is at least **HIGH**. Rules 5, 10, 11, 12, and 13 are **CRITICAL** when the affected data belongs to a user or crosses a trust boundary. See [ddd-code-review.md](./ddd-code-review.md).
