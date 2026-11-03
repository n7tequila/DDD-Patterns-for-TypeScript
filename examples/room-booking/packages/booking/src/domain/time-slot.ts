import { InvalidValueError, type EpochMillis } from "@example/shared-kernel";

export class TimeSlot {
  static readonly MAX_MINUTES = 8 * 60;

  readonly #start: EpochMillis;
  readonly #end: EpochMillis;

  private constructor(start: EpochMillis, end: EpochMillis) {
    this.#start = start;
    this.#end = end;
    Object.freeze(this);
  }

  static of(start: EpochMillis, end: EpochMillis): TimeSlot {
    if (end <= start) throw new InvalidValueError("TimeSlot", "end must be after start");
    if (end - start > TimeSlot.MAX_MINUTES * 60_000) throw new InvalidValueError("TimeSlot", "slot is longer than the maximum");
    return new TimeSlot(start, end);
  }

  get start(): EpochMillis { return this.#start; }
  get end(): EpochMillis { return this.#end; }

  overlaps(other: TimeSlot): boolean {
    return this.#start < other.#end && other.#start < this.#end;
  }

  equals(other: TimeSlot): boolean {
    return this.#start === other.#start && this.#end === other.#end;
  }
}
