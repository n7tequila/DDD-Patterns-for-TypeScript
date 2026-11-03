import { InvalidIdentifierError, isIdentifier, type Brand } from "@example/shared-kernel";

export type BookingId = Brand<string, "BookingId">;

export function toBookingId(raw: string): BookingId {
  if (!isIdentifier(raw)) throw new InvalidIdentifierError("BookingId", raw);
  return raw as BookingId;
}
