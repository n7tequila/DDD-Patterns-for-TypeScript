import { z } from "zod";

export const bookingConfirmedV1 = z.object({
  type: z.literal("booking.confirmed"),
  version: z.literal(1),
  eventId: z.string(),
  occurredAt: z.number().int(),
  payload: z.object({ bookingId: z.string(), roomId: z.string(), start: z.number().int(), end: z.number().int() }),
});
export type BookingConfirmedV1 = z.infer<typeof bookingConfirmedV1>;

export const bookingCancelledV1 = z.object({
  type: z.literal("booking.cancelled"),
  version: z.literal(1),
  eventId: z.string(),
  occurredAt: z.number().int(),
  payload: z.object({ bookingId: z.string(), roomId: z.string() }),
});
export type BookingCancelledV1 = z.infer<typeof bookingCancelledV1>;

export const bookingIntegrationEvent = z.discriminatedUnion("type", [bookingConfirmedV1, bookingCancelledV1]);
export type BookingIntegrationEvent = z.infer<typeof bookingIntegrationEvent>;
