import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type { Hono } from "hono";
import type { Clock, IdGenerator } from "@example/shared-kernel";
import { BookRoom } from "./application/book-room";
import { CancelBooking } from "./application/cancel-booking";
import { RoomCatalogAdapter, type RoomCatalogClient } from "./infrastructure/acl/room-catalog/room-catalog-adapter";
import { OutboxRelay, type Deliver } from "./infrastructure/messaging/outbox-relay";
import { DrizzleBookingQueries } from "./infrastructure/persistence/drizzle-booking-queries";
import { DrizzleUnitOfWork } from "./infrastructure/persistence/drizzle-unit-of-work";
import { bookingRoutes, type BookingEnv } from "./interfaces/http/routes";

export interface BookingModule {
  readonly routes: Hono<BookingEnv>;
  readonly relay: OutboxRelay;
}

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
