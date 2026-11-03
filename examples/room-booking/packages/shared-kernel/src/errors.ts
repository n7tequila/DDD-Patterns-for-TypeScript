export abstract class DomainError extends Error {
  abstract readonly code: string;
}

export class InvalidIdentifierError extends DomainError {
  readonly code = "INVALID_IDENTIFIER";
  constructor(kind: string, raw: string) {
    super(`${kind} is malformed: ${raw}`);
  }
}

export class InvalidValueError extends DomainError {
  readonly code = "INVALID_VALUE";
  constructor(kind: string, reason: string) {
    super(`${kind}: ${reason}`);
  }
}
