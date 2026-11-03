import type { EpochMillis, MemberId, RoomId } from "@example/shared-kernel";
import type { BookingStatus } from "../../domain/booking";
import type { BookingId } from "../../domain/ids";

export interface UpcomingBookingView {
  readonly bookingId: BookingId;
  readonly roomId: RoomId;
  readonly start: EpochMillis;
  readonly end: EpochMillis;
  readonly status: BookingStatus;
}

export interface BookingQueries {
  /** Row-level visibility is part of the query: only the member's own bookings. */
  upcomingFor(member: MemberId, from: EpochMillis, limit: number): readonly UpcomingBookingView[];
}
