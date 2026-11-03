import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { roomViewV1 } from "@example/contracts";
import { toRoomId } from "@example/shared-kernel";
import { createRoomCatalogModule, migrateRoomCatalog } from "../src/index";
import { JOURNAL_TAGS, MIGRATIONS } from "../src/infrastructure/migrations.generated";

test("the facade publishes a contract-valid view and reflects retirement", () => {
  const sqlite = new Database(":memory:");
  migrateRoomCatalog(sqlite);
  const { facade } = createRoomCatalogModule({ db: drizzle(sqlite) });
  const id = toRoomId("00000000-0000-4000-8000-000000000001");
  facade.registerActiveRoom({ id, name: "Atlas", capacity: 8 });
  expect(roomViewV1.parse(facade.getRoomView(id)).lifecycle).toBe("ACTIVE");
  facade.retireRoom(id);
  expect(facade.getRoomView(id)?.lifecycle).toBe("RETIRED");
});

test("the embedded migration list matches the drizzle-kit journal", () => {
  expect(MIGRATIONS.map((m) => m.tag)).toEqual([...JOURNAL_TAGS]);
});

test("an unknown lifecycle in storage fails loudly", () => {
  const sqlite = new Database(":memory:");
  migrateRoomCatalog(sqlite);
  sqlite.run("INSERT INTO rooms VALUES ('00000000-0000-4000-8000-000000000001', 'Atlas', 8, 'bogus')");
  const { facade } = createRoomCatalogModule({ db: drizzle(sqlite) });
  expect(() => facade.getRoomView(toRoomId("00000000-0000-4000-8000-000000000001"))).toThrow("unknown lifecycle");
});
