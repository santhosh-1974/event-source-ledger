import { logger } from "../../config/logger";
import {
  markOutboxEventDead,
  markOutboxEventPublished,
  claimOutboxEvents,
  recordOutboxPublishFailure,
} from "./outbox.repository";
import { safeParseBankingEvent } from "./banking-event.schema";
import { EventPublisher } from "./sqs-event-publisher";

export interface OutboxPublisherOptions {
  batchSize: number;
  leaseMs: number;
  maxAttempts: number;
  retryBaseMs: number;
  retryMaxMs: number;
}

export interface OutboxPublishResult {
  claimed: number;
  published: number;
  retried: number;
  dead: number;
}

function retryDelayMs(
  attemptCount: number,
  retryBaseMs: number,
  retryMaxMs: number
): number {
  return Math.min(retryBaseMs * 2 ** (attemptCount - 1), retryMaxMs);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown SQS publish error";
}

export async function publishOutboxBatch(
  transport: EventPublisher,
  options: OutboxPublisherOptions
): Promise<OutboxPublishResult> {
  const claimed = await claimOutboxEvents(
    options.batchSize,
    options.leaseMs,
    options.maxAttempts
  );
  const result: OutboxPublishResult = {
    claimed: claimed.length,
    published: 0,
    retried: 0,
    dead: 0,
  };

  for (const record of claimed) {
    const parsed = safeParseBankingEvent(record.event);
    if (!parsed.success) {
      const issuePaths = parsed.error.issues.map((issue) =>
        issue.path.join(".")
      );
      const markedDead = await markOutboxEventDead(
        record.id,
        record.lockToken,
        `Invalid event schema at: ${issuePaths.join(", ") || "root"}`
      );
      if (markedDead) {
        result.dead += 1;
        logger.error(
          { eventId: record.id, issuePaths },
          "Poison outbox event moved to DEAD"
        );
      } else {
        logger.warn(
          { eventId: record.id },
          "Outbox lease expired before poison event could be marked DEAD"
        );
      }
      continue;
    }

    let messageId: string | undefined;
    try {
      messageId = await transport.publish(parsed.data);
    } catch (error) {
      const retryDelay = retryDelayMs(
        record.attemptCount,
        options.retryBaseMs,
        options.retryMaxMs
      );
      const status = await recordOutboxPublishFailure(
        record.id,
        record.lockToken,
        errorMessage(error),
        retryDelay,
        options.maxAttempts
      );

      if (status === null) {
        logger.warn(
          { eventId: record.id, eventType: parsed.data.eventType },
          "Outbox lease expired before publish failure could be recorded"
        );
      } else if (status === "DEAD") {
        result.dead += 1;
        logger.error(
          {
            eventId: record.id,
            eventType: parsed.data.eventType,
            attemptCount: record.attemptCount,
            error: errorMessage(error),
          },
          "Outbox event exhausted publish attempts"
        );
      } else {
        result.retried += 1;
        logger.warn(
          {
            eventId: record.id,
            eventType: parsed.data.eventType,
            attemptCount: record.attemptCount,
            retryDelayMs: retryDelay,
            error: errorMessage(error),
          },
          "Outbox event scheduled for retry"
        );
      }
      continue;
    }

    const markedPublished = await markOutboxEventPublished(
      record.id,
      record.lockToken,
      messageId
    );
    if (!markedPublished) {
      logger.warn(
        { eventId: record.id, eventType: parsed.data.eventType, messageId },
        "SQS accepted event after its lease expired; a duplicate may be published"
      );
      continue;
    }

    result.published += 1;
    logger.info(
      { eventId: record.id, eventType: parsed.data.eventType, messageId },
      "Outbox event published"
    );
  }

  return result;
}
