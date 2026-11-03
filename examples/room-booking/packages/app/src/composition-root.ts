import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { Hono } from "hono";
import { createBookingModule, migrateBooking, type BookingEnv, type Deliver } from "@example/booking";
import { createRoomCatalogModule, migrateRoomCatalog } from "@example/room-catalog";
import { toEpochMillis, type Clock, type IdGenerator } from "@example/shared-kernel";
import { demoAuth } from "./auth";

export const systemClock: Clock = { now: () => toEpochMillis(Date.now()) };
export const randomIds: IdGenerator = { next: () => crypto.randomUUID() };

/** The single place where runtime adapters are created and handed to the contexts. */
export function composeApp(deps: {
  readonly dbPath: string;
  readonly clock?: Clock;
  readonly ids?: IdGenerator;
  readonly deliver?: Deliver;
  readonly log?: (error: unknown) => void;
}) {
  const sqlite = new Database(deps.dbPath, { create: true });
  sqlite.run("PRAGMA journal_mode = WAL");
  sqlite.run("PRAGMA foreign_keys = ON");
  migrateRoomCatalog(sqlite);
  migrateBooking(sqlite);
  const db = drizzle(sqlite);

  const clock = deps.clock ?? systemClock;
  const ids = deps.ids ?? randomIds;
  const log = deps.log ?? ((error: unknown) => console.error(error));

  const roomCatalog = createRoomCatalogModule({ db });
  const booking = createBookingModule({
    db,
    clock,
    ids,
    roomCatalog: { fetchRoom: async (roomId) => roomCatalog.facade.getRoomView(roomId) },
    deliver: deps.deliver ?? (async (payload) => console.log("deliver", JSON.stringify(payload))),
    log,
  });

  const app = new Hono<BookingEnv>();
  app.get("/health", (c) => c.json({ status: "ok" }));
  app.use("/bookings/*", demoAuth);
  app.use("/bookings", demoAuth);
  app.route("/", booking.routes);

  return { app, relay: booking.relay, rooms: roomCatalog.facade, close: () => sqlite.close() };
}
