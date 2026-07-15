import { performance } from "node:perf_hooks";
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

async function createAccounts(): Promise<{ accountA: AccountResponse; accountB: AccountResponse }> {
  const customerA = await createCustomer("Santhosh", "santhosh@gmail.com", "9876543210");
  const accountA = await createAccount(customerA.id, "1000000001");
  const customerB = await createCustomer("Priya", "priya@gmail.com", "9876543211");
  const accountB = await createAccount(customerB.id, "1000000002");

  return { accountA, accountB };
}

async function deposit(accountNumber: string, amount: string, key = crypto.randomUUID()) {
  return request(app)
    .post(DEPOSIT_URL)
    .set("Idempotency-Key", key)
    .send({ accountNumber, amount });
}

async function withdraw(accountNumber: string, amount: string, key = crypto.randomUUID()) {
  return request(app)
    .post(WITHDRAW_URL)
    .set("Idempotency-Key", key)
    .send({ accountNumber, amount });
}

async function transfer(
  fromAccountNumber: string,
  toAccountNumber: string,
  amount: string,
  key = crypto.randomUUID()
) {
  return request(app)
    .post(TRANSFER_URL)
    .set("Idempotency-Key", key)
    .send({ fromAccountNumber, toAccountNumber, amount });
}

async function fundAccount(accountNumber: string, amount: string): Promise<void> {
  const response = await deposit(accountNumber, amount);
  expect(response.status).toBe(201);
}

async function getBalance(accountNumber: string): Promise<number> {
  const response = await request(app).get(`/api/v1/banking/${accountNumber}/balance`);
  expect(response.status).toBe(200);
  return Number(response.body.data.balance);
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

async function assertLedgerIntegrity(): Promise<void> {
  const unbalancedTransactions = await query<{ transaction_id: string }>(
    `
    SELECT transaction_id
    FROM ledger_entries
    GROUP BY transaction_id
    HAVING COALESCE(SUM(amount) FILTER (WHERE entry_type = 'DEBIT'), 0)
      <> COALESCE(SUM(amount) FILTER (WHERE entry_type = 'CREDIT'), 0);
    `
  );
  const orphanEntries = await query<{ count: string }>(
    `
    SELECT COUNT(*)::text AS count
    FROM ledger_entries le
    LEFT JOIN transactions t ON t.id = le.transaction_id
    WHERE t.id IS NULL;
    `
  );
  const totals = await query<{ debits: string; credits: string }>(
    `
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE entry_type = 'DEBIT'), 0)::text AS debits,
      COALESCE(SUM(amount) FILTER (WHERE entry_type = 'CREDIT'), 0)::text AS credits
    FROM ledger_entries;
    `
  );

  expect(unbalancedTransactions.rows).toEqual([]);
  expect(Number(orphanEntries.rows[0].count)).toBe(0);
  expect(totals.rows[0].debits).toBe(totals.rows[0].credits);
}

describe("Banking Concurrency API", () => {
  it("should process 100 concurrent deposits without lost updates", async () => {
    const { accountA } = await createAccounts();
    const startedAt = performance.now();

    const responses = await Promise.all(
      Array.from({ length: 100 }, () => deposit(accountA.accountNumber, "100.00"))
    );
    const elapsed = performance.now() - startedAt;
    const idempotencyStatus = await query<{ status: string; count: string }>(
      `
      SELECT status, COUNT(*)::text AS count
      FROM idempotency_keys
      GROUP BY status;
      `
    );

    expect(responses.every((response) => response.status === 201)).toBe(true);
    expect(await transactionCount()).toBe(100);
    expect(await ledgerEntryCount()).toBe(200);
    expect(await getBalance(accountA.accountNumber)).toBe(10000);
    expect(idempotencyStatus.rows).toEqual([{ status: "COMPLETED", count: "100" }]);
    expect(elapsed).toBeLessThan(20_000);
    await assertLedgerIntegrity();
  });

  it("should prevent double spending during 10 concurrent withdrawals", async () => {
    const { accountA } = await createAccounts();
    await fundAccount(accountA.accountNumber, "1000.00");

    const responses = await Promise.all(
      Array.from({ length: 10 }, () => withdraw(accountA.accountNumber, "200.00"))
    );
    const successes = responses.filter((response) => response.status === 201);
    const failures = responses.filter((response) => response.status === 409);
    const statuses = await query<{ status: string; count: string }>(
      "SELECT status, COUNT(*)::text AS count FROM idempotency_keys GROUP BY status ORDER BY status"
    );

    expect(successes).toHaveLength(5);
    expect(failures).toHaveLength(5);
    expect(await transactionCount()).toBe(6);
    expect(await ledgerEntryCount()).toBe(12);
    expect(await getBalance(accountA.accountNumber)).toBe(0);
    expect(statuses.rows).toEqual([
      { status: "COMPLETED", count: "6" },
      { status: "FAILED", count: "5" },
    ]);
    await assertLedgerIntegrity();
  });

  it("should process 100 concurrent transfers without creating or losing money", async () => {
    const { accountA, accountB } = await createAccounts();
    await fundAccount(accountA.accountNumber, "10000.00");
    const startedAt = performance.now();

    const responses = await Promise.all(
      Array.from({ length: 100 }, () =>
        transfer(accountA.accountNumber, accountB.accountNumber, "100.00")
      )
    );
    const elapsed = performance.now() - startedAt;
    const balanceA = await getBalance(accountA.accountNumber);
    const balanceB = await getBalance(accountB.accountNumber);

    expect(responses.every((response) => response.status === 201)).toBe(true);
    expect(await transactionCount()).toBe(101);
    expect(await ledgerEntryCount()).toBe(402);
    expect(balanceA).toBe(0);
    expect(balanceB).toBe(10000);
    expect(balanceA + balanceB).toBe(10000);
    expect(elapsed / responses.length).toBeLessThan(1_000);
    await assertLedgerIntegrity();
  });

  it("should keep balances consistent during mixed concurrent operations", async () => {
    const { accountA, accountB } = await createAccounts();
    await fundAccount(accountA.accountNumber, "5000.00");

    const responses = await Promise.all([
      ...Array.from({ length: 10 }, () => deposit(accountA.accountNumber, "100.00")),
      ...Array.from({ length: 5 }, () => withdraw(accountA.accountNumber, "200.00")),
      ...Array.from({ length: 10 }, () => transfer(accountA.accountNumber, accountB.accountNumber, "100.00")),
    ]);
    const balanceA = await getBalance(accountA.accountNumber);
    const balanceB = await getBalance(accountB.accountNumber);
    const accounts = await query<{ account_number: string; status: string }>(
      "SELECT account_number, status FROM bank_accounts ORDER BY account_number"
    );

    expect(responses.every((response) => response.status === 201)).toBe(true);
    expect(await transactionCount()).toBe(26);
    expect(await ledgerEntryCount()).toBe(72);
    expect(balanceA).toBe(4000);
    expect(balanceB).toBe(1000);
    expect(balanceA + balanceB).toBe(5000);
    expect(accounts.rows).toEqual([
      { account_number: accountA.accountNumber, status: "ACTIVE" },
      { account_number: accountB.accountNumber, status: "ACTIVE" },
    ]);
    await assertLedgerIntegrity();
  });

  it("should avoid deadlocks during concurrent transfers in both directions", async () => {
    const { accountA, accountB } = await createAccounts();
    await fundAccount(accountA.accountNumber, "5000.00");
    await fundAccount(accountB.accountNumber, "5000.00");

    const responses = await Promise.all([
      ...Array.from({ length: 20 }, () => transfer(accountA.accountNumber, accountB.accountNumber, "100.00")),
      ...Array.from({ length: 20 }, () => transfer(accountB.accountNumber, accountA.accountNumber, "100.00")),
    ]);
    const balanceA = await getBalance(accountA.accountNumber);
    const balanceB = await getBalance(accountB.accountNumber);

    expect(responses.every((response) => response.status === 201)).toBe(true);
    expect(balanceA).toBe(5000);
    expect(balanceB).toBe(5000);
    expect(balanceA + balanceB).toBe(10000);
    await assertLedgerIntegrity();
  });

  it("should process concurrent duplicate idempotency keys exactly once", async () => {
    const { accountA } = await createAccounts();
    const key = crypto.randomUUID();

    const responses = await Promise.all(
      Array.from({ length: 10 }, () => deposit(accountA.accountNumber, "100.00", key))
    );

    expect(responses.every((response) => response.status === 201)).toBe(true);
    for (const response of responses) {
      expect(response.body).toEqual(responses[0].body);
    }
    expect(await transactionCount()).toBe(1);
    expect(await ledgerEntryCount()).toBe(2);
    expect(await getBalance(accountA.accountNumber)).toBe(100);
    await assertLedgerIntegrity();
  });
});
