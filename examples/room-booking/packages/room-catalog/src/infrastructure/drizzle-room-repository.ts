import { eq } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { toRoomId, type RoomId } from "@example/shared-kernel";
import { Room } from "../domain/room";
import type { RoomRepository } from "../application/ports";
import { rooms } from "./schema";

export class DrizzleRoomRepository implements RoomRepository {
  constructor(private readonly db: BunSQLiteDatabase) {}

  findById(id: RoomId): Room | undefined {
    const row = this.db.select().from(rooms).where(eq(rooms.id, id)).get();
    if (row === undefined) return undefined;
    return Room.reconstitute({ id: toRoomId(row.id), name: row.name, capacity: row.capacity, lifecycle: row.lifecycle });
  }

  save(room: Room): void {
    const s = room.toSnapshot();
    this.db
      .insert(rooms)
      .values(s)
      .onConflictDoUpdate({ target: rooms.id, set: { name: s.name, capacity: s.capacity, lifecycle: s.lifecycle } })
      .run();
  }
}
