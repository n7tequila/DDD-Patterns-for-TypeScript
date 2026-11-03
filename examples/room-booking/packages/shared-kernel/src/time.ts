import type { Brand } from "./brand";
import { InvalidValueError } from "./errors";

export type EpochMillis = Brand<number, "EpochMillis">;

export function toEpochMillis(raw: number): EpochMillis {
  if (!Number.isSafeInteger(raw) || raw < 0) throw new InvalidValueError("EpochMillis", String(raw));
  return raw as EpochMillis;
}
