// booking/src/domain/booking.ts and booking/src/application/booking-service.ts
export interface Booking {
  id: string;
  roomId: string;
  organizerId: string;
  start: number;
  end: number;
  status: "confirmed" | "checked-in" | "cancelled";
}

export class BookingService {
  constructor(private readonly repo: { get(id: string): Booking; put(b: Booking): void }) {}

  checkIn(id: string, memberId: string, now: number): void {
    const b = this.repo.get(id);
    if (b.organizerId === memberId && now >= b.start - 600_000 && b.status === "confirmed") {
      b.status = "checked-in";
    }
    this.repo.put(b);
  }

  cancel(id: string): void {
    const b = this.repo.get(id);
    b.status = "cancelled";
    this.repo.put(b);
  }
}
