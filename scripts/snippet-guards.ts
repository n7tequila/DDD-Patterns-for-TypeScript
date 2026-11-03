// Guard assertions over the reference snippets. Each @ts-expect-error must stay "used":
// if a rule stops holding, tsc reports the directive as unused and the check fails.
import {
  Booking, TimeSlot, BookRoom, toBookingId, toRoomId, toMemberId, toEpochMillis,
  type RoomId, type UnitOfWork, type TransactionScope, type BookingRepository, type OutboxWriter,
  type BookingEvent, type RoomCatalog, type Clock, type IdGenerator,
} from "./snippets";

const room: RoomId = toRoomId("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
const organizer = toMemberId("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const slot = TimeSlot.of(toEpochMillis(2_000_000), toEpochMillis(3_000_000));
const booking = Booking.create({ id: toBookingId("cccccccc-cccc-cccc-cccc-cccccccccccc"), roomId: room, organizer, slot }, toEpochMillis(1_000_000));

// @ts-expect-error a RoomId must not be accepted where a MemberId is expected
booking.isOrganizedBy(room);
// @ts-expect-error a raw string must not be accepted as an identifier
booking.cancel("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
// @ts-expect-error an object literal must not pass as a TimeSlot
const fake: TimeSlot = { start: slot.start, end: slot.end, overlaps: () => false, equals: () => true };
void fake;

// In-memory unit of work, synchronous by construction.
const rows = new Map<string, Booking>();
const sent: BookingEvent[] = [];
const scope: TransactionScope = {
  bookings: {
    findById: (id) => rows.get(id),
    existsOverlapping: (r, s) => [...rows.values()].some((b) => b.roomId === r && b.status !== "cancelled" && b.slot.overlaps(s)),
    save: (b) => { rows.set(b.id, b); },
  } satisfies BookingRepository,
  outbox: { append: (events) => { sent.push(...events); } } satisfies OutboxWriter,
};
const uow: UnitOfWork = { run: (work) => work(scope) };

// @ts-expect-error an async callback must be rejected by the unit-of-work port
uow.run(async () => 1);

const catalog: RoomCatalog = { findRoom: async (id) => (id === room ? { roomId: room, capacity: 8, bookable: true } : undefined) };
const clock: Clock = { now: () => toEpochMillis(1_000_000) };
let n = 0;
const ids: IdGenerator = { next: () => `dddddddd-dddd-dddd-dddd-${String(++n).padStart(12, "0")}` };
const service = new BookRoom(catalog, uow, clock, ids);

const first = await service.execute({ roomId: room, organizer, slot });
const second = await service.execute({ roomId: room, organizer, slot });
console.log(JSON.stringify({ first: first.ok, second: second.ok ? "ok" : second.error.kind, outbox: sent.map((e) => e.type) }));
if (!first.ok || second.ok || second.error.kind !== "SlotTaken" || sent.length !== 1) throw new Error("behavior check failed");
