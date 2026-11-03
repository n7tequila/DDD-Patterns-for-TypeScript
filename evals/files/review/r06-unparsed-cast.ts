// booking/src/interfaces/http/create-booking.ts  (Hono)
import type { Context } from "hono";
import type { BookRoom } from "../../application/book-room";
import type { MemberId, RoomId } from "@acme/shared-kernel";

interface CreateBookingBody { roomId: string; memberId: string; start: number; end: number }

export async function createBooking(c: Context, bookRoom: BookRoom) {
  const body = (await c.req.json()) as CreateBookingBody;
  const result = await bookRoom.execute({
    roomId: body.roomId as RoomId,
    organizer: body.memberId as MemberId,
    start: body.start,
    end: body.end,
  });
  return c.json(result, result.ok ? 201 : 409);
}
