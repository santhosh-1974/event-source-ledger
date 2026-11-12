import http from "node:http";

import app from "./app";
import { env } from "./config/env";
import { pool } from "./database/database";

const server = http.createServer(app);

server.listen(env.PORT, () => {
  console.info(`[customer-service] listening on port ${env.PORT}`);
});

async function shutdown(signal: string): Promise<void> {
  console.info(`[customer-service] ${signal} received; shutting down`);
  server.close(async (error) => {
    if (error) {
      console.error("[customer-service] HTTP server shutdown failed", error);
      process.exitCode = 1;
    }
    await pool.end();
    process.exit();
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
