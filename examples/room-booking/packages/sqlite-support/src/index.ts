import type { Database } from "bun:sqlite";

export interface EmbeddedMigration {
  readonly tag: string;
  readonly when: number;
  readonly sql: string;
}

const STATEMENT_BREAKPOINT = "--> statement-breakpoint";

/**
 * Applies drizzle-kit migrations that were compiled into the program, in journal order.
 * drizzle-orm's own migrator reads a folder from disk at runtime, which a single-file binary does not have.
 * Each migration and its bookkeeping row run in one transaction; already-applied tags are skipped.
 */
export function migrateEmbedded(sqlite: Database, owner: string, migrations: readonly EmbeddedMigration[]): readonly string[] {
  sqlite.run(
    "CREATE TABLE IF NOT EXISTS schema_migrations (owner TEXT NOT NULL, tag TEXT NOT NULL, applied_at INTEGER NOT NULL, PRIMARY KEY (owner, tag))",
  );
  const applied: string[] = [];
  for (const migration of migrations) {
    const done = sqlite.query("SELECT 1 FROM schema_migrations WHERE owner = ? AND tag = ?").get(owner, migration.tag);
    if (done !== null) continue;
    sqlite.transaction(() => {
      for (const statement of migration.sql.split(STATEMENT_BREAKPOINT)) {
        if (statement.trim() !== "") sqlite.run(statement);
      }
      sqlite.run("INSERT INTO schema_migrations (owner, tag, applied_at) VALUES (?, ?, ?)", [owner, migration.tag, migration.when]);
    })();
    applied.push(migration.tag);
  }
  return applied;
}
