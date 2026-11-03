export abstract class DomainError extends Error {
  abstract readonly code: string;
}

export class InvalidIdentifierError extends DomainError {
  readonly code = "INVALID_IDENTIFIER";
  /** The raw value is deliberately not part of the message: messages reach clients. */
  constructor(kind: string) {
    super(`${kind} is malformed`);
  }
}

export class InvalidValueError extends DomainError {
  readonly code = "INVALID_VALUE";
  constructor(kind: string, reason: string) {
    super(`${kind}: ${reason}`);
  }
}
