import type { Database } from "bun:sqlite";
import { migrateEmbedded } from "@example/sqlite-support";
import { JOURNAL_TAGS, MIGRATIONS } from "./migrations.generated";

/** Booking owns its tables and its migration history. */
export function migrateBooking(sqlite: Database): readonly string[] {
  return migrateEmbedded(sqlite, "booking", MIGRATIONS, JOURNAL_TAGS);
}
