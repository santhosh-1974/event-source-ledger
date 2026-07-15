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
    .send({
      customerId,
      accountNumber,
      accountType: "SAVINGS",
    });

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

async function transfer(
  fromAccountNumber: string,
  toAccountNumber: string,
  amount: string
) {
  return request(app)
    .post(TRANSFER_URL)
    .set("Idempotency-Key", crypto.randomUUID())
    .send({ fromAccountNumber, toAccountNumber, amount });
}

async function getBalance(accountNumber: string) {
  return request(app).get(`/api/v1/banking/${accountNumber}/balance`);
}

async function getLedgerBalance(accountNumber: string): Promise<string> {
  const result = await query<{ balance: string }>(
    `
    SELECT COALESCE(
      SUM(CASE WHEN le.entry_type = 'CREDIT' THEN le.amount ELSE -le.amount END),
      0
    )::numeric(18,2)::text AS balance
    FROM bank_accounts ba
    INNER JOIN ledger_accounts la ON la.bank_account_id = ba.id
    LEFT JOIN ledger_entries le ON le.ledger_account_id = la.id
    WHERE ba.account_number = $1;
    `,
    [accountNumber]
  );

  return result.rows[0].balance;
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

async function expectBalance(accountNumber: string, expectedBalance: string): Promise<void> {
  const response = await getBalance(accountNumber);
  const databaseBalance = await getLedgerBalance(accountNumber);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);
  expect(response.body.data.accountNumber).toBe(accountNumber);
  expect(response.body.data.balance).toBe(expectedBalance);
  expect(response.body.data.balance).toBe(databaseBalance);
}

describe("Balance API", () => {
  it("should return zero for a new account", async () => {
    const account = await createCustomerAccount();

    await expectBalance(account.accountNumber, "0.00");
  });

  it("should return the balance after a deposit", async () => {
    const account = await createCustomerAccount();
    const depositResponse = await deposit(account.accountNumber, "1000.00");

    expect(depositResponse.status).toBe(201);
    await expectBalance(account.accountNumber, "1000.00");
  });

  it("should derive the balance from deposits and withdrawals", async () => {
    const account = await createCustomerAccount();
    await deposit(account.accountNumber, "1000.00");
    const withdrawalResponse = await withdraw(account.accountNumber, "400.00");

    expect(withdrawalResponse.status).toBe(201);
    await expectBalance(account.accountNumber, "600.00");
  });

  it("should derive the correct balance after a transfer out", async () => {
    const sender = await createCustomerAccount("1000000001", "1");
    const receiver = await createCustomerAccount("1000000002", "2");
    await deposit(sender.accountNumber, "1000.00");
    await withdraw(sender.accountNumber, "100.00");
    const transferResponse = await transfer(
      sender.accountNumber,
      receiver.accountNumber,
      "300.00"
    );

    expect(transferResponse.status).toBe(201);
    await expectBalance(sender.accountNumber, "600.00");
    await expectBalance(receiver.accountNumber, "300.00");
  });

  it("should derive the correct balance after receiving a transfer", async () => {
    const sender = await createCustomerAccount("1000000001", "1");
    const receiver = await createCustomerAccount("1000000002", "2");
    await deposit(sender.accountNumber, "1000.00");
    const transferResponse = await transfer(
      sender.accountNumber,
      receiver.accountNumber,
      "250.00"
    );

    expect(transferResponse.status).toBe(201);
    await expectBalance(sender.accountNumber, "750.00");
    await expectBalance(receiver.accountNumber, "250.00");
  });

  it("should calculate the balance across multiple deposits", async () => {
    const account = await createCustomerAccount();

    for (const amount of ["100.00", "200.00", "300.00", "400.00"]) {
      const response = await deposit(account.accountNumber, amount);
      expect(response.status).toBe(201);
    }

    await expectBalance(account.accountNumber, "1000.00");
  });

  it("should preserve decimal precision", async () => {
    const account = await createCustomerAccount();
    await deposit(account.accountNumber, "1000.10");
    const withdrawalResponse = await withdraw(account.accountNumber, "0.01");

    expect(withdrawalResponse.status).toBe(201);
    await expectBalance(account.accountNumber, "1000.09");
  });

  it("should return an exact large balance without JavaScript number rounding", async () => {
    const account = await createCustomerAccount();
    const amount = "9999999999999999.99";
    const depositResponse = await deposit(account.accountNumber, amount);

    expect(depositResponse.status).toBe(201);
    await expectBalance(account.accountNumber, amount);
  });

  it("should calculate the correct balance after many transactions", async () => {
    const account = await createCustomerAccount();

    for (let index = 0; index < 20; index += 1) {
      const response = await deposit(account.accountNumber, "100.00");
      expect(response.status).toBe(201);
    }

    for (let index = 0; index < 10; index += 1) {
      const response = await withdraw(account.accountNumber, "50.00");
      expect(response.status).toBe(201);
    }

    await expectBalance(account.accountNumber, "1500.00");
  });

  it("should return zero after a full withdrawal", async () => {
    const account = await createCustomerAccount();
    await deposit(account.accountNumber, "1000.00");
    const withdrawalResponse = await withdraw(account.accountNumber, "1000.00");

    expect(withdrawalResponse.status).toBe(201);
    await expectBalance(account.accountNumber, "0.00");
  });

  it("should return 404 for an invalid account number", async () => {
    const response = await getBalance("9999999999");

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  it("should return 404 when the requested account does not exist", async () => {
    await createCustomerAccount();

    const response = await getBalance("0000000000");

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  it("should return the balance for a BLOCKED account", async () => {
    const account = await createCustomerAccount();
    await deposit(account.accountNumber, "1000.00");
    await query("UPDATE bank_accounts SET status = 'BLOCKED' WHERE id = $1", [account.id]);

    await expectBalance(account.accountNumber, "1000.00");
  });

  it("should return the balance for a CLOSED account", async () => {
    const account = await createCustomerAccount();
    await deposit(account.accountNumber, "1000.00");
    await query("UPDATE bank_accounts SET status = 'CLOSED' WHERE id = $1", [account.id]);

    await expectBalance(account.accountNumber, "1000.00");
  });

  it("should return the same balance on repeated reads without creating records", async () => {
    const account = await createCustomerAccount();
    await deposit(account.accountNumber, "1000.00");
    await withdraw(account.accountNumber, "400.00");
    const beforeTransactions = await transactionCount();
    const beforeEntries = await ledgerEntryCount();

    const firstResponse = await getBalance(account.accountNumber);
    const secondResponse = await getBalance(account.accountNumber);

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body).toEqual(firstResponse.body);
    expect(firstResponse.body.data.balance).toBe("600.00");
    expect(await transactionCount()).toBe(beforeTransactions);
    expect(await ledgerEntryCount()).toBe(beforeEntries);
  });
});
