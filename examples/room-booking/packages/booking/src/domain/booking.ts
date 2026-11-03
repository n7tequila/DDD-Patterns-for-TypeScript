import { InvalidValueError, type EpochMillis, type MemberId, type MemberRole, type RoomId } from "@example/shared-kernel";
import { BookingRuleViolation } from "./errors";
import type { BookingId } from "./ids";
import type { TimeSlot } from "./time-slot";

const BOOKING_STATUSES = ["confirmed", "checked-in", "cancelled"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** Rebuilds a status read from storage; `$type<BookingStatus>()` on the column is compile-time only. */
export function toBookingStatus(raw: string): BookingStatus {
  const found = BOOKING_STATUSES.find((s) => s === raw);
  if (found === undefined) throw new InvalidValueError("BookingStatus", "unknown status");
  return found;
}

export type BookingEvent =
  | { readonly type: "BookingConfirmed"; readonly bookingId: BookingId; readonly roomId: RoomId; readonly slot: TimeSlot }
  | { readonly type: "BookingCancelled"; readonly bookingId: BookingId; readonly roomId: RoomId; readonly cancelledBy: MemberId }
  | { readonly type: "MemberCheckedIn"; readonly bookingId: BookingId; readonly at: EpochMillis };

export interface BookingSnapshot {
  readonly id: BookingId;
  readonly roomId: RoomId;
  readonly organizer: MemberId;
  readonly slot: TimeSlot;
  readonly status: BookingStatus;
  readonly version: number;
}

const CHECK_IN_EARLY_MS = 10 * 60_000;

export class Booking {
  #id: BookingId;
  #roomId: RoomId;
  #organizer: MemberId;
  #slot: TimeSlot;
  #status: BookingStatus;
  #version: number;
  #pendingEvents: BookingEvent[] = [];

  private constructor(snapshot: BookingSnapshot) {
    this.#id = snapshot.id;
    this.#roomId = snapshot.roomId;
    this.#organizer = snapshot.organizer;
    this.#slot = snapshot.slot;
    this.#status = snapshot.status;
    this.#version = snapshot.version;
  }

  static create(input: { id: BookingId; roomId: RoomId; organizer: MemberId; slot: TimeSlot }, now: EpochMillis): Booking {
    if (input.slot.start <= now) throw new BookingRuleViolation("SLOT_IN_PAST", "a booking must start in the future");
    const booking = new Booking({ ...input, status: "confirmed", version: 0 });
    booking.#record({ type: "BookingConfirmed", bookingId: input.id, roomId: input.roomId, slot: input.slot });
    return booking;
  }

  static reconstitute(snapshot: BookingSnapshot): Booking {
    return new Booking(snapshot);
  }

  get id(): BookingId { return this.#id; }
  get roomId(): RoomId { return this.#roomId; }
  get slot(): TimeSlot { return this.#slot; }
  get status(): BookingStatus { return this.#status; }
  get version(): number { return this.#version; }

  /** Row-level authorization lives on the aggregate (strong rule 5). */
  canBeCancelledBy(member: MemberId, role: MemberRole): boolean {
    return this.#organizer === member || role === "admin";
  }

  cancel(by: MemberId, role: MemberRole): void {
    if (!this.canBeCancelledBy(by, role)) throw new BookingRuleViolation("NOT_ALLOWED", "only the organizer or an admin can cancel");
    if (this.#status === "cancelled") return;
    if (this.#status === "checked-in") throw new BookingRuleViolation("ALREADY_STARTED", "a started booking cannot be cancelled");
    this.#status = "cancelled";
    this.#record({ type: "BookingCancelled", bookingId: this.#id, roomId: this.#roomId, cancelledBy: by });
  }

  checkIn(by: MemberId, at: EpochMillis): void {
    if (by !== this.#organizer) throw new BookingRuleViolation("NOT_ALLOWED", "only the organizer can check in");
    if (this.#status !== "confirmed") throw new BookingRuleViolation("NOT_CHECKABLE", "only a confirmed booking can be checked in");
    if (at < this.#slot.start - CHECK_IN_EARLY_MS || at > this.#slot.end) {
      throw new BookingRuleViolation("OUTSIDE_CHECK_IN_WINDOW", "check-in is only possible from 10 minutes before the start until the end");
    }
    this.#status = "checked-in";
    this.#record({ type: "MemberCheckedIn", bookingId: this.#id, at });
  }

  toSnapshot(): BookingSnapshot {
    return { id: this.#id, roomId: this.#roomId, organizer: this.#organizer, slot: this.#slot, status: this.#status, version: this.#version };
  }

  pullPendingEvents(): readonly BookingEvent[] {
    const events = this.#pendingEvents;
    this.#pendingEvents = [];
    return events;
  }

  #record(event: BookingEvent): void {
    this.#pendingEvents.push(event);
  }
}
