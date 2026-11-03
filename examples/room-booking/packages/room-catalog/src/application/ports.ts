import type { RoomId } from "@example/shared-kernel";
import type { Room } from "../domain/room";

export interface RoomRepository {
  findById(id: RoomId): Room | undefined;
  save(room: Room): void;
}
