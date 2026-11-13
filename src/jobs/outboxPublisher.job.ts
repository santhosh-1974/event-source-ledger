import { env } from "../config/env";
import { logger } from "../config/logger";
import { publishOutboxBatch } from "../modules/outbox/outbox.publisher";
import { SqsEventPublisher } from "../modules/outbox/sqs-event-publisher";

let pollingTimer: ReturnType<typeof setInterval> | null = null;
let activePoll: Promise<void> | null = null;
let publisher: SqsEventPublisher | null = null;

export function startOutboxPublisherJob(): void {
  if (!env.OUTBOX_PUBLISHER_ENABLED || pollingTimer) {
    return;
  }
  if (!env.OUTBOX_SQS_QUEUE_URL) {
    throw new Error(
      "OUTBOX_SQS_QUEUE_URL is required when OUTBOX_PUBLISHER_ENABLED=true"
    );
  }

  publisher = new SqsEventPublisher(env.OUTBOX_SQS_QUEUE_URL);
  const runPoll = () => {
    if (activePoll || !publisher) {
      return;
    }

    activePoll = publishOutboxBatch(publisher, {
      batchSize: env.OUTBOX_BATCH_SIZE,
      leaseMs: env.OUTBOX_LEASE_MS,
      maxAttempts: env.OUTBOX_MAX_ATTEMPTS,
      retryBaseMs: env.OUTBOX_RETRY_BASE_MS,
      retryMaxMs: env.OUTBOX_RETRY_MAX_MS,
    })
      .then(() => undefined)
      .catch((error: unknown) => {
        logger.error({ err: error }, "Outbox publisher poll failed");
      })
      .finally(() => {
        activePoll = null;
      });
  };

  runPoll();
  pollingTimer = setInterval(runPoll, env.OUTBOX_POLL_INTERVAL_MS);
  pollingTimer.unref();
  logger.info(
    { pollIntervalMs: env.OUTBOX_POLL_INTERVAL_MS },
    "SQS outbox publisher started"
  );
}

export async function stopOutboxPublisherJob(): Promise<void> {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
  if (activePoll) {
    await activePoll;
  }
  publisher?.close();
  publisher = null;
}
