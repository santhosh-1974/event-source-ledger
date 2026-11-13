import { requestAsTestUser as request } from "../helpers/auth";
import { currentTestCustomerId, registerTestUser } from "../helpers/auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import app from "../helpers/app";
import { resetDatabase } from "../helpers/database";
import { query } from "../../src/database/database";
import { processBankingEvent } from "../../src/modules/outbox/outbox.consumer";
import {
  claimOutboxEvents,
  replayDeadOutboxEvent,
} from "../../src/modules/outbox/outbox.repository";

const ACCOUNT_URL = "/api/v1/accounts";
const DEPOSIT_URL = "/api/v1/banking/deposit";
const WITHDRAW_URL = "/api/v1/banking/withdraw";
const TRANSFER_URL = "/api/v1/banking/transfer";

interface AccountResponse {
  id: string;
  accountNumber: string;
}

interface IdempotencyRecord {
  idempotency_key: string;
  request_hash: string;
  endpoint: string;
  status: "IN_PROGRESS" | "COMPLETED" | "FAILED";
  response: { transactionId: string; reference: string } | null;
  expires_at: Date;
}

beforeEach(async () => {
  await resetDatabase();
});

afterEach(async () => {
  await query("DROP TRIGGER IF EXISTS fail_idempotency_credit_trigger ON ledger_entries;");
  await query("DROP FUNCTION IF EXISTS fail_idempotency_credit();");
});

async function createCustomer(name: string, email: string, phone: string) {
  const user = await registerTestUser(app, { name, email, phone });
  return user.customer;
}

async function createAccount(
  customerId: string,
  accountNumber: string
): Promise<AccountResponse> {
  const response = await request(app)
    .post(ACCOUNT_URL)
    .send({ customerId: currentTestCustomerId(), accountNumber, accountType: "SAVINGS" });

  expect(response.status).toBe(201);

  return response.body.data as AccountResponse;
}

async function createAccounts(): Promise<{ sender: AccountResponse; receiver: AccountResponse }> {
  const senderCustomer = await createCustomer(
    "Santhosh",
    "santhosh@gmail.com",
    "9876543210"
  );
  const sender = await createAccount(senderCustomer.id, "1000000001");
  const receiverCustomer = await createCustomer(
    "Priya",
    "priya@gmail.com",
    "9876543211"
  );
  const receiver = await createAccount(receiverCustomer.id, "1000000002");

  return { sender, receiver };
}

async function createFundedAccounts() {
  const accounts = await createAccounts();
  const response = await request(app)
    .post(DEPOSIT_URL)
    .set("Idempotency-Key", crypto.randomUUID())
    .send({ accountNumber: accounts.sender.accountNumber, amount: "1000.00" });

  expect(response.status).toBe(201);

  return accounts;
}

async function findIdempotencyRecord(key: string): Promise<IdempotencyRecord | null> {
  const result = await query<IdempotencyRecord>(
    `
    SELECT idempotency_key, request_hash, endpoint, status, response, expires_at
    FROM idempotency_keys
    WHERE idempotency_key = $1;
    `,
    [key]
  );

  return result.rows[0] ?? null;
}

async function transactionCount(): Promise<number> {
  const result = await query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM transactions"
  );

  return Number(result.rows[0].count);
}

async function ledgerEntryCount(): Promise<number> {
  const result = await query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM ledger_entries"
  );

  return Number(result.rows[0].count);
}

async function outboxEventCount(): Promise<number> {
  const result = await query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM banking_outbox"
  );

  return Number(result.rows[0].count);
}

describe("Idempotency API", () => {
  it("should complete and store the first deposit request", async () => {
    const { sender } = await createAccounts();
    const key = crypto.randomUUID();

    const response = await request(app)
      .post(DEPOSIT_URL)
      .set("Idempotency-Key", key)
      .send({ accountNumber: sender.accountNumber, amount: "500.00" });
    const record = await findIdempotencyRecord(key);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(record).toMatchObject({
      idempotency_key: key,
      endpoint: DEPOSIT_URL,
      status: "COMPLETED",
      response: response.body.data,
    });
    expect(record?.request_hash).toHaveLength(64);
    expect(record?.expires_at.getTime()).toBeGreaterThan(Date.now());
    expect(await transactionCount()).toBe(1);
    expect(await ledgerEntryCount()).toBe(2);
    expect(await outboxEventCount()).toBe(1);
  });

  it("should replay a duplicate deposit without creating new records", async () => {
    const { sender } = await createAccounts();
    const key = crypto.randomUUID();
    const payload = { accountNumber: sender.accountNumber, amount: "500.00" };

    const first = await request(app).post(DEPOSIT_URL).set("Idempotency-Key", key).send(payload);
    const second = await request(app).post(DEPOSIT_URL).set("Idempotency-Key", key).send(payload);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body).toEqual(first.body);
    expect(await transactionCount()).toBe(1);
    expect(await ledgerEntryCount()).toBe(2);
    expect(await outboxEventCount()).toBe(1);
  });

  it("normalizes whole-number amounts in emitted events", async () => {
    const { sender } = await createAccounts();
    const response = await request(app)
      .post(DEPOSIT_URL)
      .set("Idempotency-Key", crypto.randomUUID())
      .send({ accountNumber: sender.accountNumber, amount: "12" });
    const event = await query<{ payload: { amount: string } }>(
      "SELECT payload FROM banking_outbox"
    );

    expect(response.status).toBe(201);
    expect(event.rows[0].payload.amount).toBe("12.00");
  });

  it("deduplicates consumer effects by consumer name and event ID", async () => {
    const { sender } = await createAccounts();
    const response = await request(app)
      .post(DEPOSIT_URL)
      .set("Idempotency-Key", crypto.randomUUID())
      .send({ accountNumber: sender.accountNumber, amount: "12.00" });
    const stored = await query<{
      id: string;
      event_type: string;
      schema_version: number;
      aggregate_type: string;
      aggregate_id: string;
      occurred_at: Date;
      payload: unknown;
    }>(
      `SELECT id, event_type, schema_version, aggregate_type, aggregate_id,
              occurred_at, payload
       FROM banking_outbox`
    );
    const row = stored.rows[0];
    const event = {
      eventId: row.id,
      eventType: row.event_type,
      schemaVersion: row.schema_version,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      occurredAt: row.occurred_at.toISOString(),
      payload: row.payload,
    };
    const handler = vi.fn(async () => undefined);

    expect(response.status).toBe(201);
    await expect(
      processBankingEvent("test-consumer", event, handler)
    ).resolves.toBe(true);
    await expect(
      processBankingEvent("test-consumer", event, handler)
    ).resolves.toBe(false);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("rolls back inbox deduplication when a consumer handler fails", async () => {
    const { sender } = await createAccounts();
    await request(app)
      .post(DEPOSIT_URL)
      .set("Idempotency-Key", crypto.randomUUID())
      .send({ accountNumber: sender.accountNumber, amount: "12.00" });
    const stored = await query<{
      id: string;
      event_type: string;
      schema_version: number;
      aggregate_type: string;
      aggregate_id: string;
      occurred_at: Date;
      payload: unknown;
    }>(
      `SELECT id, event_type, schema_version, aggregate_type, aggregate_id,
              occurred_at, payload
       FROM banking_outbox`
    );
    const row = stored.rows[0];
    const event = {
      eventId: row.id,
      eventType: row.event_type,
      schemaVersion: row.schema_version,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      occurredAt: row.occurred_at.toISOString(),
      payload: row.payload,
    };
    const failedHandler = vi.fn(async () => {
      throw new Error("consumer failed");
    });

    await expect(
      processBankingEvent("retrying-consumer", event, failedHandler)
    ).rejects.toThrow("consumer failed");

    const retryHandler = vi.fn(async () => undefined);
    await expect(
      processBankingEvent("retrying-consumer", event, retryHandler)
    ).resolves.toBe(true);
    expect(retryHandler).toHaveBeenCalledTimes(1);
  });

  it("reclaims an expired publisher lease with a new token", async () => {
    const { sender } = await createAccounts();
    await request(app)
      .post(DEPOSIT_URL)
      .set("Idempotency-Key", crypto.randomUUID())
      .send({ accountNumber: sender.accountNumber, amount: "12.00" });

    const firstClaim = await claimOutboxEvents(1, 60_000, 8);
    await query(
      "UPDATE banking_outbox SET locked_until = NOW() - INTERVAL '1 second' WHERE id = $1",
      [firstClaim[0].id]
    );
    const secondClaim = await claimOutboxEvents(1, 60_000, 8);

    expect(firstClaim).toHaveLength(1);
    expect(secondClaim).toHaveLength(1);
    expect(secondClaim[0].attemptCount).toBe(2);
    expect(secondClaim[0].lockToken).not.toBe(firstClaim[0].lockToken);
  });

  it("moves a lease to DEAD after it expires at the maximum attempt count", async () => {
    const { sender } = await createAccounts();
    await request(app)
      .post(DEPOSIT_URL)
      .set("Idempotency-Key", crypto.randomUUID())
      .send({ accountNumber: sender.accountNumber, amount: "12.00" });
    await query(
      `UPDATE banking_outbox
       SET status = 'IN_PROGRESS', attempt_count = 8, lock_token = gen_random_uuid(),
           locked_until = NOW() - INTERVAL '1 second'
       WHERE status = 'PENDING'`
    );

    await expect(claimOutboxEvents(1, 60_000, 8)).resolves.toHaveLength(0);
    const status = await query<{ status: string }>(
      "SELECT status FROM banking_outbox"
    );

    expect(status.rows[0].status).toBe("DEAD");
  });

  it("replays a dead event without changing its stable event ID or payload", async () => {
    const { sender } = await createAccounts();
    await request(app)
      .post(DEPOSIT_URL)
      .set("Idempotency-Key", crypto.randomUUID())
      .send({ accountNumber: sender.accountNumber, amount: "12.00" });
    const event = await query<{ id: string; payload: unknown }>(
      "SELECT id, payload FROM banking_outbox"
    );
    await query(
      "UPDATE banking_outbox SET status = 'DEAD', attempt_count = 8 WHERE id = $1",
      [event.rows[0].id]
    );

    await expect(replayDeadOutboxEvent(event.rows[0].id)).resolves.toBe(true);
    const replayed = await query<{
      id: string;
      payload: unknown;
      status: string;
      attempt_count: number;
    }>(
      "SELECT id, payload, status, attempt_count FROM banking_outbox"
    );

    expect(replayed.rows[0]).toMatchObject({
      id: event.rows[0].id,
      payload: event.rows[0].payload,
      status: "PENDING",
      attempt_count: 0,
    });
  });

  it("should replay a duplicate transfer without executing the service again", async () => {
    const { sender, receiver } = await createFundedAccounts();
    const key = crypto.randomUUID();
    const payload = {
      fromAccountNumber: sender.accountNumber,
      toAccountNumber: receiver.accountNumber,
      amount: "200.00",
    };

    const first = await request(app).post(TRANSFER_URL).set("Idempotency-Key", key).send(payload);
    const second = await request(app).post(TRANSFER_URL).set("Idempotency-Key", key).send(payload);

    expect(first.status).toBe(201);
    expect(second.body).toEqual(first.body);
    expect(await transactionCount()).toBe(2);
    expect(await ledgerEntryCount()).toBe(6);
    expect(await outboxEventCount()).toBe(2);
  });

  it("should reject a key reused with a different request hash", async () => {
    const { sender } = await createFundedAccounts();
    const key = crypto.randomUUID();

    const first = await request(app)
      .post(WITHDRAW_URL)
      .set("Idempotency-Key", key)
      .send({ accountNumber: sender.accountNumber, amount: "200.00" });
    const second = await request(app)
      .post(WITHDRAW_URL)
      .set("Idempotency-Key", key)
      .send({ accountNumber: sender.accountNumber, amount: "100.00" });

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    expect(second.body.message).toBe("Request Hash Mismatch");
    expect(await transactionCount()).toBe(2);
    expect(await ledgerEntryCount()).toBe(4);
    expect(await outboxEventCount()).toBe(2);
  });

  it("should reject a request without an idempotency key", async () => {
    const { sender } = await createAccounts();

    const response = await request(app)
      .post(DEPOSIT_URL)
      .send({ accountNumber: sender.accountNumber, amount: "500.00" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Missing Idempotency-Key");
    expect(await transactionCount()).toBe(0);
    expect(await ledgerEntryCount()).toBe(0);
  });

  it("should treat an expired key as a new request", async () => {
    const { sender } = await createAccounts();
    const key = crypto.randomUUID();
    const payload = { accountNumber: sender.accountNumber, amount: "500.00" };
    const first = await request(app).post(DEPOSIT_URL).set("Idempotency-Key", key).send(payload);
    await query("UPDATE idempotency_keys SET expires_at = NOW() - INTERVAL '1 second' WHERE idempotency_key = $1", [key]);

    const second = await request(app).post(DEPOSIT_URL).set("Idempotency-Key", key).send(payload);
    const record = await findIdempotencyRecord(key);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.data.transactionId).not.toBe(first.body.data.transactionId);
    expect(record?.status).toBe("COMPLETED");
    expect(await transactionCount()).toBe(2);
    expect(await ledgerEntryCount()).toBe(4);
  });

  it("should persist a failed request and execute it successfully on retry", async () => {
    const { sender } = await createFundedAccounts();
    const key = crypto.randomUUID();
    const payload = { accountNumber: sender.accountNumber, amount: "200.00" };
    await query(`
      CREATE FUNCTION fail_idempotency_credit()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        IF NEW.entry_type = 'CREDIT' THEN
          RAISE EXCEPTION 'forced ledger failure';
        END IF;
        RETURN NEW;
      END;
      $$;
    `);
    await query(`
      CREATE TRIGGER fail_idempotency_credit_trigger
      BEFORE INSERT ON ledger_entries
      FOR EACH ROW
      EXECUTE FUNCTION fail_idempotency_credit();
    `);

    const failed = await request(app).post(WITHDRAW_URL).set("Idempotency-Key", key).send(payload);
    const failedRecord = await findIdempotencyRecord(key);
    await query("DROP TRIGGER fail_idempotency_credit_trigger ON ledger_entries;");
    await query("DROP FUNCTION fail_idempotency_credit();");

    const retried = await request(app).post(WITHDRAW_URL).set("Idempotency-Key", key).send(payload);
    const completedRecord = await findIdempotencyRecord(key);

    expect(failed.status).toBe(500);
    expect(failedRecord).toMatchObject({ status: "FAILED", response: null, endpoint: WITHDRAW_URL });
    expect(await transactionCount()).toBe(2);
    expect(await ledgerEntryCount()).toBe(4);
    expect(retried.status).toBe(201);
    expect(completedRecord).toMatchObject({ status: "COMPLETED", response: retried.body.data });
  });

  it("should process concurrent duplicate requests exactly once", async () => {
    const { sender } = await createAccounts();
    const key = crypto.randomUUID();
    const payload = { accountNumber: sender.accountNumber, amount: "500.00" };

    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app).post(DEPOSIT_URL).set("Idempotency-Key", key).send(payload)
      )
    );

    expect(responses.every((response) => response.status === 201)).toBe(true);
    for (const response of responses) {
      expect(response.body).toEqual(responses[0].body);
    }
    expect(await transactionCount()).toBe(1);
    expect(await ledgerEntryCount()).toBe(2);
  });

  it("should hash and persist a maximum-length transfer description", async () => {
    const { sender, receiver } = await createFundedAccounts();
    const key = crypto.randomUUID();
    const payload = {
      fromAccountNumber: sender.accountNumber,
      toAccountNumber: receiver.accountNumber,
      amount: "1.00",
      description: "x".repeat(255),
    };

    const response = await request(app).post(TRANSFER_URL).set("Idempotency-Key", key).send(payload);
    const record = await findIdempotencyRecord(key);

    expect(response.status).toBe(201);
    expect(record?.status).toBe("COMPLETED");
    expect(record?.request_hash).toHaveLength(64);
    expect(await transactionCount()).toBe(2);
    expect(await ledgerEntryCount()).toBe(6);
  });

  it("should not create an idempotency record for an unknown endpoint", async () => {
    const key = crypto.randomUUID();

    const response = await request(app)
      .post("/api/v1/banking/unknown")
      .set("Idempotency-Key", key)
      .send({ amount: "500.00" });

    expect(response.status).toBe(404);
    expect(await findIdempotencyRecord(key)).toBeNull();
  });
});
