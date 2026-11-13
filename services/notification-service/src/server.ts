import http from "node:http";

import app from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { connectDB, disconnectDB } from "./database/database";
import {
  startNotificationConsumer,
  stopNotificationConsumer,
} from "./notifications/notification-consumer.job";

async function bootstrap(): Promise<void> {
  await connectDB();
  const server = http.createServer(app);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(env.PORT, resolve);
  });

  startNotificationConsumer();
  logger.info({ port: env.PORT }, "Notification Service started");

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "Notification Service shutting down");

    try {
      await stopNotificationConsumer();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      await disconnectDB();
    } catch (error) {
      logger.error({ err: error }, "Notification Service shutdown failed");
      process.exitCode = 1;
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

bootstrap().catch((error: unknown) => {
  logger.fatal({ err: error }, "Notification Service failed to start");
  process.exitCode = 1;
});
