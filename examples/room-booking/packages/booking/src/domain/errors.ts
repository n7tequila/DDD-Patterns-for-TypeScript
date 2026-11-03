import { DomainError } from "@example/shared-kernel";

export class BookingRuleViolation extends DomainError {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
