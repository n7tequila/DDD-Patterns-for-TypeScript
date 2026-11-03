import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { toEpochMillis, toRoomId } from "@example/shared-kernel";
import { composeApp } from "../src/composition-root";

const NOW = 1_000_000_000;
const HOUR = 3_600_000;
const ROOM = "00000000-0000-4000-8000-000000000001";
const ALICE = { "x-member-id": "00000000-0000-4000-8000-00000000a11c", "content-type": "application/json" };
const BOB = { "x-member-id": "00000000-0000-4000-8000-000000000b0b", "content-type": "application/json" };

let ctx: ReturnType<typeof composeApp>;
const delivered: unknown[] = [];
let n = 0;

beforeEach(() => {
  delivered.length = 0;
  ctx = composeApp({
    dbPath: ":memory:",
    clock: { now: () => toEpochMillis(NOW) },
    ids: { next: () => `40000000-0000-4000-8000-${String(++n).padStart(12, "0")}` },
    deliver: async (payload) => void delivered.push(payload),
    log: () => {},
  });
  ctx.rooms.registerActiveRoom({ id: toRoomId(ROOM), name: "Atlas", capacity: 8 });
});
afterEach(() => ctx.close());

const book = (headers: Record<string, string>, startHours: number) =>
  ctx.app.request("/bookings", { method: "POST", headers, body: JSON.stringify({ roomId: ROOM, start: NOW + startHours * HOUR, end: NOW + (startHours + 1) * HOUR }) });

describe("composed app", () => {
  test("the full object graph boots and answers health checks", async () => {
    expect((await ctx.app.request("/health")).status).toBe(200);
  });

  test("book, conflict, forbidden cancel, own cancel, relay", async () => {
    const created = await book(ALICE, 2);
    expect(created.status).toBe(201);
    const { bookingId } = (await created.json()) as { bookingId: string };

    const conflict = await book(BOB, 2);
    expect(conflict.status).toBe(409);
    expect(((await conflict.json()) as { code: string }).code).toBe("SLOT_TAKEN");

    const forbidden = await ctx.app.request(`/bookings/${bookingId}/cancel`, { method: "POST", headers: BOB });
    expect(forbidden.status).toBe(403);

    const upcoming = (await (await ctx.app.request("/bookings/upcoming", { headers: ALICE })).json()) as { items: unknown[] };
    expect(upcoming.items).toHaveLength(1);

    const cancelled = await ctx.app.request(`/bookings/${bookingId}/cancel`, { method: "POST", headers: ALICE });
    expect(cancelled.status).toBe(200);

    expect(await ctx.relay.relayOnce()).toEqual({ sent: 2, failed: 0, skipped: false });
    expect(delivered.map((e) => (e as { type: string }).type)).toEqual(["booking.confirmed", "booking.cancelled"]);
  });

  test("rejects missing identity, malformed bodies, malformed ids, and past slots", async () => {
    expect((await ctx.app.request("/bookings", { method: "POST", body: "{}" })).status).toBe(401);
    expect((await ctx.app.request("/bookings", { method: "POST", headers: ALICE, body: "{\"roomId\":1}" })).status).toBe(400);
    expect((await ctx.app.request("/bookings/not-a-uuid/cancel", { method: "POST", headers: ALICE })).status).toBe(400);
    expect((await book(ALICE, -1)).status).toBe(422);
  });
});
