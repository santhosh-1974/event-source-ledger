import { disconnectDB } from "../database/database";
import { logger } from "../config/logger";
import { replayDeadOutboxEvent } from "../modules/outbox/outbox.repository";

const eventId = process.argv[2];
const confirmation = process.argv[3];

async function main(): Promise<void> {
  if (
    process.env.OUTBOX_REPLAY_CONFIRM !== "true" ||
    confirmation !== "--confirm" ||
    !eventId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      eventId
    )
  ) {
    throw new Error(
      "Usage: OUTBOX_REPLAY_CONFIRM=true npm run outbox:replay -- <event-uuid> --confirm"
    );
  }

  const replayed = await replayDeadOutboxEvent(eventId);
  if (!replayed) {
    throw new Error(`Outbox event ${eventId} was not found in DEAD status`);
  }

  logger.info({ eventId }, "Dead outbox event queued for replay");
}

async function run(): Promise<void> {
  try {
    await main();
  } catch (error) {
    logger.error({ err: error }, "Failed to replay dead outbox event");
    process.exitCode = 1;
  } finally {
    try {
    await disconnectDB();
    } catch (error) {
      logger.error({ err: error }, "Failed to close database connection");
      process.exitCode = 1;
    }
  }
}

void run();
