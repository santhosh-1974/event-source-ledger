import { z } from "zod";

import { logger } from "../config/logger";
import { disconnectDB } from "../database/database";
import { replayFailedNotifications } from "../notifications/notification.repository";

const eventId = process.argv[2];
const confirmation = process.argv[3];

async function main(): Promise<void> {
  if (
    process.env.NOTIFICATION_REPLAY_CONFIRM !== "true" ||
    confirmation !== "--confirm" ||
    !z.uuid().safeParse(eventId).success
  ) {
    throw new Error(
      "Usage: NOTIFICATION_REPLAY_CONFIRM=true npm run notification:replay -- <event-uuid> --confirm"
    );
  }

  const resetCount = await replayFailedNotifications(eventId!);
  if (resetCount === 0) {
    throw new Error(
      `No failed notification deliveries are eligible for event ${eventId}`
    );
  }
  logger.info({ eventId, resetCount }, "Failed notification deliveries reset");
}

async function run(): Promise<void> {
  try {
    await main();
  } catch (error) {
    logger.error({ err: error }, "Failed to replay notification deliveries");
    process.exitCode = 1;
  } finally {
    try {
      await disconnectDB();
    } catch (error) {
      logger.error({ err: error }, "Failed to close notification database");
      process.exitCode = 1;
    }
  }
}

void run();
