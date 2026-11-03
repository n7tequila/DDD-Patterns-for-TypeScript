import { and, asc, eq, gte, ne } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { toEpochMillis, type EpochMillis, type MemberId } from "@example/shared-kernel";
import type { BookingQueries, UpcomingBookingView } from "../../application/queries/booking-queries";
import { bookings } from "./schema";

const MAX_PAGE = 100;

export class DrizzleBookingQueries implements BookingQueries {
  constructor(private readonly db: BunSQLiteDatabase) {}

  upcomingFor(member: MemberId, from: EpochMillis, limit: number): readonly UpcomingBookingView[] {
    return this.db
      .select({ bookingId: bookings.id, roomId: bookings.roomId, start: bookings.start, end: bookings.end, status: bookings.status })
      .from(bookings)
      .where(and(eq(bookings.organizer, member), ne(bookings.status, "cancelled"), gte(bookings.end, from)))
      .orderBy(asc(bookings.start))
      .limit(Math.min(Math.max(limit, 1), MAX_PAGE))
      .all()
      .map((r) => ({ ...r, start: toEpochMillis(r.start), end: toEpochMillis(r.end) }));
  }
}
