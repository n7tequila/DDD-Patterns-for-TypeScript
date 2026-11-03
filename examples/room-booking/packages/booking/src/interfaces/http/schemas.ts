import { z } from "zod";

export const bookRoomRequest = z.object({
  roomId: z.string(),
  start: z.number().int(),
  end: z.number().int(),
});

export const upcomingQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
