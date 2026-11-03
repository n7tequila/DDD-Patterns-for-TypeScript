import type { Result, RoomId } from "@example/shared-kernel";
import type { BookingId } from "../domain/ids";
import type { TimeSlot } from "../domain/time-slot";

export type BookRoomFailure =
  | { readonly kind: "RoomNotFound"; readonly roomId: RoomId }
  | { readonly kind: "RoomNotBookable"; readonly roomId: RoomId }
  | { readonly kind: "SlotTaken"; readonly roomId: RoomId; readonly slot: TimeSlot };

export type BookRoomResult = Result<{ readonly bookingId: BookingId }, BookRoomFailure>;

export type CancelBookingFailure =
  | { readonly kind: "BookingNotFound"; readonly bookingId: BookingId }
  | { readonly kind: "NotAllowed"; readonly bookingId: BookingId };

export type CancelBookingResult = Result<{ readonly bookingId: BookingId }, CancelBookingFailure>;
