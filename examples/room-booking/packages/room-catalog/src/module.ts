import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { RoomCatalogFacade } from "./application/room-catalog-facade";
import { DrizzleRoomRepository } from "./infrastructure/drizzle-room-repository";

/** Module factory: the composition root passes runtime-level dependencies, the context wires its own internals. */
export function createRoomCatalogModule(deps: { readonly db: BunSQLiteDatabase }): { readonly facade: RoomCatalogFacade } {
  return { facade: new RoomCatalogFacade(new DrizzleRoomRepository(deps.db)) };
}
