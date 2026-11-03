# TypeScript Domain-Driven Design Skill

A Claude Code / Codex skill for designing, implementing, and reviewing TypeScript backends with Domain-Driven Design.

It is the TypeScript counterpart of [DDD-Patterns-for-Java](https://github.com/n7tequila/DDD-Patterns-for-Java): the same methodology, review model, and merge-blocking rules, rewritten for the TypeScript type system and toolchain.

> Status: complete (2026-11-03). SKILL.md, 20 references, 3 enforcement assets, a runnable example (34 tests, single-file build), and two eval iterations. Development log and review reports (Chinese): `docs/dev-log/`.

## Evaluation Summary

Two iterations, 40 runs, with and without the skill (`evals/results/`):

- With the skill, every planted violation was found at the expected severity, and the compliant control produced no CRITICAL or HIGH finding.
- On straightforward review tasks, a model without the skill already finds most of the same problems, so coverage gains there are small.
- Reproducible gains: generated code uses branded identifiers (6/6 trials with the skill, 0/6 without); reviews surface issues outside the planted scope; explanations cite the binding documentation instead of hedging; output follows one structure.

## Repository Layout

```text
typescript-domain-driven-design/   # the skill itself; copy this folder to install
  SKILL.md
  agents/openai.yaml
  references/                      # loaded on demand
  assets/                          # ready-to-copy tsconfig, dependency-cruiser, lint files
examples/                          # runnable sample bounded context (meeting room booking)
evals/                             # review and design evaluations
docs/dev-log/                      # development log and review reports (Chinese)
```

## Install

```bash
cp -R typescript-domain-driven-design ~/.claude/skills/
```

## What It Covers

- Strategic design: bounded contexts, context relationships, ownership
- Tactical design in TypeScript: aggregates as classes with private state, value objects, branded identifiers, domain events as discriminated unions
- Layering: domain, application, infrastructure, interface, enforced by compiler flags, dependency-cruiser, and architecture tests
- Anti-corruption layers, assemblers, shared kernel versus published contracts
- Query side versus write side
- Transactions, outbox, eventual consistency, sagas
- Error handling: typed domain errors plus discriminated-union results
- Runtime portability between Bun and Node
- Bindings for Hono and Drizzle
- A code review mode with a smell catalog and a four-level severity model

## Default Stack

When a project does not specify one: TypeScript (strict), Bun, Hono, Drizzle with SQLite, zod, `bun test`. The domain layer never depends on any of them.

## Example Prompts

```text
Use $typescript-domain-driven-design to design a TypeScript modular monolith for room booking, catalog, and notifications with bounded contexts, aggregates, branded IDs, an outbox, and a Hono app package.
```

```text
Use $typescript-domain-driven-design to review this service for DDD violations and report findings by severity.
```

## License

MIT. See `LICENSE`.
