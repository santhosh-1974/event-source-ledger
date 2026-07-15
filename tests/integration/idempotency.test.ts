import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import app from "../helpers/app";
import { resetDatabase } from "../helpers/database";
import { query } from "../../src/database/database";

const CUSTOMER_URL = "/api/v1/customers/create-customer";
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
  const response = await request(app)
    .post(CUSTOMER_URL)
    .send({ name, email, phone });

  expect(response.status).toBe(201);

  return response.body.data as { id: string };
}

async function createAccount(
  customerId: string,
  accountNumber: string
): Promise<AccountResponse> {
  const response = await request(app)
    .post(ACCOUNT_URL)
    .send({ customerId, accountNumber, accountType: "SAVINGS" });

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
