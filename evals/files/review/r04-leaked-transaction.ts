// booking/src/infrastructure/batching-booking-repository.ts  (Drizzle on bun:sqlite)
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { bookings } from "./schema";

type Tx = Parameters<Parameters<BunSQLiteDatabase["transaction"]>[0]>[0];

export class BatchingBookingRepository {
  private tx: Tx | undefined;
  private pending: { id: string; status: string }[] = [];

  constructor(private readonly db: BunSQLiteDatabase) {}

  begin(): void {
    this.db.transaction((tx) => {
      this.tx = tx;
    });
  }

  stage(row: { id: string; status: string }): void {
    this.pending.push(row);
  }

  flush(): void {
    for (const row of this.pending) this.tx?.insert(bookings).values(row).run();
    this.pending = [];
  }
}
