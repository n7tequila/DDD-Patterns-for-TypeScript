import { DomainError, InvalidValueError, type RoomId } from "@example/shared-kernel";

const ROOM_LIFECYCLES = ["draft", "active", "under-maintenance", "retired"] as const;
export type RoomLifecycle = (typeof ROOM_LIFECYCLES)[number];

export function toRoomLifecycle(raw: string): RoomLifecycle {
  const found = ROOM_LIFECYCLES.find((l) => l === raw);
  if (found === undefined) throw new InvalidValueError("RoomLifecycle", "unknown lifecycle");
  return found;
}

export interface RoomSnapshot {
  readonly id: RoomId;
  readonly name: string;
  readonly capacity: number;
  readonly lifecycle: RoomLifecycle;
}

export class RoomRuleViolation extends DomainError {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export class Room {
  #id: RoomId;
  #name: string;
  #capacity: number;
  #lifecycle: RoomLifecycle;

  private constructor(snapshot: RoomSnapshot) {
    if (snapshot.name.trim() === "") throw new InvalidValueError("Room.name", "must not be blank");
    if (!Number.isInteger(snapshot.capacity) || snapshot.capacity < 1) {
      throw new InvalidValueError("Room.capacity", "must be a positive integer");
    }
    this.#id = snapshot.id;
    this.#name = snapshot.name;
    this.#capacity = snapshot.capacity;
    this.#lifecycle = snapshot.lifecycle;
  }

  static register(input: { id: RoomId; name: string; capacity: number }): Room {
    return new Room({ ...input, lifecycle: "draft" });
  }

  static reconstitute(snapshot: RoomSnapshot): Room {
    return new Room(snapshot);
  }

  get id(): RoomId { return this.#id; }

  activate(): void {
    if (this.#lifecycle === "retired") throw new RoomRuleViolation("ROOM_RETIRED", "a retired room cannot be activated");
    this.#lifecycle = "active";
  }

  retire(): void {
    this.#lifecycle = "retired";
  }

  toSnapshot(): RoomSnapshot {
    return { id: this.#id, name: this.#name, capacity: this.#capacity, lifecycle: this.#lifecycle };
  }
}
