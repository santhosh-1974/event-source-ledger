import { PoolClient } from "pg";

import { getClient, query } from "../database/database";
import { BankingEvent } from "../events/banking-event.schema";

interface NotificationEventRow {
  event_type: string;
  schema_version: number;
  status: "PROCESSING" | "PROCESSED";
}

interface DeliveryRow {
  id: string;
  status: "PENDING" | "SENDING" | "SENT" | "SKIPPED_CONSENT" | "FAILED";
  attempt_count: number;
  retry_count: number;
  lock_token: string | null;
  lease_active: boolean;
}

export type DeliveryClaim =
  | { kind: "complete" }
  | { kind: "in_progress" }
  | { kind: "exhausted" }
  | {
      kind: "claimed";
      deliveryId: string;
      lockToken: string;
      attemptNumber: number;
      retryCount: number;
    };

export async function beginNotificationEvent(
  event: BankingEvent
): Promise<boolean> {
  await query(
    `INSERT INTO notification.events (event_id, event_type, schema_version)
     VALUES ($1, $2, $3)
     ON CONFLICT (event_id) DO NOTHING`,
    [event.eventId, event.eventType, event.schemaVersion]
  );

  const result = await query<NotificationEventRow>(
    `SELECT event_type, schema_version, status
     FROM notification.events
     WHERE event_id = $1`,
    [event.eventId]
  );
  const stored = result.rows[0];
  if (
    !stored ||
    stored.event_type !== event.eventType ||
    stored.schema_version !== event.schemaVersion
  ) {
    throw new Error("Event ID was reused with a different banking event contract");
  }
  return stored.status === "PROCESSED";
}

export async function ensureDelivery(
  eventId: string,
  customerId: string
): Promise<void> {
  await query(
    `INSERT INTO notification.deliveries (event_id, customer_id)
     VALUES ($1, $2)
     ON CONFLICT (event_id, customer_id, channel) DO NOTHING`,
    [eventId, customerId]
  );
}

export async function isEmailConsentActive(
  customerId: string
): Promise<boolean> {
  const result = await query<{ enabled: boolean }>(
    `SELECT email_enabled
     AND consented_at IS NOT NULL
     AND revoked_at IS NULL AS enabled
     FROM notification.preferences
     WHERE customer_id = $1`,
    [customerId]
  );
  return result.rows[0]?.enabled === true;
}

async function finishTransaction(
  client: PoolClient,
  commit: boolean
): Promise<void> {
  await client.query(commit ? "COMMIT" : "ROLLBACK");
}

export async function claimDeliveryAttempt(
  eventId: string,
  customerId: string,
  maxAttempts: number,
  leaseSeconds: number
): Promise<DeliveryClaim> {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const result = await client.query<DeliveryRow>(
      `SELECT id, status, attempt_count, retry_count, lock_token,
              COALESCE(locked_until > CURRENT_TIMESTAMP, false) AS lease_active
       FROM notification.deliveries
       WHERE event_id = $1 AND customer_id = $2 AND channel = 'EMAIL'
       FOR UPDATE`,
      [eventId, customerId]
    );
    const delivery = result.rows[0];
    if (!delivery) {
      throw new Error("Notification delivery record is missing");
    }

    if (delivery.status === "SENT" || delivery.status === "SKIPPED_CONSENT") {
      await finishTransaction(client, true);
      return { kind: "complete" };
    }

    if (delivery.status === "FAILED") {
      await finishTransaction(client, true);
      return { kind: "exhausted" };
    }

    if (delivery.status === "SENDING" && delivery.lease_active) {
      await finishTransaction(client, true);
      return { kind: "in_progress" };
    }

    if (delivery.retry_count >= maxAttempts) {
      if (delivery.status === "SENDING") {
        await client.query(
          `UPDATE notification.delivery_attempts
           SET status = 'FAILED', error_code = 'LEASE_EXPIRED',
               completed_at = CURRENT_TIMESTAMP
           WHERE delivery_id = $1 AND attempt_number = $2 AND status = 'STARTED'`,
          [delivery.id, delivery.attempt_count]
        );
      }
      await client.query(
        `UPDATE notification.deliveries
         SET status = 'FAILED', lock_token = NULL, locked_until = NULL,
             last_error_code = 'ATTEMPTS_EXHAUSTED',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [delivery.id]
      );
      await finishTransaction(client, true);
      return { kind: "exhausted" };
    }

    if (delivery.status === "SENDING") {
      await client.query(
        `UPDATE notification.delivery_attempts
         SET status = 'FAILED', error_code = 'LEASE_EXPIRED',
             completed_at = CURRENT_TIMESTAMP
         WHERE delivery_id = $1 AND attempt_number = $2 AND status = 'STARTED'`,
        [delivery.id, delivery.attempt_count]
      );
    }

    const nextAttemptNumber = delivery.attempt_count + 1;
    const nextRetryCount = delivery.retry_count + 1;
    const claimed = await client.query<{ lock_token: string }>(
      `UPDATE notification.deliveries
       SET status = 'SENDING',
           attempt_count = $2,
           retry_count = $3,
           lock_token = gen_random_uuid(),
           locked_until = CURRENT_TIMESTAMP + ($4::integer * INTERVAL '1 second'),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING lock_token`,
      [delivery.id, nextAttemptNumber, nextRetryCount, leaseSeconds]
    );
    const lockToken = claimed.rows[0].lock_token;

    await client.query(
      `INSERT INTO notification.delivery_attempts (
         delivery_id, attempt_number, status
       )
       VALUES ($1, $2, 'STARTED')`,
      [delivery.id, nextAttemptNumber]
    );
    await finishTransaction(client, true);
    return {
      kind: "claimed",
      deliveryId: delivery.id,
      lockToken,
      attemptNumber: nextAttemptNumber,
      retryCount: nextRetryCount,
    };
  } catch (error) {
    await finishTransaction(client, false);
    throw error;
  } finally {
    client.release();
  }
}

async function finishDelivery(
  deliveryId: string,
  lockToken: string,
  attemptNumber: number,
  status: "SENT" | "SKIPPED_CONSENT",
  providerMessageId?: string
): Promise<boolean> {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const updated = await client.query(
      `UPDATE notification.deliveries
       SET status = $3,
           provider_message_id = $4,
           lock_token = NULL,
           locked_until = NULL,
           last_error_code = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'SENDING' AND lock_token = $2`,
      [deliveryId, lockToken, status, providerMessageId ?? null]
    );
    if (updated.rowCount !== 1) {
      await finishTransaction(client, false);
      return false;
    }

    await client.query(
      `UPDATE notification.delivery_attempts
       SET status = $3, provider_message_id = $4,
           completed_at = CURRENT_TIMESTAMP
       WHERE delivery_id = $1 AND attempt_number = $2 AND status = 'STARTED'`,
      [deliveryId, attemptNumber, status, providerMessageId ?? null]
    );
    await finishTransaction(client, true);
    return true;
  } catch (error) {
    await finishTransaction(client, false);
    throw error;
  } finally {
    client.release();
  }
}

export function markDeliverySent(
  deliveryId: string,
  lockToken: string,
  attemptNumber: number,
  providerMessageId: string
): Promise<boolean> {
  return finishDelivery(
    deliveryId,
    lockToken,
    attemptNumber,
    "SENT",
    providerMessageId
  );
}

export function markDeliverySkipped(
  deliveryId: string,
  lockToken: string,
  attemptNumber: number
): Promise<boolean> {
  return finishDelivery(
    deliveryId,
    lockToken,
    attemptNumber,
    "SKIPPED_CONSENT"
  );
}

export async function markDeliveryFailed(
  deliveryId: string,
  lockToken: string,
  attemptNumber: number,
  retryCount: number,
  maxAttempts: number,
  errorCode: string
): Promise<boolean> {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const updated = await client.query(
      `UPDATE notification.deliveries
       SET status = CASE WHEN $3 >= $4 THEN 'FAILED' ELSE 'PENDING' END,
           lock_token = NULL,
           locked_until = NULL,
           last_error_code = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'SENDING' AND lock_token = $2`,
      [
        deliveryId,
        lockToken,
        retryCount,
        maxAttempts,
        errorCode.slice(0, 100),
      ]
    );
    if (updated.rowCount !== 1) {
      await finishTransaction(client, false);
      return false;
    }

    await client.query(
      `UPDATE notification.delivery_attempts
       SET status = 'FAILED', error_code = $3,
           completed_at = CURRENT_TIMESTAMP
       WHERE delivery_id = $1 AND attempt_number = $2 AND status = 'STARTED'`,
      [deliveryId, attemptNumber, errorCode.slice(0, 100)]
    );
    await finishTransaction(client, true);
    return true;
  } catch (error) {
    await finishTransaction(client, false);
    throw error;
  } finally {
    client.release();
  }
}

export async function completeNotificationEvent(eventId: string): Promise<void> {
  const result = await query(
    `UPDATE notification.events AS event
     SET status = 'PROCESSED', processed_at = CURRENT_TIMESTAMP
     WHERE event.event_id = $1
       AND event.status = 'PROCESSING'
       AND NOT EXISTS (
         SELECT 1
         FROM notification.deliveries AS delivery
         WHERE delivery.event_id = event.event_id
           AND delivery.status NOT IN ('SENT', 'SKIPPED_CONSENT')
       )`,
    [eventId]
  );
  if (result.rowCount !== 1) {
    const existing = await query<{ status: string }>(
      "SELECT status FROM notification.events WHERE event_id = $1",
      [eventId]
    );
    if (existing.rows[0]?.status !== "PROCESSED") {
      throw new Error("Notification event still has unresolved deliveries");
    }
  }
}

export async function replayFailedNotifications(eventId: string): Promise<number> {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const event = await client.query<{ status: string }>(
      "SELECT status FROM notification.events WHERE event_id = $1 FOR UPDATE",
      [eventId]
    );
    if (!event.rows[0] || event.rows[0].status === "PROCESSED") {
      await finishTransaction(client, false);
      return 0;
    }

    const result = await client.query(
      `UPDATE notification.deliveries
       SET status = 'PENDING', retry_count = 0, last_error_code = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE event_id = $1 AND status = 'FAILED'`,
      [eventId]
    );
    await finishTransaction(client, true);
    return result.rowCount ?? 0;
  } catch (error) {
    await finishTransaction(client, false);
    throw error;
  } finally {
    client.release();
  }
}
