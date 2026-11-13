import { PoolClient } from "pg";

import { pool } from "../../database/database";

export type ScheduleFrequency = "ONCE" | "WEEKLY" | "MONTHLY";
export type ScheduleStatus = "ACTIVE" | "PAUSED" | "CANCELLED" | "COMPLETED";
export type OccurrenceStatus = "SUCCEEDED" | "FAILED" | "SKIPPED";

export interface ScheduledTransferRecord {
  id: string;
  sourceAccountNumber: string;
  beneficiaryId: string;
  beneficiaryName: string;
  beneficiaryAccountNumberMasked: string;
  amount: string;
  description: string | null;
  frequency: ScheduleFrequency;
  startsAt: string;
  nextRunAt: string | null;
  status: ScheduleStatus;
  createdAt: string;
}

export interface ScheduledTransferOccurrence {
  id: string;
  scheduledFor: string;
  status: OccurrenceStatus;
  attemptCount: number;
  transactionId: string | null;
  errorCode: string | null;
  attemptedAt: string | null;
  completedAt: string;
}

export interface ScheduleExecutionRecord {
  id: string;
  customerId: string;
  sourceAccountId: string;
  sourceAccountNumber: string;
  beneficiaryId: string;
  amount: string;
  description: string | null;
  frequency: ScheduleFrequency;
  startsAt: Date;
  nextRunAt: Date | null;
  status: ScheduleStatus;
}

interface ScheduleRow {
  id: string;
  customer_id: string;
  source_account_id: string;
  source_account_number: string;
  beneficiary_id: string;
  beneficiary_name: string;
  beneficiary_account_number: string;
  amount: string;
  description: string | null;
  frequency: ScheduleFrequency;
  start_at: Date;
  next_run_at: Date | null;
  status: ScheduleStatus;
  created_at: Date;
}

function mapSchedule(row: ScheduleRow): ScheduledTransferRecord {
  return {
    id: row.id,
    sourceAccountNumber: row.source_account_number,
    beneficiaryId: row.beneficiary_id,
    beneficiaryName: row.beneficiary_name,
    beneficiaryAccountNumberMasked: `****${row.beneficiary_account_number.slice(-4)}`,
    amount: row.amount,
    description: row.description,
    frequency: row.frequency,
    startsAt: row.start_at.toISOString(),
    nextRunAt: row.next_run_at?.toISOString() ?? null,
    status: row.status,
    createdAt: row.created_at.toISOString(),
  };
}

const scheduleSelect = `SELECT schedule.id, schedule.customer_id,
  schedule.source_account_id, source.account_number AS source_account_number,
  schedule.beneficiary_id, beneficiary.display_name AS beneficiary_name,
  recipient.account_number AS beneficiary_account_number,
  schedule.amount::text, schedule.description, schedule.frequency,
  schedule.start_at, schedule.next_run_at, schedule.status, schedule.created_at
FROM scheduled_transfers AS schedule
INNER JOIN bank_accounts AS source ON source.id = schedule.source_account_id
INNER JOIN banking_beneficiaries AS beneficiary
  ON beneficiary.id = schedule.beneficiary_id
INNER JOIN bank_accounts AS recipient
  ON recipient.id = beneficiary.recipient_account_id`;

export async function insertSchedule(
  input: {
    customerId: string;
    sourceAccountId: string;
    beneficiaryId: string;
    amount: string;
    description: string | null;
    frequency: ScheduleFrequency;
    startsAt: Date;
  },
  client: PoolClient
): Promise<ScheduledTransferRecord> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO scheduled_transfers (
       customer_id, source_account_id, beneficiary_id, amount,
       description, frequency, start_at, next_run_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
     RETURNING id`,
    [
      input.customerId,
      input.sourceAccountId,
      input.beneficiaryId,
      input.amount,
      input.description,
      input.frequency,
      input.startsAt,
    ]
  );
  const schedule = await findRecordForCustomer(
    input.customerId,
    result.rows[0].id,
    client
  );
  if (!schedule) {
    throw new Error("Created scheduled transfer could not be read");
  }
  return schedule;
}

export async function listForCustomer(
  customerId: string
): Promise<ScheduledTransferRecord[]> {
  const result = await pool.query<ScheduleRow>(
    `${scheduleSelect}
     WHERE schedule.customer_id = $1
     ORDER BY schedule.created_at DESC, schedule.id`,
    [customerId]
  );
  return result.rows.map(mapSchedule);
}

export async function findForCustomer(
  customerId: string,
  scheduleId: string,
  client: PoolClient,
  lock = false
): Promise<ScheduleExecutionRecord | null> {
  const result = await client.query<{
    id: string;
    customer_id: string;
    source_account_id: string;
    source_account_number: string;
    beneficiary_id: string;
    amount: string;
    description: string | null;
    frequency: ScheduleFrequency;
    start_at: Date;
    next_run_at: Date | null;
    status: ScheduleStatus;
  }>(
    `SELECT schedule.id, schedule.customer_id, schedule.source_account_id,
            source.account_number AS source_account_number,
            schedule.beneficiary_id, schedule.amount::text,
            schedule.description, schedule.frequency, schedule.start_at,
            schedule.next_run_at, schedule.status
     FROM scheduled_transfers AS schedule
     INNER JOIN bank_accounts AS source ON source.id = schedule.source_account_id
     WHERE schedule.id = $1 AND schedule.customer_id = $2
     ${lock ? "FOR UPDATE OF schedule" : ""}`,
    [scheduleId, customerId]
  );
  const row = result.rows[0];
  return row
    ? {
        id: row.id,
        customerId: row.customer_id,
        sourceAccountId: row.source_account_id,
        sourceAccountNumber: row.source_account_number,
        beneficiaryId: row.beneficiary_id,
        amount: row.amount,
        description: row.description,
        frequency: row.frequency,
        startsAt: row.start_at,
        nextRunAt: row.next_run_at,
        status: row.status,
      }
    : null;
}

async function findRecordForCustomer(
  customerId: string,
  scheduleId: string,
  client: PoolClient
): Promise<ScheduledTransferRecord | null> {
  const result = await client.query<ScheduleRow>(
    `${scheduleSelect}
     WHERE schedule.id = $1 AND schedule.customer_id = $2`,
    [scheduleId, customerId]
  );
  return result.rows[0] ? mapSchedule(result.rows[0]) : null;
}

export async function findExecutionById(
  scheduleId: string,
  client: PoolClient,
  lock = false
): Promise<ScheduleExecutionRecord | null> {
  const result = await client.query<{
    id: string;
    customer_id: string;
    source_account_id: string;
    source_account_number: string;
    beneficiary_id: string;
    amount: string;
    description: string | null;
    frequency: ScheduleFrequency;
    start_at: Date;
    next_run_at: Date | null;
    status: ScheduleStatus;
  }>(
    `SELECT schedule.id, schedule.customer_id, schedule.source_account_id,
            source.account_number AS source_account_number,
            schedule.beneficiary_id, schedule.amount::text,
            schedule.description, schedule.frequency, schedule.start_at,
            schedule.next_run_at, schedule.status
     FROM scheduled_transfers AS schedule
     INNER JOIN bank_accounts AS source ON source.id = schedule.source_account_id
     WHERE schedule.id = $1
     ${lock ? "FOR UPDATE OF schedule" : ""}`,
    [scheduleId]
  );
  const row = result.rows[0];
  return row
    ? {
        id: row.id,
        customerId: row.customer_id,
        sourceAccountId: row.source_account_id,
        sourceAccountNumber: row.source_account_number,
        beneficiaryId: row.beneficiary_id,
        amount: row.amount,
        description: row.description,
        frequency: row.frequency,
        startsAt: row.start_at,
        nextRunAt: row.next_run_at,
        status: row.status,
      }
    : null;
}

export async function updateScheduleStatus(
  scheduleId: string,
  status: ScheduleStatus,
  client: PoolClient
): Promise<void> {
  await client.query(
    `UPDATE scheduled_transfers
     SET status = $2,
         next_run_at = CASE WHEN $3
                            THEN NULL ELSE next_run_at END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [scheduleId, status, status === "CANCELLED" || status === "COMPLETED"]
  );
}

export async function advanceSchedule(
  scheduleId: string,
  nextRunAt: Date | null,
  status: ScheduleStatus,
  client: PoolClient
): Promise<void> {
  await client.query(
    `UPDATE scheduled_transfers
     SET next_run_at = $2, status = $3, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [scheduleId, nextRunAt, status]
  );
}

export async function listDueScheduleIds(
  now: Date,
  batchSize: number
): Promise<string[]> {
  const result = await pool.query<{ id: string }>(
    `SELECT id
     FROM scheduled_transfers
     WHERE status = 'ACTIVE' AND next_run_at <= $1
     ORDER BY next_run_at, id
     LIMIT $2`,
    [now, batchSize]
  );
  return result.rows.map((row) => row.id);
}

export async function insertOccurrence(
  scheduleId: string,
  scheduledFor: Date,
  status: OccurrenceStatus,
  options: {
    attemptCount?: number;
    transactionId?: string | null;
    errorCode?: string | null;
    attemptedAt?: Date | null;
  },
  client: PoolClient
): Promise<ScheduledTransferOccurrence> {
  const result = await client.query<{
    id: string;
    scheduled_for: Date;
    status: OccurrenceStatus;
    attempt_count: number;
    transaction_id: string | null;
    error_code: string | null;
    attempted_at: Date | null;
    completed_at: Date;
  }>(
    `INSERT INTO scheduled_transfer_occurrences (
       schedule_id, scheduled_for, status, attempt_count,
       transaction_id, error_code, attempted_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, scheduled_for, status, attempt_count,
       transaction_id, error_code, attempted_at, completed_at`,
    [
      scheduleId,
      scheduledFor,
      status,
      options.attemptCount ?? 0,
      options.transactionId ?? null,
      options.errorCode ?? null,
      options.attemptedAt ?? null,
    ]
  );
  return mapOccurrence(result.rows[0]);
}

function mapOccurrence(row: {
  id: string;
  scheduled_for: Date;
  status: OccurrenceStatus;
  attempt_count: number;
  transaction_id: string | null;
  error_code: string | null;
  attempted_at: Date | null;
  completed_at: Date;
}): ScheduledTransferOccurrence {
  return {
    id: row.id,
    scheduledFor: row.scheduled_for.toISOString(),
    status: row.status,
    attemptCount: row.attempt_count,
    transactionId: row.transaction_id,
    errorCode: row.error_code,
    attemptedAt: row.attempted_at?.toISOString() ?? null,
    completedAt: row.completed_at.toISOString(),
  };
}

export async function findOccurrenceForUpdate(
  scheduleId: string,
  occurrenceId: string,
  client: PoolClient
): Promise<ScheduledTransferOccurrence | null> {
  const result = await client.query<{
    id: string;
    scheduled_for: Date;
    status: OccurrenceStatus;
    attempt_count: number;
    transaction_id: string | null;
    error_code: string | null;
    attempted_at: Date | null;
    completed_at: Date;
  }>(
    `SELECT id, scheduled_for, status, attempt_count,
            transaction_id, error_code, attempted_at, completed_at
     FROM scheduled_transfer_occurrences
     WHERE id = $1 AND schedule_id = $2
     FOR UPDATE`,
    [occurrenceId, scheduleId]
  );
  return result.rows[0] ? mapOccurrence(result.rows[0]) : null;
}

export async function updateOccurrenceResult(
  occurrenceId: string,
  status: "SUCCEEDED" | "FAILED",
  attemptCount: number,
  transactionId: string | null,
  errorCode: string | null,
  client: PoolClient
): Promise<ScheduledTransferOccurrence> {
  const result = await client.query<{
    id: string;
    scheduled_for: Date;
    status: OccurrenceStatus;
    attempt_count: number;
    transaction_id: string | null;
    error_code: string | null;
    attempted_at: Date | null;
    completed_at: Date;
  }>(
    `UPDATE scheduled_transfer_occurrences
     SET status = $2, attempt_count = $3, transaction_id = $4,
         error_code = $5, attempted_at = CURRENT_TIMESTAMP,
         completed_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING id, scheduled_for, status, attempt_count,
       transaction_id, error_code, attempted_at, completed_at`,
    [occurrenceId, status, attemptCount, transactionId, errorCode]
  );
  return mapOccurrence(result.rows[0]);
}

export async function listOccurrences(
  customerId: string,
  scheduleId: string
): Promise<ScheduledTransferOccurrence[] | null> {
  const result = await pool.query<{
    id: string;
    scheduled_for: Date;
    status: OccurrenceStatus;
    attempt_count: number;
    transaction_id: string | null;
    error_code: string | null;
    attempted_at: Date | null;
    completed_at: Date;
  }>(
    `SELECT occurrence.id, occurrence.scheduled_for, occurrence.status,
            occurrence.attempt_count, occurrence.transaction_id,
            occurrence.error_code, occurrence.attempted_at,
            occurrence.completed_at
     FROM scheduled_transfers AS schedule
     LEFT JOIN scheduled_transfer_occurrences AS occurrence
       ON occurrence.schedule_id = schedule.id
     WHERE schedule.id = $1 AND schedule.customer_id = $2
     ORDER BY occurrence.scheduled_for DESC NULLS LAST
     LIMIT 500`,
    [scheduleId, customerId]
  );
  if (result.rowCount === 0) return null;
  return result.rows
    .filter((row) => row.id !== null)
    .map(mapOccurrence);
}
