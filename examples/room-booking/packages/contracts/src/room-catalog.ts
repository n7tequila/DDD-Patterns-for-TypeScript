import { z } from "zod";

/** What the room-catalog context publishes about a room. */
export const roomViewV1 = z.object({
  room_id: z.string(),
  name: z.string(),
  seats: z.number().int().nonnegative(),
  lifecycle: z.enum(["DRAFT", "ACTIVE", "UNDER_MAINTENANCE", "RETIRED"]),
});
export type RoomViewV1 = z.infer<typeof roomViewV1>;
