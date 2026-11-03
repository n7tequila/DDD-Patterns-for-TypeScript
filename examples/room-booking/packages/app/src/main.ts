import { loadConfig } from "./config";
import { composeApp } from "./composition-root";

const config = loadConfig(Bun.env);
const { app, relay } = composeApp({ dbPath: config.DB_PATH });

const server = Bun.serve({ port: config.PORT, fetch: app.fetch });
console.log(`room-booking listening on ${server.port}`);

const RELAY_INTERVAL_MS = 2_000;
setInterval(() => {
  relay.relayOnce().catch((error: unknown) => console.error("relay failed", error));
}, RELAY_INTERVAL_MS);
