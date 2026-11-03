// booking/src/infrastructure/drizzle-book-room.ts  (Drizzle on bun:sqlite)
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { bookings, outbox } from "./schema";

export async function bookRoom(db: BunSQLiteDatabase, input: { id: string; roomId: string; start: number; end: number }, notifyCalendar: (id: string) => Promise<void>) {
  await db.transaction(async (tx) => {
    tx.insert(bookings).values({ ...input, status: "confirmed" }).run();
    await notifyCalendar(input.id);
    tx.insert(outbox).values({ type: "booking.confirmed", payload: JSON.stringify(input) }).run();
  });
}
