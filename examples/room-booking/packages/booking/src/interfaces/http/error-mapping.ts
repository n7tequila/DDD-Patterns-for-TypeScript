import { assertNever, DomainError } from "@example/shared-kernel";
import type { BookRoomFailure, CancelBookingFailure } from "../../application/results";

export interface ErrorResponse {
  readonly status: 400 | 403 | 404 | 409 | 422 | 500 | 502;
  readonly body: { readonly code: string; readonly message: string };
}

/** Expected business outcomes, matched by kind. */
export function mapFailure(failure: BookRoomFailure | CancelBookingFailure): ErrorResponse {
  switch (failure.kind) {
    case "RoomNotFound":
      return { status: 404, body: { code: "ROOM_NOT_FOUND", message: "room not found" } };
    case "RoomNotBookable":
      return { status: 409, body: { code: "ROOM_NOT_BOOKABLE", message: "room cannot be booked" } };
    case "SlotTaken":
      return { status: 409, body: { code: "SLOT_TAKEN", message: "the room is already booked for that time" } };
    case "BookingNotFound":
      return { status: 404, body: { code: "BOOKING_NOT_FOUND", message: "booking not found" } };
    case "NotAllowed":
      return { status: 403, body: { code: "NOT_ALLOWED", message: "you cannot change this booking" } };
    default:
      return assertNever(failure);
  }
}

const DOMAIN_STATUS: Readonly<Record<string, ErrorResponse["status"]>> = {
  INVALID_IDENTIFIER: 400,
  INVALID_VALUE: 400,
  SLOT_IN_PAST: 422,
  NOT_ALLOWED: 403,
};

/** Thrown errors, matched by code. Unknown errors become a 500 without internal details. */
export function mapThrown(error: unknown): ErrorResponse {
  if (error instanceof DomainError) {
    return { status: DOMAIN_STATUS[error.code] ?? 409, body: { code: error.code, message: error.message } };
  }
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  if (code === "OPTIMISTIC_LOCK") return { status: 409, body: { code, message: "the booking changed, please retry" } };
  if (code === "ROOM_CATALOG_CONTRACT_VIOLATION") return { status: 502, body: { code, message: "room catalog unavailable" } };
  return { status: 500, body: { code: "INTERNAL", message: "unexpected error" } };
}
