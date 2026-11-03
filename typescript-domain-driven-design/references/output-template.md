# Output Template

## Default Response Shape

For substantial design or coding tasks, prefer this order:

1. Assumptions
2. Bounded contexts
3. Aggregates and invariants
4. Workspace and folder layout
5. Commands, queries, results, events, and contracts
6. Key types and code
7. Composition root wiring
8. Transaction boundaries, consistency notes, ACL points, and extension points

## Why

This structure keeps the response implementation-ready and makes architectural tradeoffs explicit. Sections 7 and 8 are where TypeScript designs most often go wrong silently: wiring that leaks infrastructure into the core, and transactions that do not protect what they claim to.

## Coding Tasks

When the user asks for code, compress sections 1–5 and spend most of the response on code that compiles under the strict configuration, plus short notes. Include the branded identifier types and the unit-of-work port whenever the code touches persistence.

## Architecture Tasks

When the user asks for design, keep code short and focus on structure, ownership, dependency rules, and how the rules will be enforced (dependency-cruiser, lint, type-level guards).

## Review Tasks

Use the report template in [ddd-code-review.md](./ddd-code-review.md): findings ordered by severity, each with location, evidence, rule, and fix.
