# Testing Strategy

## Purpose

Test each layer according to its responsibility, and prove that every important test can fail.

The default stack uses `bun test` for the backend and Vitest for a Vue or other Vite frontend. Domain and application tests do not depend on the runner beyond `describe`, `test`, and `expect`, so they move between runners by changing one import.

## Domain Tests

- Focus on invariants, state transitions, and recorded events
- Construct aggregates through `create` and `reconstitute`; never poke at private state
- Use fixed `EpochMillis` values and explicit identifiers; no clock, no randomness, no I/O
- Assert the events with `pullPendingEvents()`, including that a second pull is empty
- Keep them fast; they are the bulk of the suite

## Type-Level Tests

- Keep one file per context, checked by `tsc`, with `@ts-expect-error` lines for what must not compile: interchangeable identifiers, raw strings as identifiers, object literals posing as value objects, async callbacks passed to the unit of work
- They run as part of the type check, not the test runner

## Application Tests

- Verify use-case orchestration, `Result` outcomes, and what is written to the outbox
- Use an in-memory unit of work whose repositories and outbox writer are plain maps and arrays; it must keep the synchronous shape of the real one
- Use a fixed clock and a sequential ID generator
- Cover each failure variant of the use case's `Result` union at least once
- Cover row-level authorization: another member is refused, an authorized role is allowed

## Repository And Persistence Tests

- Run against the real driver (`bun:sqlite` with `:memory:` in the default stack), never a mock
- Verify the round trip: aggregate to row to aggregate
- Verify the unit of work: a failure after writes rolls back both the aggregate and the outbox; a scope used after its transaction ended refuses to write; optimistic locking rejects a stale version
- Verify the queries that guard invariants, such as the overlap check
- Insert a row with an invalid enumeration value and expect loading it to throw
- With a second connection holding the write lock, expect the unit of work to fail before the callback runs (IMMEDIATE transactions)
- Compare the embedded migration list with the drizzle-kit journal

## ACL And Assembler Tests

- Feed the ACL adapter a contract-valid payload, an invalid payload, and a missing result; expect a snapshot, an integration error, and `undefined`
- Test assemblers as tables of input and output
- Keep them narrow and deterministic

## Outbox Relay Tests

- Commit events, run the relay, and assert each is delivered once
- Make one delivery fail and assert the failure is recorded, the rest still go out, and a later run retries the failed one
- Start a run whose delivery is still pending and start another; expect the second to be skipped and each row delivered once

## Query Side Tests

- Verify filtering, ordering, paging limits, and the visibility rule in the query
- Prefer focused tests over full-stack coverage for every query

## Interface And Composition Tests

- Exercise routes through the framework's in-process request API (`app.request` in Hono), not a real port
- Verify request validation, authentication failures, and the error mapping of each `Result` failure and each thrown error code
- Keep one smoke test that builds the whole application through the composition root, boots it, and runs one main flow end to end, including the relay; it catches missing or duplicated wiring (strong rule 9)
- Do not duplicate domain behavior tests here

## Break Verification

For each test that guards a strong rule, make the implementation wrong once and watch the test fail. The example repository did this:

| Change to the implementation | Test that went red |
|---|---|
| unit of work calls the callback without a database transaction | "a failure after save rolls back the aggregate and the outbox" |
| unit of work never marks its scope closed | "a leaked scope refuses to write after its transaction ended" |
| `NotPromise` removed from the unit-of-work port | type guard: `tsc` TS2578, unused `@ts-expect-error` |
| row mapper passes the stored status through unchecked | "an unknown status in storage fails loudly" |
| transaction back to the default DEFERRED behavior | "while another connection holds the write lock, the use case never starts reading" |
| relay without its re-entrancy guard | "a run that starts while another is delivering is skipped" |
| identifier error message includes the raw input | "do not echo the raw input" |
| a journal entry added without re-running the embed script | the embedded-list test, and every smoke test because startup refuses |

A test that stays green when the code is broken is worse than no test, because it creates false confidence.
