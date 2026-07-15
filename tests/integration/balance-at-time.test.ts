import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

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

interface Timeline {
  account: AccountResponse;
  t1: string;
  t2: string;
  t3: string;
}

beforeEach(async () => {
  await resetDatabase();
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

async function createCustomerAccount(
  accountNumber = "1000000001",
  suffix = "1"
): Promise<AccountResponse> {
  const customer = await createCustomer(
    `Customer ${suffix}`,
    `customer${suffix}@gmail.com`,
    `987654321${suffix}`
  );

  return createAccount(customer.id, accountNumber);
}

async function deposit(accountNumber: string, amount: string) {
  return request(app)
    .post(DEPOSIT_URL)
    .set("Idempotency-Key", crypto.randomUUID())
    .send({ accountNumber, amount });
}

async function withdraw(accountNumber: string, amount: string) {
  return request(app)
    .post(WITHDRAW_URL)
    .set("Idempotency-Key", crypto.randomUUID())
    .send({ accountNumber, amount });
}

async function transfer(fromAccountNumber: string, toAccountNumber: string, amount: string) {
  return request(app)
    .post(TRANSFER_URL)
    .set("Idempotency-Key", crypto.randomUUID())
    .send({ fromAccountNumber, toAccountNumber, amount });
}

async function latestLedgerTimestamp(accountNumber: string): Promise<string> {
  const result = await query<{ created_at: Date }>(
    `
    SELECT MAX(le.created_at) AS created_at
    FROM bank_accounts ba
    INNER JOIN ledger_accounts la ON la.bank_account_id = ba.id
    INNER JOIN ledger_entries le ON le.ledger_account_id = la.id
    WHERE ba.account_number = $1;
    `,
    [accountNumber]
  );

  return new Date(result.rows[0].created_at.getTime() + 1).toISOString();
}

async function getLedgerBalanceAt(accountNumber: string, at: string): Promise<string> {
  const result = await query<{ balance: string }>(
    `
    SELECT COALESCE(
      SUM(CASE WHEN le.entry_type = 'CREDIT' THEN le.amount ELSE -le.amount END),
      0
    )::numeric(18,2)::text AS balance
    FROM bank_accounts ba
    INNER JOIN ledger_accounts la ON la.bank_account_id = ba.id
    LEFT JOIN ledger_entries le
      ON le.ledger_account_id = la.id
      AND le.created_at <= $2::timestamptz
    WHERE ba.account_number = $1;
    `,
    [accountNumber, at]
  );

  return result.rows[0].balance;
}

async function getBalanceAt(accountNumber: string, at: string) {
  return request(app).get(
    `/api/v1/banking/${accountNumber}/balance?at=${encodeURIComponent(at)}`
  );
}

async function expectBalanceAt(
  accountNumber: string,
  at: string,
  expectedBalance: string
): Promise<void> {
  const response = await getBalanceAt(accountNumber, at);
  const databaseBalance = await getLedgerBalanceAt(accountNumber, at);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);
  expect(response.body.data.accountNumber).toBe(accountNumber);
  expect(response.body.data.asOf).toBe(at);
  expect(response.body.data.balance).toBe(expectedBalance);
  expect(response.body.data.balance).toBe(databaseBalance);
}

async function createTimeline(): Promise<Timeline> {
  const account = await createCustomerAccount();

  expect((await deposit(account.accountNumber, "1000.00")).status).toBe(201);
  const t1 = await latestLedgerTimestamp(account.accountNumber);

  await new Promise((resolve) => setTimeout(resolve, 5));
  expect((await withdraw(account.accountNumber, "300.00")).status).toBe(201);
  const t2 = await latestLedgerTimestamp(account.accountNumber);

  await new Promise((resolve) => setTimeout(resolve, 5));
  expect((await deposit(account.accountNumber, "200.00")).status).toBe(201);
  const t3 = await latestLedgerTimestamp(account.accountNumber);

  return { account, t1, t2, t3 };
}

describe("Balance At Time API", () => {
  it("should return zero before the first transaction", async () => {
    const timeline = await createTimeline();
    const beforeFirstTransaction = new Date(
      new Date(timeline.t1).getTime() - 1_000
    ).toISOString();

    await expectBalanceAt(timeline.account.accountNumber, beforeFirstTransaction, "0.00");
  });

  it("should reconstruct the balance at the first deposit", async () => {
    const timeline = await createTimeline();

    await expectBalanceAt(timeline.account.accountNumber, timeline.t1, "1000.00");
  });

  it("should reconstruct the balance after a withdrawal", async () => {
    const timeline = await createTimeline();

    await expectBalanceAt(timeline.account.accountNumber, timeline.t2, "700.00");
  });

  it("should reconstruct the balance after a later deposit", async () => {
    const timeline = await createTimeline();

    await expectBalanceAt(timeline.account.accountNumber, timeline.t3, "900.00");
  });

  it("should match the current balance after all timeline events", async () => {
    const timeline = await createTimeline();

    const current = await request(app).get(
      `/api/v1/banking/${timeline.account.accountNumber}/balance`
    );

    expect(current.status).toBe(200);
    expect(current.body.data.balance).toBe("900.00");
    await expectBalanceAt(timeline.account.accountNumber, "2100-01-01T00:00:00.000Z", "900.00");
  });

  it("should return zero for a timestamp before account creation", async () => {
    const timeline = await createTimeline();

    await expectBalanceAt(timeline.account.accountNumber, "2000-01-01T00:00:00.000Z", "0.00");
  });

  it("should reconstruct both sides of a transfer at a point in time", async () => {
    const sender = await createCustomerAccount("1000000001", "1");
    const receiver = await createCustomerAccount("1000000002", "2");
    await deposit(sender.accountNumber, "1000.00");
    const beforeTransfer = await latestLedgerTimestamp(sender.accountNumber);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const transferResponse = await transfer(sender.accountNumber, receiver.accountNumber, "250.00");
    const afterTransfer = await latestLedgerTimestamp(sender.accountNumber);

    expect(transferResponse.status).toBe(201);
    await expectBalanceAt(sender.accountNumber, beforeTransfer, "1000.00");
    await expectBalanceAt(receiver.accountNumber, beforeTransfer, "0.00");
    await expectBalanceAt(sender.accountNumber, afterTransfer, "750.00");
    await expectBalanceAt(receiver.accountNumber, afterTransfer, "250.00");
  });

  it("should include multiple transactions created in the same second", async () => {
    const account = await createCustomerAccount();
    expect((await deposit(account.accountNumber, "100.00")).status).toBe(201);
    expect((await deposit(account.accountNumber, "200.00")).status).toBe(201);
    const timestamp = await latestLedgerTimestamp(account.accountNumber);

    await expectBalanceAt(account.accountNumber, timestamp, "300.00");
  });

  it("should reconstruct a balance after many deposits and withdrawals", async () => {
    const account = await createCustomerAccount();

    for (let index = 0; index < 20; index += 1) {
      expect((await deposit(account.accountNumber, "100.00")).status).toBe(201);
    }
    for (let index = 0; index < 10; index += 1) {
      expect((await withdraw(account.accountNumber, "25.00")).status).toBe(201);
    }
    const timestamp = await latestLedgerTimestamp(account.accountNumber);

    await expectBalanceAt(account.accountNumber, timestamp, "1750.00");
  });

  it("should reject an invalid timestamp", async () => {
    const account = await createCustomerAccount();

    const response = await request(app).get(
      `/api/v1/banking/${account.accountNumber}/balance?at=not-a-timestamp`
    );

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should return 404 for a missing account", async () => {
    const response = await getBalanceAt("9999999999", "2100-01-01T00:00:00.000Z");

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });
});
