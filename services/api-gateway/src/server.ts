import http from "http";
import app from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";

const server = http.createServer(app);

// ── Start server ───────────────────────────────────────────────────────────────
server.listen(env.PORT, () => {
  logger.info({
    msg: "API Gateway started",
    port: env.PORT,
    env: env.NODE_ENV,
    identityService: env.IDENTITY_SERVICE_URL,
    bankingService: env.BANKING_SERVICE_URL,
  });
});

// ── Graceful shutdown ──────────────────────────────────────────────────────────
function gracefulShutdown(signal: string) {
  logger.info({ msg: `${signal} received, starting graceful shutdown` });

  server.close((err) => {
    if (err) {
      logger.error({
        msg: "Error during server shutdown",
        error: err.message,
      });
      process.exit(1);
    }

    logger.info({ msg: "Server closed successfully" });
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error({
      msg: "Forced shutdown after timeout",
    });
    process.exit(1);
  }, 30000);
}

// Register shutdown handlers
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught errors
process.on("uncaughtException", (err) => {
  logger.fatal({
    msg: "Uncaught exception",
    error: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.fatal({
    msg: "Unhandled promise rejection",
    reason: String(reason),
  });
  process.exit(1);
});
