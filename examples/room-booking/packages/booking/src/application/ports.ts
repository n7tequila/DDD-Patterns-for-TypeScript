import type { RoomId } from "@example/shared-kernel";
import type { Booking, BookingEvent } from "../domain/booking";
import type { BookingId } from "../domain/ids";
import type { RoomSnapshot } from "../domain/room-snapshot";
import type { TimeSlot } from "../domain/time-slot";

/** Transaction-bound and synchronous: created by the unit of work for one transaction only. */
export interface BookingRepository {
  findById(id: BookingId): Booking | undefined;
  existsOverlapping(roomId: RoomId, slot: TimeSlot): boolean;
  save(booking: Booking): void;
}

export interface OutboxWriter {
  append(events: readonly BookingEvent[]): void;
}

export interface TransactionScope {
  readonly bookings: BookingRepository;
  readonly outbox: OutboxWriter;
}

export type NotPromise<T> = T extends PromiseLike<unknown> ? never : T;

export interface UnitOfWork {
  run<T>(work: (scope: TransactionScope) => NotPromise<T>): T;
}

/** Booking's port to the room-catalog context, in booking's language. */
export interface RoomCatalog {
  findRoom(roomId: RoomId): Promise<RoomSnapshot | undefined>;
}
