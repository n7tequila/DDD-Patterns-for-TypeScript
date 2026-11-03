import { Hono } from "hono";
import type { Clock } from "@example/shared-kernel";
import type { BookRoom } from "../../application/book-room";
import type { CancelBooking } from "../../application/cancel-booking";
import type { Actor } from "../../application/commands";
import type { BookingQueries } from "../../application/queries/booking-queries";
import { toBookRoomCommand, toCancelBookingCommand, toUpcomingResponse } from "./assemblers";
import { mapFailure, mapThrown } from "./error-mapping";
import { bookRoomRequest, upcomingQuery } from "./schemas";

export type BookingEnv = { Variables: { actor: Actor } };

/** Route handlers: parse, build the command, call one service, map the result. No business decisions. */
export function bookingRoutes(deps: {
  readonly bookRoom: BookRoom;
  readonly cancelBooking: CancelBooking;
  readonly queries: BookingQueries;
  readonly clock: Clock;
  readonly log: (error: unknown) => void;
}): Hono<BookingEnv> {
  const app = new Hono<BookingEnv>();

  app.onError((error, c) => {
    const mapped = mapThrown(error);
    if (mapped.status === 500) deps.log(error);
    return c.json(mapped.body, mapped.status);
  });

  app.post("/bookings", async (c) => {
    const parsed = bookRoomRequest.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) return c.json({ code: "BAD_REQUEST", message: parsed.error.message }, 400);
    const result = await deps.bookRoom.execute(toBookRoomCommand(parsed.data, c.get("actor")));
    if (!result.ok) {
      const mapped = mapFailure(result.error);
      return c.json(mapped.body, mapped.status);
    }
    return c.json({ bookingId: result.value.bookingId }, 201);
  });

  app.post("/bookings/:id/cancel", (c) => {
    const result = deps.cancelBooking.execute(toCancelBookingCommand(c.req.param("id"), c.get("actor")));
    if (!result.ok) {
      const mapped = mapFailure(result.error);
      return c.json(mapped.body, mapped.status);
    }
    return c.json({ bookingId: result.value.bookingId }, 200);
  });

  app.get("/bookings/upcoming", (c) => {
    const parsed = upcomingQuery.safeParse(c.req.query());
    if (!parsed.success) return c.json({ code: "BAD_REQUEST", message: parsed.error.message }, 400);
    const views = deps.queries.upcomingFor(c.get("actor").memberId, deps.clock.now(), parsed.data.limit);
    return c.json(toUpcomingResponse(views), 200);
  });

  return app;
}
