# Enforcement

Layer rules that exist only in documents do not exist. This reference shows the tooling that makes the build fail when a rule is broken. Ready-to-copy files are in [../assets/](../assets/):

- `tsconfig.strict.json`: compiler flags
- `dependency-cruiser.cjs`: layer, context, and runtime-portability rules
- `eslint.config.mjs`: promise rules and core-only restrictions

All three were verified on the example project in `examples/room-booking` of this skill's repository (Bun 1.3.12, TypeScript 6.0.3, dependency-cruiser 18.7.2, ESLint 10.14.0, typescript-eslint 8.72.1).

## TypeScript Version

Use TypeScript 6.0.x for now. TypeScript 7 compiles the same code, but its compiler API is not published yet: dependency-cruiser 18.7.2 reports "missing-tsc-transpiler" and misses TypeScript sources, and typescript-eslint 8.72.1 declares `typescript >=4.8.4 <6.1.0`. Move to 7 when both tools support it.

## Compiler Flags

`tsconfig.strict.json` turns on `strict` plus:

| Flag | Why |
|---|---|
| `noUncheckedIndexedAccess` | `map[key]` and `array[i]` may be `undefined`; forces a check |
| `exactOptionalPropertyTypes` | an optional field cannot be set to `undefined` by accident |
| `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch` | catch silent control-flow mistakes |
| `noPropertyAccessFromIndexSignature` | dynamic keys must look dynamic |
| `useUnknownInCatchVariables` | a caught value is `unknown` until narrowed |
| `noUnusedLocals`, `noUnusedParameters` | dead code and forgotten wiring show up |
| `verbatimModuleSyntax`, `isolatedModules` | type-only imports stay explicit; matches how Bun transpiles |

Extend it from the workspace `tsconfig.json` and add `"types": ["bun"]` there.

## Dependency Rules

`dependency-cruiser.cjs` expects `packages/<context>/src/{domain,application,infrastructure,interfaces}` plus `packages/shared-kernel` and `packages/contracts`. Rules, all errors:

| Rule | Forbids | Strong rule |
|---|---|---|
| `domain-allowlist` | domain importing anything but its own domain and the shared kernel (npm packages such as zod or drizzle included) | 1 |
| `application-allowlist` | application importing anything but its own domain and application, the shared kernel, and contracts | 2, 3 |
| `core-no-runtime-modules` | `node:*` and `bun:*` modules in domain or application | runtime portability |
| `core-no-unresolvable` | unresolvable imports in domain or application (`bun:*` builtins are unresolvable to the cruiser) | runtime portability |
| `no-unresolvable` | any unresolvable import except `bun:*`: catches deep imports that package `exports` blocks, and typos | 8 |
| `interfaces-not-infrastructure` | the interfaces layer importing infrastructure | 7 |
| `no-deep-imports-across-packages` | reaching another package's files except its `src/index.ts`, including by relative path | 8 |
| `shared-kernel-is-standalone` | the kernel importing anything outside itself | shared kernel |
| `no-circular` | cycles | — |

Two layers stop deep imports. Package `"exports"` makes `@example/booking/src/domain/booking` unresolvable for Bun and `tsc`; `no-unresolvable` reports it in the dependency check too. A relative path such as `../../booking/src/domain/booking` resolves fine, and only `no-deep-imports-across-packages` catches it.

Test files are excluded from the cruise. Tests may reach into internals of their own package; they must not create production dependencies.

## Lint Rules

`eslint.config.mjs` (flat config, type-aware through `projectService`):

- everywhere: `no-floating-promises`, `no-misused-promises`, `await-thenable`, `only-throw-error`
- domain and application only: `no-restricted-globals` for `fetch`, `crypto`, timers, `performance`, `process`, `Bun`; `no-restricted-properties` for `Date.now`; `no-restricted-syntax` for argument-less `new Date()` and for `enum`

## Wiring It Into CI

```json
{
  "scripts": {
    "typecheck": "tsc -p .",
    "deps": "depcruise packages --config .dependency-cruiser.cjs",
    "lint": "eslint packages",
    "test": "bun test",
    "check": "bun run typecheck && bun run deps && bun run lint && bun run test"
  }
}
```

Run `bun run check` in CI and fail on any non-zero exit.

## Proving The Rules Work

A rule that never fails proves nothing. When adopting these files, plant one violation per rule, confirm the check fails with the expected rule name, and remove it. The example repository did this for every rule:

| Planted violation | Caught by |
|---|---|
| domain imports `drizzle-orm` | `domain-allowlist` |
| domain imports `zod` | `domain-allowlist` |
| application imports `node:crypto` | `core-no-runtime-modules`, `application-allowlist` |
| application imports `bun:sqlite` | `core-no-runtime-modules`, `application-allowlist` |
| app imports `../../booking/src/domain/booking` | `no-deep-imports-across-packages` |
| app imports `@example/booking/src/domain/booking` | `no-unresolvable`, and `tsc` TS2307 |
| domain calls `Date.now()` and `new Date()` | `no-restricted-properties`, `no-restricted-syntax` |
| application calls `fetch` and leaves a promise floating | `no-restricted-globals`, `no-floating-promises` |

## Type-Level Guards

Some rules are best enforced by the compiler itself. Keep a type-guard file in the test folder that `tsc` checks, where each line is a forbidden use marked `@ts-expect-error`:

```ts
// @ts-expect-error a RoomId must not be accepted where a MemberId is expected
booking.cancel(ROOM, "member");
// @ts-expect-error an async callback must be rejected by the unit-of-work port
void uow.run(async () => 1);
```

If a rule stops holding, the directive becomes unused and `tsc` fails with TS2578.

## What Tooling Cannot Check

Review still has to catch: business logic in route handlers (strong rule 7), aggregate methods called from the interfaces layer, casts to branded types outside constructor functions, and row-level authorization decided outside the aggregate (strong rule 5). [ddd-code-review.md](./ddd-code-review.md) lists them as smells.
