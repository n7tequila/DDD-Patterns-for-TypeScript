import type { RoomViewV1 } from "@example/contracts";
import { toRoomId } from "@example/shared-kernel";
import type { RoomSnapshot } from "../../../domain/room-snapshot";

export function toRoomSnapshot(view: RoomViewV1): RoomSnapshot {
  return { roomId: toRoomId(view.room_id), capacity: view.seats, bookable: view.lifecycle === "ACTIVE" };
}
