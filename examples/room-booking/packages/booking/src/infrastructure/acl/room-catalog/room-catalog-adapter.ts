import { roomViewV1 } from "@example/contracts";
import type { RoomId } from "@example/shared-kernel";
import type { RoomCatalog } from "../../../application/ports";
import type { RoomSnapshot } from "../../../domain/room-snapshot";
import { toRoomSnapshot } from "./room-catalog-translator";

/** Anything that can return the room-catalog's published view: the in-process facade or an HTTP client. */
export interface RoomCatalogClient {
  fetchRoom(roomId: RoomId): Promise<unknown>;
}

export class IntegrationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export class RoomCatalogAdapter implements RoomCatalog {
  constructor(private readonly client: RoomCatalogClient) {}

  async findRoom(roomId: RoomId): Promise<RoomSnapshot | undefined> {
    const raw = await this.client.fetchRoom(roomId);
    if (raw === undefined) return undefined;
    const parsed = roomViewV1.safeParse(raw);
    if (!parsed.success) throw new IntegrationError("ROOM_CATALOG_CONTRACT_VIOLATION", parsed.error.message);
    return toRoomSnapshot(parsed.data);
  }
}
