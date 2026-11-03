import { and, asc, eq, isNull, lt } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type { Clock } from "@example/shared-kernel";
import { outbox } from "../persistence/schema";

export type Deliver = (payload: unknown) => Promise<void>;

const MAX_ATTEMPTS = 5;

/**
 * Delivers committed outbox rows at least once. Timing: only committed rows exist to be read.
 * Isolation: each mark-as-sent or failure record is its own synchronous transaction.
 * Containment: one failing delivery is recorded and the loop continues.
 * Re-entrancy: a run that starts while the previous one is still delivering is skipped, so a timer
 * that fires faster than delivery cannot hand the same row to two concurrent runs.
 */
export class OutboxRelay {
  #running = false;

  constructor(
    private readonly db: BunSQLiteDatabase,
    private readonly deliver: Deliver,
    private readonly clock: Clock,
  ) {}

  async relayOnce(batchSize = 50): Promise<{ readonly sent: number; readonly failed: number; readonly skipped: boolean }> {
    if (this.#running) return { sent: 0, failed: 0, skipped: true };
    this.#running = true;
    try {
      return { ...(await this.#deliverBatch(batchSize)), skipped: false };
    } finally {
      this.#running = false;
    }
  }

  async #deliverBatch(batchSize: number): Promise<{ readonly sent: number; readonly failed: number }> {
    const pending = this.db
      .select()
      .from(outbox)
      .where(and(isNull(outbox.sentAt), lt(outbox.attempts, MAX_ATTEMPTS)))
      .orderBy(asc(outbox.seq))
      .limit(batchSize)
      .all();
    let sent = 0;
    let failed = 0;
    for (const row of pending) {
      try {
        await this.deliver(JSON.parse(row.payload));
        this.db.transaction((tx) => {
          tx.update(outbox).set({ sentAt: this.clock.now() }).where(eq(outbox.seq, row.seq)).run();
        });
        sent += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.db.transaction((tx) => {
          tx.update(outbox).set({ attempts: row.attempts + 1, lastError: message }).where(eq(outbox.seq, row.seq)).run();
        });
        failed += 1;
      }
    }
    return { sent, failed };
  }
}
