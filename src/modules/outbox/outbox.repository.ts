import { randomUUID } from "node:crypto";
import { PoolClient } from "pg";

import { pool } from "../../database/database";
import { BankingEvent, parseBankingEvent } from "./banking-event.schema";

interface OutboxRow {
  id: string;
  event_type: string;
  schema_version: number;
  aggregate_type: string;
  aggregate_id: string;
  occurred_at: Date;
  payload: unknown;
  attempt_count: number;
  lock_token: string;
}

export interface ClaimedOutboxEvent {
  id: string;
  event: unknown;
  attemptCount: number;
  lockToken: string;
}

export async function appendOutboxEvent(
  input: BankingEvent,
  client: PoolClient
): Promise<void> {
  const event = parseBankingEvent(input);
  await client.query(
    `INSERT INTO banking_outbox (
       id, event_type, schema_version, aggregate_type, aggregate_id,
       occurred_at, payload
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      event.eventId,
      event.eventType,
      event.schemaVersion,
      event.aggregateType,
      event.aggregateId,
      event.occurredAt,
      event.payload,
    ]
  );
}

export async function claimOutboxEvents(
  batchSize: number,
  leaseMs: number,
  maxAttempts: number
): Promise<ClaimedOutboxEvent[]> {
  const result = await pool.query<OutboxRow>(
    `WITH expired AS (
       UPDATE banking_outbox
       SET status = 'DEAD',
           lock_token = NULL,
           locked_until = NULL,
           last_error = COALESCE(last_error, 'Delivery lease expired after maximum attempts')
       WHERE status = 'IN_PROGRESS'
         AND locked_until <= CURRENT_TIMESTAMP
         AND attempt_count >= $3
       RETURNING id
     ),
     candidates AS (
       SELECT id
       FROM banking_outbox
       WHERE attempt_count < $3
         AND (
           (status = 'PENDING' AND available_at <= CURRENT_TIMESTAMP)
           OR
           (status = 'IN_PROGRESS' AND locked_until <= CURRENT_TIMESTAMP)
         )
       ORDER BY available_at, occurred_at, id
       FOR UPDATE SKIP LOCKED
       LIMIT $1
     )
     UPDATE banking_outbox AS events
     SET status = 'IN_PROGRESS',
         attempt_count = events.attempt_count + 1,
         lock_token = gen_random_uuid(),
         locked_until = CURRENT_TIMESTAMP + ($2::integer * INTERVAL '1 millisecond')
     FROM candidates
     WHERE events.id = candidates.id
     RETURNING events.id,
               events.event_type,
               events.schema_version,
               events.aggregate_type,
               events.aggregate_id,
               events.occurred_at,
               events.payload,
               events.attempt_count,
               events.lock_token`,
    [batchSize, leaseMs, maxAttempts]
  );

  return result.rows.map((row) => ({
    id: row.id,
    event: {
      eventId: row.id,
      eventType: row.event_type,
      schemaVersion: row.schema_version,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      occurredAt: row.occurred_at.toISOString(),
      payload: row.payload,
    },
    attemptCount: row.attempt_count,
    lockToken: row.lock_token,
  }));
}

export async function markOutboxEventPublished(
  eventId: string,
  lockToken: string,
  queueMessageId: string | undefined
): Promise<boolean> {
  const result = await pool.query(
    `UPDATE banking_outbox
     SET status = 'PUBLISHED',
         published_at = CURRENT_TIMESTAMP,
         queue_message_id = $3,
         lock_token = NULL,
         locked_until = NULL,
         last_error = NULL
     WHERE id = $1
       AND status = 'IN_PROGRESS'
       AND lock_token = $2`,
    [eventId, lockToken, queueMessageId ?? null]
  );
  return result.rowCount === 1;
}

export async function recordOutboxPublishFailure(
  eventId: string,
  lockToken: string,
  errorMessage: string,
  retryDelayMs: number,
  maxAttempts: number
): Promise<"PENDING" | "DEAD" | null> {
  const result = await pool.query<{ status: "PENDING" | "DEAD" }>(
    `UPDATE banking_outbox
     SET status = CASE WHEN attempt_count >= $5 THEN 'DEAD' ELSE 'PENDING' END,
         available_at = CASE
           WHEN attempt_count >= $5 THEN available_at
           ELSE CURRENT_TIMESTAMP + ($4::integer * INTERVAL '1 millisecond')
         END,
         lock_token = NULL,
         locked_until = NULL,
         last_error = $3
     WHERE id = $1
       AND status = 'IN_PROGRESS'
       AND lock_token = $2
     RETURNING status`,
    [eventId, lockToken, errorMessage.slice(0, 1000), retryDelayMs, maxAttempts]
  );
  return result.rows[0]?.status ?? null;
}

export async function markOutboxEventDead(
  eventId: string,
  lockToken: string,
  reason: string
): Promise<boolean> {
  const result = await pool.query(
    `UPDATE banking_outbox
     SET status = 'DEAD',
         lock_token = NULL,
         locked_until = NULL,
         last_error = $3
     WHERE id = $1
       AND status = 'IN_PROGRESS'
       AND lock_token = $2`,
    [eventId, lockToken, reason.slice(0, 1000)]
  );
  return result.rowCount === 1;
}

export async function replayDeadOutboxEvent(eventId: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE banking_outbox
     SET status = 'PENDING',
         attempt_count = 0,
         available_at = CURRENT_TIMESTAMP,
         last_error = NULL
     WHERE id = $1
       AND status = 'DEAD'`,
    [eventId]
  );
  return result.rowCount === 1;
}

export function newEventId(): string {
  return randomUUID();
}
