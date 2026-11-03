import type { Brand } from "./brand";
import { InvalidIdentifierError } from "./errors";

/** Identifiers owned by one context and referenced by others. */
export type RoomId = Brand<string, "RoomId">;
export type MemberId = Brand<string, "MemberId">;

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isIdentifier(raw: string): boolean {
  return ID_PATTERN.test(raw);
}

export function toRoomId(raw: string): RoomId {
  if (!isIdentifier(raw)) throw new InvalidIdentifierError("RoomId");
  return raw as RoomId;
}

export function toMemberId(raw: string): MemberId {
  if (!isIdentifier(raw)) throw new InvalidIdentifierError("MemberId");
  return raw as MemberId;
}
