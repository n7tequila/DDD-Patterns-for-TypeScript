// booking/src/domain/ids.ts and a use of it
export class BookingId {
  private constructor(public readonly value: string) {}
  static of(value: string): BookingId { return new BookingId(value); }
  equals(other: BookingId): boolean { return this.value === other.value; }
}
export class MemberId {
  private constructor(public readonly value: string) {}
  static of(value: string): MemberId { return new MemberId(value); }
  equals(other: MemberId): boolean { return this.value === other.value; }
}

// booking/src/application/list-bookings.ts
export interface BookingReadRepository {
  listByOwner(owner: MemberId): Promise<readonly { id: string; title: string }[]>;
}
export async function listMyBookings(repo: BookingReadRepository, requester: MemberId, bookingId: BookingId) {
  // returns the bookings owned by the requester
  return repo.listByOwner(bookingId.equals(BookingId.of("")) ? requester : bookingId);
}
