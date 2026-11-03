import { toEpochMillis, toMemberId, toRoomId, type Clock, type IdGenerator } from "@example/shared-kernel";
import { TimeSlot } from "../src/domain/time-slot";

export const ROOM = toRoomId("00000000-0000-4000-8000-000000000001");
export const OTHER_ROOM = toRoomId("00000000-0000-4000-8000-000000000002");
export const ALICE = toMemberId("00000000-0000-4000-8000-00000000a11c");
export const BOB = toMemberId("00000000-0000-4000-8000-000000000b0b");
export const NOW = toEpochMillis(1_000_000_000);
export const HOUR = 3_600_000;

export const fixedClock = (at = NOW): Clock => ({ now: () => at });

export function sequentialIds(prefix = "10000000-0000-4000-8000-"): IdGenerator {
  let n = 0;
  return { next: () => `${prefix}${String(++n).padStart(12, "0")}` };
}

export const slotFromNow = (startHours: number, hours = 1): TimeSlot =>
  TimeSlot.of(toEpochMillis(NOW + startHours * HOUR), toEpochMillis(NOW + (startHours + hours) * HOUR));
