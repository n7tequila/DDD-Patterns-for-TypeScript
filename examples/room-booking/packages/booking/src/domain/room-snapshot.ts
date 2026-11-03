import type { RoomId } from "@example/shared-kernel";

/** Booking's own view of a room, produced by the room-catalog ACL. */
export interface RoomSnapshot {
  readonly roomId: RoomId;
  readonly capacity: number;
  readonly bookable: boolean;
}
