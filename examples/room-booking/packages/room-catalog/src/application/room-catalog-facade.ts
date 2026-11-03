import type { RoomViewV1 } from "@example/contracts";
import type { RoomId } from "@example/shared-kernel";
import { Room, type RoomLifecycle } from "../domain/room";
import type { RoomRepository } from "./ports";

const LIFECYCLE_CODES: Record<RoomLifecycle, RoomViewV1["lifecycle"]> = {
  draft: "DRAFT",
  active: "ACTIVE",
  "under-maintenance": "UNDER_MAINTENANCE",
  retired: "RETIRED",
};

/** The only entry point other contexts and the app may call. Speaks published language, never the aggregate. */
export class RoomCatalogFacade {
  constructor(private readonly rooms: RoomRepository) {}

  getRoomView(roomId: RoomId): RoomViewV1 | undefined {
    const room = this.rooms.findById(roomId);
    if (room === undefined) return undefined;
    const s = room.toSnapshot();
    return { room_id: s.id, name: s.name, seats: s.capacity, lifecycle: LIFECYCLE_CODES[s.lifecycle] };
  }

  registerActiveRoom(input: { id: RoomId; name: string; capacity: number }): void {
    const room = Room.register(input);
    room.activate();
    this.rooms.save(room);
  }

  retireRoom(roomId: RoomId): void {
    const room = this.rooms.findById(roomId);
    if (room === undefined) return;
    room.retire();
    this.rooms.save(room);
  }
}
