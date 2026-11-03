import { z } from "zod";

const configSchema = z.object({
  DB_PATH: z.string().min(1).default("room-booking.db"),
  PORT: z.coerce.number().int().min(0).max(65535).default(3000),
});

export type Config = z.infer<typeof configSchema>;

/** The only place that reads the environment. */
export function loadConfig(env: Record<string, string | undefined>): Config {
  return configSchema.parse(env);
}
