import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { RoomId } from "@example/shared-kernel";
import type { RoomLifecycle } from "../domain/room";

export const rooms = sqliteTable("rooms", {
  id: text("id").$type<RoomId>().primaryKey(),
  name: text("name").notNull(),
  capacity: integer("capacity").notNull(),
  lifecycle: text("lifecycle").$type<RoomLifecycle>().notNull(),
});

