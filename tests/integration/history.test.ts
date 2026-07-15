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

interface HistoryItem {
  transactionId: string;
  reference: string;
  entryType: "DEBIT" | "CREDIT";
  amount: string;
  description: string | null;
  createdAt: string;
}

interface HistoryResponse {
  transactions: HistoryItem[];
  pagination: {
    page: number;
    limit: number;
    totalRecords: number;
    totalPages: number;
  };
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

async function getHistory(
  accountNumber: string,
  queryString = ""
) {
  return request(app).get(`/api/v1/banking/${accountNumber}/history${queryString}`);
}

async function createAccountWithActivity(): Promise<{
  account: AccountResponse;
  receiver: AccountResponse;
}> {
  const account = await createCustomerAccount("1000000001", "1");
  const receiver = await createCustomerAccount("1000000002", "2");

  expect((await deposit(account.accountNumber, "1000.00")).status).toBe(201);
  expect((await withdraw(account.accountNumber, "300.00")).status).toBe(201);
  expect((await deposit(account.accountNumber, "500.00")).status).toBe(201);
  expect((await transfer(account.accountNumber, receiver.accountNumber, "200.00")).status).toBe(201);

  return { account, receiver };
}

async function expectHistoryMatchesDatabase(
  accountNumber: string,
  page: number,
  limit: number,
  sort: "asc" | "desc"
): Promise<void> {
  const offset = (page - 1) * limit;
  const order = sort.toUpperCase();
  const response = await getHistory(
    accountNumber,
    `?page=${page}&limit=${limit}&sort=${sort}`
  );
  const history = response.body.data as HistoryResponse;
  const database = await query<{
    transaction_id: string;
    reference: string;
    entry_type: "DEBIT" | "CREDIT";
    amount: string;
    description: string | null;
    created_at: Date;
  }>(
    `
    SELECT
      le.transaction_id,
      t.reference,
      le.entry_type,
      le.amount,
      t.description,
      le.created_at
    FROM bank_accounts ba
    INNER JOIN ledger_accounts la ON la.bank_account_id = ba.id
    INNER JOIN ledger_entries le ON le.ledger_account_id = la.id
    INNER JOIN transactions t ON t.id = le.transaction_id
    WHERE ba.account_number = $1
    ORDER BY le.created_at ${order}, le.transaction_id ${order}
    LIMIT $2 OFFSET $3;
    `,
    [accountNumber, limit, offset]
  );

  expect(response.status).toBe(200);
  expect(history.transactions).toEqual(
    database.rows.map((row) => ({
      transactionId: row.transaction_id,
      reference: row.reference,
      entryType: row.entry_type,
      amount: row.amount,
      description: row.description,
      createdAt: row.created_at.toISOString(),
    }))
  );
}

describe("Transaction History API", () => {
  it("should return an empty history for a new account", async () => {
    const account = await createCustomerAccount();

    const response = await getHistory(account.accountNumber);
    const history = response.body.data as HistoryResponse;

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(history.transactions).toEqual([]);
    expect(history.pagination).toEqual({
      page: 1,
      limit: 20,
      totalRecords: 0,
      totalPages: 1,
    });
  });

  it("should return one deposit record", async () => {
    const account = await createCustomerAccount();
    const depositResponse = await deposit(account.accountNumber, "1000.00");

    expect(depositResponse.status).toBe(201);
    await expectHistoryMatchesDatabase(account.accountNumber, 1, 20, "desc");

    const response = await getHistory(account.accountNumber);
    const history = response.body.data as HistoryResponse;
    expect(history.transactions).toHaveLength(1);
    expect(history.transactions[0]).toMatchObject({
      entryType: "CREDIT",
      amount: "1000.00",
      description: "Cash Deposit",
    });
    expect(new Date(history.transactions[0].createdAt).toISOString()).toBe(
      history.transactions[0].createdAt
    );
  });

  it("should return deposit and withdrawal records", async () => {
    const account = await createCustomerAccount();
    await deposit(account.accountNumber, "1000.00");
    await withdraw(account.accountNumber, "300.00");

    const response = await getHistory(account.accountNumber);
    const history = response.body.data as HistoryResponse;

    expect(response.status).toBe(200);
    expect(history.transactions).toHaveLength(2);
    expect(history.transactions.map((item) => item.entryType).sort()).toEqual([
      "CREDIT",
      "DEBIT",
    ]);
    expect(history.transactions.map((item) => item.description).sort()).toEqual([
      "Cash Deposit",
      "Cash Withdrawal",
    ]);
    await expectHistoryMatchesDatabase(account.accountNumber, 1, 20, "desc");
  });

  it("should return all transaction types involving an account", async () => {
    const { account } = await createAccountWithActivity();

    const response = await getHistory(account.accountNumber);
    const history = response.body.data as HistoryResponse;

    expect(response.status).toBe(200);
    expect(history.transactions).toHaveLength(4);
    expect(history.transactions.map((item) => item.description).sort()).toEqual([
      "Cash Deposit",
      "Cash Deposit",
      "Cash Withdrawal",
      "Transfer",
    ]);
    expect(history.transactions.map((item) => item.amount).sort()).toEqual([
      "1000.00",
      "200.00",
      "300.00",
      "500.00",
    ]);
    await expectHistoryMatchesDatabase(account.accountNumber, 1, 20, "desc");
  });

  it("should return newest records first by default", async () => {
    const { account } = await createAccountWithActivity();

    const response = await getHistory(account.accountNumber);
    const history = response.body.data as HistoryResponse;
    const timestamps = history.transactions.map((item) => new Date(item.createdAt).getTime());

    expect(timestamps.every((time, index) => index === 0 || time <= timestamps[index - 1])).toBe(true);
    await expectHistoryMatchesDatabase(account.accountNumber, 1, 20, "desc");
  });

  it("should return oldest records first when sort=asc", async () => {
    const { account } = await createAccountWithActivity();

    const response = await getHistory(account.accountNumber, "?sort=asc");
    const history = response.body.data as HistoryResponse;
    const timestamps = history.transactions.map((item) => new Date(item.createdAt).getTime());

    expect(response.status).toBe(200);
    expect(timestamps.every((time, index) => index === 0 || time >= timestamps[index - 1])).toBe(true);
    await expectHistoryMatchesDatabase(account.accountNumber, 1, 20, "asc");
  });

  it("should paginate history without duplicate transactions", async () => {
    const account = await createCustomerAccount();

    for (const amount of ["100.00", "200.00", "300.00", "400.00", "500.00"]) {
      expect((await deposit(account.accountNumber, amount)).status).toBe(201);
    }

    const firstPage = await getHistory(account.accountNumber, "?page=1&limit=2");
    const secondPage = await getHistory(account.accountNumber, "?page=2&limit=2");
    const thirdPage = await getHistory(account.accountNumber, "?page=3&limit=2");
    const firstHistory = firstPage.body.data as HistoryResponse;
    const secondHistory = secondPage.body.data as HistoryResponse;
    const thirdHistory = thirdPage.body.data as HistoryResponse;
    const ids = [
      ...firstHistory.transactions,
      ...secondHistory.transactions,
      ...thirdHistory.transactions,
    ].map((item) => item.transactionId);

    expect(firstHistory.pagination).toEqual({ page: 1, limit: 2, totalRecords: 5, totalPages: 3 });
    expect(secondHistory.pagination).toEqual({ page: 2, limit: 2, totalRecords: 5, totalPages: 3 });
    expect(thirdHistory.transactions).toHaveLength(1);
    expect(new Set(ids).size).toBe(5);
    await expectHistoryMatchesDatabase(account.accountNumber, 1, 2, "desc");
    await expectHistoryMatchesDatabase(account.accountNumber, 2, 2, "desc");
  });

  it("should respect a larger page limit", async () => {
    const { account } = await createAccountWithActivity();

    const response = await getHistory(account.accountNumber, "?page=1&limit=10");
    const history = response.body.data as HistoryResponse;

    expect(response.status).toBe(200);
    expect(history.transactions).toHaveLength(4);
    expect(history.pagination).toEqual({ page: 1, limit: 10, totalRecords: 4, totalPages: 1 });
  });

  it("should return 404 for an invalid account number", async () => {
    const response = await getHistory("9999999999");

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  it("should return 404 when the requested account does not exist", async () => {
    await createCustomerAccount();

    const response = await getHistory("0000000000");

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  it("should reject invalid pagination and sort values", async () => {
    const account = await createCustomerAccount();

    const invalidPage = await getHistory(account.accountNumber, "?page=0");
    const invalidLimit = await getHistory(account.accountNumber, "?limit=101");
    const invalidSort = await getHistory(account.accountNumber, "?sort=sideways");

    expect(invalidPage.status).toBe(400);
    expect(invalidLimit.status).toBe(400);
    expect(invalidSort.status).toBe(400);
  });

  it("should return a large history with pagination", async () => {
    const account = await createCustomerAccount();

    for (let index = 0; index < 105; index += 1) {
      expect((await deposit(account.accountNumber, "1.00")).status).toBe(201);
    }

    const response = await getHistory(account.accountNumber, "?page=11&limit=10");
    const history = response.body.data as HistoryResponse;

    expect(response.status).toBe(200);
    expect(history.transactions).toHaveLength(5);
    expect(history.pagination).toEqual({ page: 11, limit: 10, totalRecords: 105, totalPages: 11 });
    await expectHistoryMatchesDatabase(account.accountNumber, 11, 10, "desc");
  });
});
