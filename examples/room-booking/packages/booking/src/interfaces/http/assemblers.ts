import type { z } from "zod";
import { toEpochMillis, toRoomId } from "@example/shared-kernel";
import type { Actor, BookRoomCommand, CancelBookingCommand } from "../../application/commands";
import type { UpcomingBookingView } from "../../application/queries/booking-queries";
import { toBookingId } from "../../domain/ids";
import { TimeSlot } from "../../domain/time-slot";
import type { bookRoomRequest } from "./schemas";

export function toBookRoomCommand(body: z.infer<typeof bookRoomRequest>, actor: Actor): BookRoomCommand {
  return { actor, roomId: toRoomId(body.roomId), slot: TimeSlot.of(toEpochMillis(body.start), toEpochMillis(body.end)) };
}

export function toCancelBookingCommand(rawBookingId: string, actor: Actor): CancelBookingCommand {
  return { actor, bookingId: toBookingId(rawBookingId) };
}

export function toUpcomingResponse(views: readonly UpcomingBookingView[]): { readonly items: readonly UpcomingBookingView[] } {
  return { items: views };
}
