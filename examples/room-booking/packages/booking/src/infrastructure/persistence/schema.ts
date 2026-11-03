import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { MemberId, RoomId } from "@example/shared-kernel";
import type { BookingStatus } from "../../domain/booking";
import type { BookingId } from "../../domain/ids";

export const bookings = sqliteTable("bookings", {
  id: text("id").$type<BookingId>().primaryKey(),
  roomId: text("room_id").$type<RoomId>().notNull(),
  organizer: text("organizer").$type<MemberId>().notNull(),
  start: integer("start_ms").notNull(),
  end: integer("end_ms").notNull(),
  status: text("status").$type<BookingStatus>().notNull(),
  version: integer("version").notNull(),
}, (t) => [index("bookings_room_time").on(t.roomId, t.start, t.end)]);

export const outbox = sqliteTable("booking_outbox", {
  seq: integer("seq").primaryKey({ autoIncrement: true }),
  eventId: text("event_id").notNull().unique(),
  type: text("type").notNull(),
  payload: text("payload").notNull(),
  occurredAt: integer("occurred_at").notNull(),
  sentAt: integer("sent_at"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
});

