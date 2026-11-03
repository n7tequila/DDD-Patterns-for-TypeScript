import type { MemberId, MemberRole, RoomId } from "@example/shared-kernel";
import type { BookingId } from "../domain/ids";
import type { TimeSlot } from "../domain/time-slot";

export interface Actor {
  readonly memberId: MemberId;
  readonly role: MemberRole;
}

export interface BookRoomCommand {
  readonly actor: Actor;
  readonly roomId: RoomId;
  readonly slot: TimeSlot;
}

export interface CancelBookingCommand {
  readonly actor: Actor;
  readonly bookingId: BookingId;
}
