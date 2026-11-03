# Workspace Structures

## Goal

Use the workspace structure to reinforce bounded-context boundaries and dependency direction.

Prefer one workspace package per bounded context for medium or large systems. For a very small service, a single package is acceptable if folder boundaries are kept strict and enforced by dependency-cruiser.

## Recommended Packages

A typical DDD workspace may use:

- `shared-kernel`
- one package per bounded context, such as `booking`, `room-catalog`, `notifications`
- one runtime package, `app`, with the composition root

Optional packages:

- `contracts` for published language schemas when they are truly shared and versioned
- `test-support` for fixtures, builders, fixed clocks, and in-memory adapters used across packages

Do not create packages just to mirror every layer mechanically. Create packages to reflect stable architectural boundaries.

## Bun Workspace Layout

```text
package.json
bun.lock
tsconfig.json
.dependency-cruiser.cjs
packages/
  shared-kernel/
    package.json
    src/index.ts
  contracts/
    package.json
    src/index.ts
  booking/
    package.json
    src/index.ts
  room-catalog/
    package.json
    src/index.ts
  app/
    package.json
    src/main.ts
```

Root `package.json`:

```json
{
  "name": "booking-platform",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "typecheck": "tsc -p .",
    "test": "bun test",
    "deps": "depcruise packages --config .dependency-cruiser.cjs",
    "lint": "eslint packages",
    "check": "bun run typecheck && bun run deps && bun run lint && bun run test"
  },
  "devDependencies": {
    "typescript": "~6.0.3",
    "dependency-cruiser": "^18.7.2",
    "eslint": "^10.14.0",
    "typescript-eslint": "^8.72.1"
  }
}
```

A context package:

```json
{
  "name": "@acme/booking",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "dependencies": {
    "@acme/shared-kernel": "workspace:*",
    "@acme/contracts": "workspace:*"
  }
}
```

Rules:

- `"exports"` lists only the public entry point. With it, `import { x } from "@acme/booking/src/domain/ids"` fails to resolve in both Bun and `tsc` (`moduleResolution: "bundler"`). Verified with Bun 1.3.12 and TypeScript 7.0.2 and 6.0.3.
- `"exports"` does not stop a relative path such as `../../booking/src/domain/ids`. dependency-cruiser must forbid imports that cross package folders without going through the package name.
- Packages point `"exports"` straight at TypeScript source. Bun runs it directly and `bun build --compile` bundles it; no per-package build step is needed.
- Use `workspace:*` for internal dependencies so the lockfile never pins an internal package to a stale version.

## Type Checking

Pin TypeScript to 6.0.x while dependency-cruiser and typescript-eslint do not support TypeScript 7 (see [enforcement.md](./enforcement.md)).

Start with one root `tsconfig.json` that includes every package and holds the strict flags from [enforcement.md](./enforcement.md):

```json
{
  "compilerOptions": {
    "strict": true,
    "noEmit": true,
    "target": "es2022",
    "module": "esnext",
    "moduleResolution": "bundler",
    "skipLibCheck": true,
    "types": ["bun"]
  },
  "include": ["packages/*/src/**/*.ts", "packages/*/test/**/*.ts"]
}
```

Move to TypeScript project references (`composite`, `tsc -b`) only when the type-check time of the whole repository becomes a problem. References require declaration output per package and add configuration to keep in sync.

## Package Responsibilities

### Shared Kernel

Use it only for small, stable, domain-neutral building blocks such as `Brand`, `assertNever`, `Result`, `DomainError`, `Clock`, and `IdGenerator`. Read [shared-kernel.md](./shared-kernel.md).

Do not place business-specific aggregates, repositories, schemas, or framework code here.

### Context Packages

Each bounded-context package may contain:

- `domain`
- `application`
- `infrastructure`
- `interfaces` when the context owns its own API surface

If the project keeps all HTTP routes in the `app` package, the interfaces layer may live there. In that case, do not let the app package absorb business logic.

### App Package

Use it for:

- the process entry point (`main.ts`)
- the composition root: creating adapters and passing them into application services
- configuration loading and validation
- HTTP server setup and route registration
- background workers such as the outbox relay
- the single-file build (`bun build --compile`)

This package composes contexts; it does not redefine them.

## Choosing The Package Manager

Follow the repository's existing tool. When starting fresh with Bun, use `bun install` and commit the text lockfile `bun.lock`. pnpm workspaces follow the same structure with `pnpm-workspace.yaml` instead of the `workspaces` field.

## Dependency Rules

Apply these rules regardless of tool:

- context packages may depend on `shared-kernel`
- context packages may depend on `contracts` only for published language
- `app` may depend on every context package
- contexts do not depend on each other's internals
- if one context needs another, use its facade, its published events, or an ACL
- tests do not introduce production dependencies that production code is not allowed to have

## When A Single Package Is Enough

A single package is acceptable when:

- the service is small
- there is only one clear bounded context
- the team is early in discovery

Even then, keep folder boundaries explicit and enforced, so the code can be split into packages later without a rewrite.
