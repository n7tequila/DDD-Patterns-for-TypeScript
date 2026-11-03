# Binding: Hono

How the interfaces layer and the composition root look with Hono. Excerpts come from `examples/room-booking` in this skill's repository, verified with Hono 4.13.16, zod 4.6.7, and Bun 1.3.12, including a `bun build --compile` single-file build.

## Route Handlers

A context exports a function that returns its routes. Handlers parse, build the command, call one application service, and map the result (strong rule 7).

```ts
// booking/src/interfaces/http/routes.ts
export type BookingEnv = { Variables: { actor: Actor } };

export function bookingRoutes(deps: {
  readonly bookRoom: BookRoom;
  readonly cancelBooking: CancelBooking;
  readonly queries: BookingQueries;
  readonly clock: Clock;
  readonly log: (error: unknown) => void;
}): Hono<BookingEnv> {
  const app = new Hono<BookingEnv>();

  app.onError((error, c) => {
    const mapped = mapThrown(error);
    if (mapped.status === 500) deps.log(error);
    return c.json(mapped.body, mapped.status);
  });

  app.post("/bookings", async (c) => {
    const parsed = bookRoomRequest.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) return c.json({ code: "BAD_REQUEST", message: parsed.error.message }, 400);
    const result = await deps.bookRoom.execute(toBookRoomCommand(parsed.data, c.get("actor")));
    if (!result.ok) {
      const mapped = mapFailure(result.error);
      return c.json(mapped.body, mapped.status);
    }
    return c.json({ bookingId: result.value.bookingId }, 201);
  });

  return app;
}
```

Rules:

- Parse bodies and query strings with zod `safeParse` and answer 400 on failure. `c.req.json()` throws on malformed JSON; catch it and let the schema reject `undefined`.
- Build commands with assemblers that use the domain's constructor functions, so a malformed identifier becomes a thrown `INVALID_IDENTIFIER` and a 400 through `onError`.
- The acting member comes from a context variable set by authentication middleware. Handlers never derive roles or check ownership.
- Map `Result` failures with one exhaustive `mapFailure` (by `kind`) and thrown errors with one `mapThrown` (by `code`); unknown errors become a 500 without details and are logged. See [../error-handling.md](../error-handling.md).
- Do not import infrastructure from route files (`interfaces-not-infrastructure` in [../enforcement.md](../enforcement.md)).

## Authentication Middleware

Authentication lives in the app package. It establishes who the caller is and nothing more; what the caller may do with a record is decided by the aggregate (strong rule 5).

```ts
// app/src/auth.ts  (demo only: trusts headers; replace with real authentication)
export const demoAuth: MiddlewareHandler<BookingEnv> = async (c, next) => {
  const parsed = actorHeaders.safeParse({ memberId: c.req.header("x-member-id"), role: c.req.header("x-member-role") ?? "member" });
  if (!parsed.success) return c.json({ code: "UNAUTHENTICATED", message: "missing or invalid identity" }, 401);
  c.set("actor", { memberId: toMemberId(parsed.data.memberId), role: parsed.data.role });
  return next();
};
```

`return next()` instead of `await next()` keeps `noImplicitReturns` satisfied.

## Module Factory And Composition Root

Each context's `index.ts` exports a module factory instead of its classes. The factory takes runtime-level dependencies and wires the context's own internals, so the composition root never imports a context's infrastructure.

```ts
// booking/src/module.ts
export function createBookingModule(deps: {
  readonly db: BunSQLiteDatabase;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly roomCatalog: RoomCatalogClient;
  readonly deliver: Deliver;
  readonly log: (error: unknown) => void;
}): BookingModule {
  const uow = new DrizzleUnitOfWork(deps.db, deps.clock, deps.ids);
  const bookRoom = new BookRoom(new RoomCatalogAdapter(deps.roomCatalog), uow, deps.clock, deps.ids);
  const cancelBooking = new CancelBooking(uow);
  const queries = new DrizzleBookingQueries(deps.db);
  return {
    routes: bookingRoutes({ bookRoom, cancelBooking, queries, clock: deps.clock, log: deps.log }),
    relay: new OutboxRelay(deps.db, deps.deliver, deps.clock),
  };
}
```

```ts
// app/src/composition-root.ts (excerpt)
const roomCatalog = createRoomCatalogModule({ db });
const booking = createBookingModule({
  db,
  clock,
  ids,
  roomCatalog: { fetchRoom: async (roomId) => roomCatalog.facade.getRoomView(roomId) },
  deliver,
  log,
});

const app = new Hono<BookingEnv>();
app.get("/health", (c) => c.json({ status: "ok" }));
app.use("/bookings/*", demoAuth);
app.use("/bookings", demoAuth);
app.route("/", booking.routes);
```

- Cross-context calls go through the other context's facade, wrapped to the consuming context's client interface; the consuming context's ACL still parses the result.
- `composeApp` accepts a clock, an ID generator, a delivery function, and a database path, so the smoke test builds the real graph with an in-memory database.

## Server Entry

```ts
// app/src/main.ts
const config = loadConfig(Bun.env);
const { app, relay } = composeApp({ dbPath: config.DB_PATH });
const server = Bun.serve({ port: config.PORT, fetch: app.fetch });
```

On Node, replace `Bun.serve` with `serve({ fetch: app.fetch, port })` from `@hono/node-server`; routes do not change.

## Testing Routes

Use `app.request(path, init)`; it runs the full middleware and route stack in process.

```ts
const res = await ctx.app.request("/bookings", { method: "POST", headers: ALICE, body: JSON.stringify(body) });
expect(res.status).toBe(201);
```

## Single-File Build

`bun build --compile packages/app/src/main.ts --outfile dist/room-booking` bundles every workspace package through its `"exports"` entry pointing at TypeScript source; no per-package build is needed. Verified: a 64.6 MB darwin-x64 binary that served `/health`, rejected an unauthenticated request, and ran a booking request through the ACL and SQLite.
