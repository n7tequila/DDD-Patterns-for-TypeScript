// booking/src/domain/booking.ts
import { z } from "zod";

const slotSchema = z.object({ start: z.number(), end: z.number() });

export class Booking {
  #id: string;
  #start: number;
  #end: number;
  #createdAt: number;

  private constructor(id: string, start: number, end: number, createdAt: number) {
    this.#id = id; this.#start = start; this.#end = end; this.#createdAt = createdAt;
  }

  static create(input: unknown): Booking {
    const slot = slotSchema.parse(input);
    if (slot.start <= Date.now()) throw new Error("must start in the future");
    return new Booking(crypto.randomUUID(), slot.start, slot.end, Date.now());
  }

  get id(): string { return this.#id; }
}
