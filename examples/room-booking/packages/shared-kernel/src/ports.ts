import type { EpochMillis } from "./time";

export interface Clock {
  now(): EpochMillis;
}

export interface IdGenerator {
  next(): string;
}

export type MemberRole = "member" | "admin";
