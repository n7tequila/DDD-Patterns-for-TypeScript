import type { Database } from "bun:sqlite";
import { migrateEmbedded } from "@example/sqlite-support";
import { JOURNAL_TAGS, MIGRATIONS } from "./migrations.generated";

export function migrateRoomCatalog(sqlite: Database): readonly string[] {
  return migrateEmbedded(sqlite, "room-catalog", MIGRATIONS, JOURNAL_TAGS);
}
