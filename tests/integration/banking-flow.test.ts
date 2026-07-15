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

interface CustomerResponse {
  id: string;
}

interface AccountResponse {
  id: string;
  accountNumber: string;
}

interface OperationResponse {
  transactionId: string;
  reference: string;
}

interface HistoryItem {
  transactionId: string;
  description: string | null;
  entryType: "DEBIT" | "CREDIT";
  amount: string;
}

beforeEach(async () => {
  await resetDatabase();
});

async function createCustomer(name: string, email: string, phone: string): Promise<CustomerResponse> {
  const response = await request(app)
    .post(CUSTOMER_URL)
    .send({ name, email, phone });

  expect(response.status).toBe(201);
  return response.body.data as CustomerResponse;
}

async function createSavingsAccount(
  customerId: string,
  accountNumber: string
): Promise<AccountResponse> {
  const response = await request(app)
    .post(ACCOUNT_URL)
    .send({ customerId, accountNumber, accountType: "SAVINGS" });

  expect(response.status).toBe(201);
  return response.body.data as AccountResponse;
}

async function deposit(accountNumber: string, amount: string): Promise<OperationResponse> {
  const response = await request(app)
    .post(DEPOSIT_URL)
    .set("Idempotency-Key", crypto.randomUUID())
    .send({ accountNumber, amount });

  expect(response.status).toBe(201);
  return response.body.data as OperationResponse;
}

async function withdraw(accountNumber: string, amount: string): Promise<OperationResponse> {
  const response = await request(app)
    .post(WITHDRAW_URL)
    .set("Idempotency-Key", crypto.randomUUID())
    .send({ accountNumber, amount });

  expect(response.status).toBe(201);
  return response.body.data as OperationResponse;
}

async function transfer(
  fromAccountNumber: string,
  toAccountNumber: string,
  amount: string
): Promise<OperationResponse> {
  const response = await request(app)
    .post(TRANSFER_URL)
    .set("Idempotency-Key", crypto.randomUUID())
    .send({ fromAccountNumber, toAccountNumber, amount });

  expect(response.status).toBe(201);
  return response.body.data as OperationResponse;
}

async function getBalance(accountNumber: string): Promise<string> {
  const response = await request(app).get(`/api/v1/banking/${accountNumber}/balance`);
  expect(response.status).toBe(200);
  return response.body.data.balance as string;
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

describe("End-to-End Banking Flow API", () => {
  it("should preserve a complete, traceable and balanced customer journey", async () => {
    const startedAt = performance.now();

    const customerA = await createCustomer("Santhosh", "santhosh@gmail.com", "9876543210");
    const accountA = await createSavingsAccount(customerA.id, "1000000001");
    const firstDeposit = await deposit(accountA.accountNumber, "10000.00");
    expect(await getBalance(accountA.accountNumber)).toBe("10000.00");

    const withdrawal = await withdraw(accountA.accountNumber, "2500.00");
    expect(await getBalance(accountA.accountNumber)).toBe("7500.00");

    const secondDeposit = await deposit(accountA.accountNumber, "1500.00");
    expect(await getBalance(accountA.accountNumber)).toBe("9000.00");
    const beforeTransfer = await latestLedgerTimestamp(accountA.accountNumber);

    const customerB = await createCustomer("Priya", "priya@gmail.com", "9876543211");
    const accountB = await createSavingsAccount(customerB.id, "1000000002");
    const transferTransaction = await transfer(accountA.accountNumber, accountB.accountNumber, "3000.00");
    const afterTransfer = await latestLedgerTimestamp(accountA.accountNumber);

    expect(await getBalance(accountA.accountNumber)).toBe("6000.00");
    expect(await getBalance(accountB.accountNumber)).toBe("3000.00");

    const senderHistoryResponse = await request(app).get(
      `/api/v1/banking/${accountA.accountNumber}/history?sort=asc`
    );
    const receiverHistoryResponse = await request(app).get(
      `/api/v1/banking/${accountB.accountNumber}/history`
    );
    const senderHistory = senderHistoryResponse.body.data.transactions as HistoryItem[];
    const receiverHistory = receiverHistoryResponse.body.data.transactions as HistoryItem[];

    expect(senderHistoryResponse.status).toBe(200);
    expect(senderHistory.map((item) => item.transactionId)).toEqual([
      firstDeposit.transactionId,
      withdrawal.transactionId,
      secondDeposit.transactionId,
      transferTransaction.transactionId,
    ]);
    expect(senderHistory.map((item) => item.description)).toEqual([
      "Cash Deposit",
      "Cash Withdrawal",
      "Cash Deposit",
      "Transfer",
    ]);
    expect(senderHistory.map((item) => item.amount)).toEqual([
      "10000.00",
      "2500.00",
      "1500.00",
      "3000.00",
    ]);
    expect(receiverHistoryResponse.status).toBe(200);
    expect(receiverHistory).toHaveLength(1);
    expect(receiverHistory[0]).toMatchObject({
      transactionId: transferTransaction.transactionId,
      description: "Transfer",
      entryType: "CREDIT",
      amount: "3000.00",
    });

    const beforeTransferBalance = await request(app).get(
      `/api/v1/banking/${accountA.accountNumber}/balance?at=${encodeURIComponent(beforeTransfer)}`
    );
    const afterTransferBalance = await request(app).get(
      `/api/v1/banking/${accountA.accountNumber}/balance?at=${encodeURIComponent(afterTransfer)}`
    );
    expect(beforeTransferBalance.status).toBe(200);
    expect(beforeTransferBalance.body.data.balance).toBe("9000.00");
    expect(afterTransferBalance.status).toBe(200);
    expect(afterTransferBalance.body.data.balance).toBe("6000.00");

    const detailResponses = await Promise.all(
      [firstDeposit, withdrawal, secondDeposit, transferTransaction].map((operation) =>
        request(app).get(`/api/v1/transactions/${operation.transactionId}`)
      )
    );
    const expectedEntryCounts = [2, 2, 2, 4];
    for (const [index, response] of detailResponses.entries()) {
      const operation = [firstDeposit, withdrawal, secondDeposit, transferTransaction][index];
      expect(response.status).toBe(200);
      expect(response.body.data.transactionId).toBe(operation.transactionId);
      expect(response.body.data.reference).toBe(operation.reference);
      expect(new Date(response.body.data.createdAt).toISOString()).toBe(response.body.data.createdAt);
      expect(response.body.data.entries).toHaveLength(expectedEntryCounts[index]);
      expect(
        response.body.data.entries.every((entry: { transactionId: string }) =>
          entry.transactionId === operation.transactionId
        )
      ).toBe(true);
    }

    const counts = await query<{
      customers: string;
      accounts: string;
      transactions: string;
      entries: string;
      idempotency_keys: string;
    }>(
      `
      SELECT
        (SELECT COUNT(*) FROM customers)::text AS customers,
        (SELECT COUNT(*) FROM bank_accounts)::text AS accounts,
        (SELECT COUNT(*) FROM transactions)::text AS transactions,
        (SELECT COUNT(*) FROM ledger_entries)::text AS entries,
        (SELECT COUNT(*) FROM idempotency_keys)::text AS idempotency_keys;
      `
    );
    const ledgerTotals = await query<{ debits: string; credits: string }>(
      `
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE entry_type = 'DEBIT'), 0)::text AS debits,
        COALESCE(SUM(amount) FILTER (WHERE entry_type = 'CREDIT'), 0)::text AS credits
      FROM ledger_entries;
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
    const traceableTransactions = await query<{ count: string }>(
      `
      SELECT COUNT(DISTINCT le.transaction_id)::text AS count
      FROM ledger_entries le
      INNER JOIN ledger_accounts la ON la.id = le.ledger_account_id
      INNER JOIN bank_accounts ba ON ba.id = la.bank_account_id
      INNER JOIN customers c ON c.id = ba.customer_id;
      `
    );
    const idempotencyStatuses = await query<{ status: string; count: string }>(
      "SELECT status, COUNT(*)::text AS count FROM idempotency_keys GROUP BY status"
    );

    expect(counts.rows[0]).toEqual({
      customers: "2",
      accounts: "2",
      transactions: "4",
      entries: "10",
      idempotency_keys: "4",
    });
    expect(ledgerTotals.rows[0].debits).toBe(ledgerTotals.rows[0].credits);
    expect(Number(orphanEntries.rows[0].count)).toBe(0);
    expect(Number(traceableTransactions.rows[0].count)).toBe(4);
    expect(idempotencyStatuses.rows).toEqual([{ status: "COMPLETED", count: "4" }]);
    expect(Number(await getBalance(accountA.accountNumber)) + Number(await getBalance(accountB.accountNumber))).toBe(9000);
    expect(performance.now() - startedAt).toBeLessThan(5_000);
  });
});
