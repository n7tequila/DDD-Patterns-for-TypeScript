// booking/src/application/confirm-booking.ts
import type { Booking } from "../domain/booking";

export interface BookingRepository { findById(id: string): Promise<Booking | undefined>; save(b: Booking): Promise<void>; }
export interface EventBus { publish(event: { type: string; payload: unknown }): Promise<void>; }

export class ConfirmBooking {
  constructor(private readonly repo: BookingRepository, private readonly bus: EventBus) {}

  async execute(id: string): Promise<void> {
    const booking = await this.repo.findById(id);
    if (!booking) throw new Error("not found");
    booking.confirm();
    await this.repo.save(booking);
    for (const event of booking.pullPendingEvents()) {
      this.bus.publish({ type: event.type, payload: event });
    }
  }
}
