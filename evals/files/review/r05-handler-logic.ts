// booking/src/interfaces/http/routes.ts  (Hono)
import { Hono } from "hono";
import type { BookingRepository } from "../../infrastructure/drizzle-booking-repository";

export function routes(repo: BookingRepository) {
  const app = new Hono();
  app.post("/bookings/:id/cancel", async (c) => {
    const memberId = c.req.header("x-member-id") ?? "";
    const isAdmin = memberId.endsWith("@admin");
    const booking = await repo.findById(c.req.param("id"));
    if (!booking) return c.json({ error: "not found" }, 404);
    if (!isAdmin && booking.organizerId !== memberId) return c.json({ error: "forbidden" }, 403);
    if (booking.status === "checked-in") return c.json({ error: "too late" }, 409);
    booking.status = "cancelled";
    booking.refundCurrency = booking.refundCurrency ?? "USD";
    await repo.save(booking);
    return c.json({ ok: true });
  });
  return app;
}
