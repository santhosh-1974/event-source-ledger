import { PoolClient } from "pg";

import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { getClient } from "../../database/database";
import {
  AccountClosedError,
  AccountFrozenError,
  BadRequestError,
  ConflictError,
  InsufficientFundsError,
  NotFoundError,
} from "../../errors/errors";
import { executeWithIdempotency, buildRequestHash } from "../idempotency/idempotency.service";
import { findOwnedBeneficiary } from "../beneficiaries/beneficiary.repository";
import { executeBeneficiaryTransfer } from "../banking/banking.service";
import {
  advanceSchedule,
  findExecutionById,
  findForCustomer,
  findOccurrenceForUpdate,
  insertOccurrence,
  insertSchedule,
  listDueScheduleIds,
  listForCustomer,
  listOccurrences,
  ScheduleExecutionRecord,
  ScheduleFrequency,
  ScheduleStatus,
  ScheduledTransferOccurrence,
  ScheduledTransferRecord,
  updateOccurrenceResult,
  updateScheduleStatus,
} from "./scheduled-transfer.repository";
import { CreateScheduledTransferInput } from "./scheduled-transfer.schema";

const CREATE_SCHEDULE_ENDPOINT = "/api/v1/scheduled-transfers";
const RETRY_OCCURRENCE_ENDPOINT =
  "/api/v1/scheduled-transfers/occurrences/retry";
const MAX_MISSED_OCCURRENCES_PER_POLL = 1_000;

function assertAccountIsActive(status: string, label: string): void {
  if (status === "BLOCKED") throw new AccountFrozenError(`${label} is blocked.`);
  if (status === "CLOSED") throw new AccountClosedError(`${label} is closed.`);
}

function nextOccurrence(
  frequency: ScheduleFrequency,
  startAt: Date,
  current: Date
): Date | null {
  if (frequency === "ONCE") return null;
  if (frequency === "WEEKLY") {
    return new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  const next = new Date(current);
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const lastDayOfMonth = new Date(
    Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)
  ).getUTCDate();
  next.setUTCDate(Math.min(startAt.getUTCDate(), lastDayOfMonth));
  next.setUTCHours(
    startAt.getUTCHours(),
    startAt.getUTCMinutes(),
    startAt.getUTCSeconds(),
    startAt.getUTCMilliseconds()
  );
  return next;
}

function isExpectedExecutionFailure(error: unknown): boolean {
  return (
    error instanceof NotFoundError ||
    error instanceof ConflictError ||
    error instanceof InsufficientFundsError ||
    error instanceof AccountFrozenError ||
    error instanceof AccountClosedError
  );
}

function failureCode(error: unknown): string {
  if (error instanceof InsufficientFundsError) return "INSUFFICIENT_FUNDS";
  if (error instanceof AccountFrozenError) return "ACCOUNT_BLOCKED";
  if (error instanceof AccountClosedError) return "ACCOUNT_CLOSED";
  if (error instanceof NotFoundError) return "ACCOUNT_OR_BENEFICIARY_NOT_FOUND";
  if (
    error instanceof ConflictError &&
    error.message === "Beneficiary is disabled."
  ) {
    return "BENEFICIARY_DISABLED";
  }
  return "TRANSFER_CONFLICT";
}

async function validateScheduleInputs(
  input: CreateScheduledTransferInput,
  customerId: string,
  client: PoolClient
): Promise<string> {
  const startsAt = new Date(input.startsAt);
  if (!Number.isFinite(startsAt.getTime()) || startsAt.getTime() <= Date.now()) {
    throw new BadRequestError("Schedule start time must be in the future.");
  }

  const source = await client.query<{ id: string; status: string }>(
    `SELECT id, status
     FROM bank_accounts
     WHERE account_number = $1 AND customer_id = $2
     FOR SHARE`,
    [input.fromAccountNumber, customerId]
  );
  const sourceAccount = source.rows[0];
  if (!sourceAccount) {
    throw new NotFoundError("Source account not found.");
  }
  assertAccountIsActive(sourceAccount.status, "Source account");

  const beneficiary = await findOwnedBeneficiary(
    customerId,
    input.beneficiaryId,
    client,
    true
  );
  if (!beneficiary) {
    throw new NotFoundError("Beneficiary not found.");
  }
  if (beneficiary.status !== "ACTIVE") {
    throw new ConflictError("Beneficiary is disabled.");
  }

  const recipient = await client.query<{ status: string }>(
    `SELECT status
     FROM bank_accounts
     WHERE id = $1
     FOR SHARE`,
    [beneficiary.recipientAccountId]
  );
  if (!recipient.rows[0]) {
    throw new NotFoundError("Recipient account not found.");
  }
  assertAccountIsActive(recipient.rows[0].status, "Recipient account");
  return sourceAccount.id;
}

export async function createScheduledTransfer(
  input: CreateScheduledTransferInput,
  customerId: string,
  idempotencyKey: string
): Promise<ScheduledTransferRecord> {
  const requestHash = buildRequestHash({ customerId, ...input });
  return executeWithIdempotency(
    idempotencyKey,
    requestHash,
    CREATE_SCHEDULE_ENDPOINT,
    async (client) => {
      const sourceAccountId = await validateScheduleInputs(
        input,
        customerId,
        client
      );
      return insertSchedule(
        {
          customerId,
          sourceAccountId,
          beneficiaryId: input.beneficiaryId,
          amount: input.amount,
          description: input.description ?? null,
          frequency: input.frequency,
          startsAt: new Date(input.startsAt),
        },
        client
      );
    }
  );
}

export async function getScheduledTransfers(
  customerId: string
): Promise<ScheduledTransferRecord[]> {
  return listForCustomer(customerId);
}

export async function setScheduledTransferState(
  customerId: string,
  scheduleId: string,
  action: "pause" | "resume" | "cancel"
): Promise<{ id: string; status: ScheduleStatus; nextRunAt: string | null }> {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const schedule = await findForCustomer(
      customerId,
      scheduleId,
      client,
      true
    );
    if (!schedule) throw new NotFoundError("Scheduled transfer not found.");

    const targetStatus: ScheduleStatus =
      action === "pause"
        ? "PAUSED"
        : action === "resume"
          ? "ACTIVE"
          : "CANCELLED";
    if (schedule.status === targetStatus) {
      await client.query("COMMIT");
      return {
        id: schedule.id,
        status: schedule.status,
        nextRunAt: schedule.nextRunAt?.toISOString() ?? null,
      };
    }
    if (
      schedule.status === "CANCELLED" ||
      schedule.status === "COMPLETED"
    ) {
      throw new ConflictError("Completed or cancelled schedules cannot change state.");
    }
    if (action === "pause" && schedule.status !== "ACTIVE") {
      throw new ConflictError("Only active schedules can be paused.");
    }
    if (action === "resume" && schedule.status !== "PAUSED") {
      throw new ConflictError("Only paused schedules can be resumed.");
    }

    await updateScheduleStatus(schedule.id, targetStatus, client);
    await client.query("COMMIT");
    return {
      id: schedule.id,
      status: targetStatus,
      nextRunAt:
        targetStatus === "CANCELLED"
          ? null
          : schedule.nextRunAt?.toISOString() ?? null,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getScheduledTransferOccurrences(
  customerId: string,
  scheduleId: string
): Promise<ScheduledTransferOccurrence[]> {
  const occurrences = await listOccurrences(customerId, scheduleId);
  if (!occurrences) {
    throw new NotFoundError("Scheduled transfer not found.");
  }
  return occurrences;
}

async function executeRetry(
  schedule: ScheduleExecutionRecord,
  occurrence: ScheduledTransferOccurrence,
  client: PoolClient
): Promise<ScheduledTransferOccurrence> {
  try {
    const result = await executeBeneficiaryTransfer(
      {
        fromAccountNumber: schedule.sourceAccountNumber,
        beneficiaryId: schedule.beneficiaryId,
        amount: schedule.amount,
        description: schedule.description ?? undefined,
      },
      schedule.customerId,
      client
    );
    return updateOccurrenceResult(
      occurrence.id,
      "SUCCEEDED",
      occurrence.attemptCount + 1,
      result.transactionId,
      null,
      client
    );
  } catch (error) {
    if (!isExpectedExecutionFailure(error)) throw error;
    return updateOccurrenceResult(
      occurrence.id,
      "FAILED",
      occurrence.attemptCount + 1,
      null,
      failureCode(error),
      client
    );
  }
}

export async function retryScheduledTransferOccurrence(
  customerId: string,
  scheduleId: string,
  occurrenceId: string,
  idempotencyKey: string
): Promise<ScheduledTransferOccurrence> {
  const requestHash = buildRequestHash({
    customerId,
    scheduleId,
    occurrenceId,
  });
  return executeWithIdempotency(
    idempotencyKey,
    requestHash,
    RETRY_OCCURRENCE_ENDPOINT,
    async (client) => {
      const schedule = await findForCustomer(
        customerId,
        scheduleId,
        client,
        true
      );
      if (!schedule) {
        throw new NotFoundError("Scheduled transfer not found.");
      }
      const occurrence = await findOccurrenceForUpdate(
        scheduleId,
        occurrenceId,
        client
      );
      if (!occurrence) {
        throw new NotFoundError("Scheduled transfer occurrence not found.");
      }
      if (occurrence.status !== "FAILED") {
        throw new ConflictError("Only failed occurrences can be retried.");
      }
      return executeRetry(schedule, occurrence, client);
    }
  );
}

async function processOneSchedule(
  scheduleId: string,
  now: Date,
  graceMilliseconds: number
): Promise<{ succeeded: number; failed: number; skipped: number }> {
  const client = await getClient();
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  try {
    await client.query("BEGIN");
    const schedule = await findExecutionById(scheduleId, client, true);
    if (
      !schedule ||
      schedule.status !== "ACTIVE" ||
      !schedule.nextRunAt ||
      schedule.nextRunAt > now
    ) {
      await client.query("COMMIT");
      return { succeeded, failed, skipped };
    }

    let scheduledFor = schedule.nextRunAt;
    let missedCount = 0;
    while (scheduledFor <= now) {
      if (now.getTime() - scheduledFor.getTime() > graceMilliseconds) {
        missedCount += 1;
        if (missedCount > MAX_MISSED_OCCURRENCES_PER_POLL) {
          throw new Error("Too many missed schedule occurrences to process safely");
        }
        await insertOccurrence(
          schedule.id,
          scheduledFor,
          "SKIPPED",
          { errorCode: "MISSED_SCHEDULE" },
          client
        );
        skipped += 1;
        const nextRunAt = nextOccurrence(
          schedule.frequency,
          schedule.startsAt,
          scheduledFor
        );
        if (!nextRunAt) {
          await advanceSchedule(schedule.id, null, "COMPLETED", client);
          break;
        }
        await advanceSchedule(schedule.id, nextRunAt, "ACTIVE", client);
        scheduledFor = nextRunAt;
        continue;
      }

      try {
        const result = await executeBeneficiaryTransfer(
          {
            fromAccountNumber: schedule.sourceAccountNumber,
            beneficiaryId: schedule.beneficiaryId,
            amount: schedule.amount,
            description: schedule.description ?? undefined,
          },
          schedule.customerId,
          client
        );
        await insertOccurrence(
          schedule.id,
          scheduledFor,
          "SUCCEEDED",
          {
            attemptCount: 1,
            transactionId: result.transactionId,
            attemptedAt: now,
          },
          client
        );
        succeeded += 1;
      } catch (error) {
        if (!isExpectedExecutionFailure(error)) throw error;
        await insertOccurrence(
          schedule.id,
          scheduledFor,
          "FAILED",
          {
            attemptCount: 1,
            errorCode: failureCode(error),
            attemptedAt: now,
          },
          client
        );
        failed += 1;
      }

      const nextRunAt = nextOccurrence(
        schedule.frequency,
        schedule.startsAt,
        scheduledFor
      );
      await advanceSchedule(
        schedule.id,
        nextRunAt,
        nextRunAt ? "ACTIVE" : "COMPLETED",
        client
      );
      break;
    }

    await client.query("COMMIT");
    return { succeeded, failed, skipped };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function processDueScheduledTransfers(
  now = new Date(),
  options: { batchSize?: number; misfireGraceSeconds?: number } = {}
): Promise<{ succeeded: number; failed: number; skipped: number }> {
  const scheduleIds = await listDueScheduleIds(
    now,
    options.batchSize ?? env.SCHEDULED_TRANSFER_BATCH_SIZE
  );
  const totals = { succeeded: 0, failed: 0, skipped: 0 };
  const graceMilliseconds =
    (options.misfireGraceSeconds ??
      env.SCHEDULED_TRANSFER_MISFIRE_GRACE_SECONDS) *
    1000;

  for (const scheduleId of scheduleIds) {
    try {
      const result = await processOneSchedule(
        scheduleId,
        now,
        graceMilliseconds
      );
      totals.succeeded += result.succeeded;
      totals.failed += result.failed;
      totals.skipped += result.skipped;
    } catch (error) {
      logger.error(
        { err: error, scheduleId },
        "Scheduled transfer schedule processing failed"
      );
    }
  }
  return totals;
}

