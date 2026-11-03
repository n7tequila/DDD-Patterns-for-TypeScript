# Runtime Portability

## Purpose

Keep the domain and application layers independent of the JavaScript runtime, so the core can move between Bun and Node (or another runtime) by replacing adapters, and so the core stays deterministic and testable.

## The Rule

Domain and application code use only ECMAScript built-ins: `Object`, `Array`, `Map`, `Set`, `Math`, `JSON`, `Intl`, `Number`, `String`, `Promise`, `Error`, typed arrays, and similar language-level objects.

Everything else appears only in infrastructure adapters:

- Runtime namespaces and modules: `Bun.*`, every `bun:*` module, every `node:*` module (including pure computation such as `node:crypto` and `node:path`)
- Platform globals that perform I/O or read time or randomness: `fetch`, `crypto` (including `crypto.randomUUID`), `setTimeout`, `setInterval`, `queueMicrotask` scheduling of I/O, `performance`, `Date.now`, `new Date()` without arguments
- Process and environment access: `process`, `Bun.env`, `import.meta.env`
- Third-party packages that wrap any of the above

The core reaches these capabilities through ports it defines: `Clock`, `IdGenerator`, `PasswordHasher`, `FileStore`, `RoomCatalog`, `UnitOfWork`.

## Typical Adapters

| Capability | Port in the core | Bun adapter | Node adapter |
|---|---|---|---|
| Current time | `Clock` | `Date.now()` wrapped | same |
| New identifiers | `IdGenerator` | `crypto.randomUUID()` | same |
| Password hashing | `PasswordHasher` | `Bun.password` | `node:crypto` `scrypt` |
| SQLite access | `UnitOfWork`, repositories | `bun:sqlite` via Drizzle | `node:sqlite` or another driver via Drizzle |
| HTTP server | none (interfaces layer) | `Bun.serve` with Hono's `fetch` | `@hono/node-server` |
| Files | `FileStore` | `Bun.file`, `Bun.write` | `node:fs/promises` |
| Configuration | a parsed config object passed in | `Bun.env` | `process.env` |

The HTTP server and configuration live in the app package; the interfaces layer stays on Hono's runtime-neutral `Request`/`Response` API.

## Enforcement

- dependency-cruiser forbids `bun:*` and `node:*` imports, and imports of known runtime-bound packages, from `domain` and `application` folders.
- The lint rule `no-restricted-globals` (or `no-restricted-properties` for `Date.now` and `crypto.randomUUID`) applies to the same folders.
- `tsconfig` for domain and application code can omit `"types": ["bun"]` and Node types, so runtime globals do not type-check there. In a single-tsconfig repository, the lint rules carry this instead.

Ready-to-copy configurations are in [enforcement.md](./enforcement.md) and the `assets/` folder.

## What Changes When The Runtime Changes

Domain and application code do not change. Infrastructure adapters are replaced. Each context's module factory and migration function change their signatures too, because they take the runtime's database handle (for example `BunSQLiteDatabase` or a `bun:sqlite` `Database`). That is expected: they sit on the infrastructure boundary, not in the core. Keep runtime types out of ports, commands, results, and facades.

## Tests

- Domain and application tests use fixed clocks, sequential ID generators, and in-memory adapters; they never touch the runtime.
- Infrastructure tests run on the target runtime against the real driver.
- Switching runtimes means re-running the infrastructure tests on the new runtime with the new adapters; domain and application tests need no change except the test-runner import.

## What Not To Do

Do not:

- call `Bun.*` or import `bun:*` from a domain or application file "just this once"
- read `process.env` or `Bun.env` outside the app package's configuration loader
- generate IDs or timestamps inside aggregates
- let a runtime-specific type, such as a `bun:sqlite` `Database`, appear in a port signature
