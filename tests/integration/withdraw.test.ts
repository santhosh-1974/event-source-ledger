import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import app from "../helpers/app";
import { resetDatabase } from "../helpers/database";
import { query } from "../../src/database/database";

const CUSTOMER_URL = "/api/v1/customers/create-customer";
const ACCOUNT_URL = "/api/v1/accounts";
const DEPOSIT_URL = "/api/v1/banking/deposit";
const WITHDRAW_URL = "/api/v1/banking/withdraw";

const ACCOUNT_NUMBER = "1000000001";
const INITIAL_BALANCE = "1000.00";

interface AccountResponse {
  id: string;
  accountNumber: string;
}

interface WithdrawalResponse {
  transactionId: string;
  reference: string;
}

beforeEach(async () => {
  await resetDatabase();
});

afterEach(async () => {
  await query("DROP TRIGGER IF EXISTS fail_withdrawal_credit_trigger ON ledger_entries;");
  await query("DROP FUNCTION IF EXISTS fail_withdrawal_credit();");
});

async function createCustomer() {
  const response = await request(app)
    .post(CUSTOMER_URL)
    .send({
      name: "Santhosh",
      email: "santhosh@gmail.com",
      phone: "9876543210",
    });

  expect(response.status).toBe(201);

  return response.body.data as { id: string };
}

async function createAccount(): Promise<AccountResponse> {
  const customer = await createCustomer();

  const response = await request(app)
    .post(ACCOUNT_URL)
    .send({
      customerId: customer.id,
      accountNumber: ACCOUNT_NUMBER,
      accountType: "SAVINGS",
    });

  expect(response.status).toBe(201);

  return response.body.data as AccountResponse;
}

async function createFundedAccount(): Promise<AccountResponse> {
  const account = await createAccount();

  const response = await request(app)
    .post(DEPOSIT_URL)
    .set("Idempotency-Key", crypto.randomUUID())
    .send({
      accountNumber: account.accountNumber,
      amount: INITIAL_BALANCE,
    });

  expect(response.status).toBe(201);

  return account;
}

async function getBalance(accountNumber: string): Promise<number> {
  const response = await request(app).get(
    `/api/v1/banking/${accountNumber}/balance`
  );

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

async function withdraw(
  accountNumber: string,
  amount: string,
  idempotencyKey = crypto.randomUUID()
) {
  return request(app)
    .post(WITHDRAW_URL)
    .set("Idempotency-Key", idempotencyKey)
    .send({ accountNumber, amount });
}

describe("Withdraw API", () => {
  it("should withdraw money successfully", async () => {
    const account = await createFundedAccount();

    const response = await withdraw(account.accountNumber, "500.00");

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.transactionId).toBeDefined();
    expect(response.body.data.reference).toBeDefined();

    expect(await transactionCount()).toBe(2);
    expect(await ledgerEntryCount()).toBe(4);
    expect(await getBalance(account.accountNumber)).toBe(500);
  });

  it("should persist a balanced withdrawal transaction and ledger entries", async () => {
    const account = await createFundedAccount();

    const response = await withdraw(account.accountNumber, "500.00");
    const withdrawal = response.body.data as WithdrawalResponse;

    const transaction = await query<{
      id: string;
      reference: string;
      description: string | null;
    }>(
      "SELECT id, reference, description FROM transactions WHERE id = $1",
      [withdrawal.transactionId]
    );
    const entries = await query<{
      transaction_id: string;
      ledger_account_id: string;
      entry_type: "DEBIT" | "CREDIT";
      amount: string;
      account_name: string;
    }>(
      `
      SELECT le.transaction_id, le.ledger_account_id, le.entry_type, le.amount, la.name AS account_name
      FROM ledger_entries le
      INNER JOIN ledger_accounts la ON la.id = le.ledger_account_id
      WHERE le.transaction_id = $1
      ORDER BY le.entry_type, la.name;
      `,
      [withdrawal.transactionId]
    );
    const totals = await query<{ debit_total: string; credit_total: string }>(
      `
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE entry_type = 'DEBIT'), 0)::text AS debit_total,
        COALESCE(SUM(amount) FILTER (WHERE entry_type = 'CREDIT'), 0)::text AS credit_total
      FROM ledger_entries
      WHERE transaction_id = $1;
      `,
      [withdrawal.transactionId]
    );
    const bankAccount = await query<{ account_number: string; status: string }>(
      "SELECT account_number, status FROM bank_accounts WHERE id = $1",
      [account.id]
    );

    expect(transaction.rows).toEqual([
      {
        id: withdrawal.transactionId,
        reference: withdrawal.reference,
        description: "Cash Withdrawal",
      },
    ]);
    expect(entries.rows).toHaveLength(2);
    expect(entries.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          transaction_id: withdrawal.transactionId,
          entry_type: "DEBIT",
          amount: "500.00",
          account_name: `Customer account ${account.accountNumber}`,
        }),
        expect.objectContaining({
          transaction_id: withdrawal.transactionId,
          entry_type: "CREDIT",
          amount: "500.00",
          account_name: "Cash",
        }),
      ])
    );
    expect(Number(totals.rows[0].debit_total)).toBe(500);
    expect(totals.rows[0].debit_total).toBe(totals.rows[0].credit_total);
    expect(bankAccount.rows).toEqual([
      { account_number: account.accountNumber, status: "ACTIVE" },
    ]);
  });

  it("should reject missing account number", async () => {
    await createFundedAccount();

    const response = await request(app)
      .post(WITHDRAW_URL)
      .set("Idempotency-Key", crypto.randomUUID())
      .send({ amount: "500" });

    expect(response.status).toBe(400);
    expect(await transactionCount()).toBe(1);
    expect(await ledgerEntryCount()).toBe(2);
  });

  it("should reject missing amount", async () => {
    const account = await createFundedAccount();

    const response = await request(app)
      .post(WITHDRAW_URL)
      .set("Idempotency-Key", crypto.randomUUID())
      .send({ accountNumber: account.accountNumber });

    expect(response.status).toBe(400);
    expect(await transactionCount()).toBe(1);
    expect(await ledgerEntryCount()).toBe(2);
  });

  it("should reject an invalid account number", async () => {
    await createFundedAccount();

    const response = await withdraw("9999999999", "500");

    expect(response.status).toBe(404);
    expect(await transactionCount()).toBe(1);
    expect(await ledgerEntryCount()).toBe(2);
  });

  it("should reject an invalid amount", async () => {
    const account = await createFundedAccount();

    const response = await withdraw(account.accountNumber, "not-a-number");

    expect(response.status).toBe(400);
    expect(await transactionCount()).toBe(1);
    expect(await ledgerEntryCount()).toBe(2);
  });

  it("should reject a zero amount", async () => {
    const account = await createFundedAccount();

    const response = await withdraw(account.accountNumber, "0");

    expect(response.status).toBe(400);
    expect(await transactionCount()).toBe(1);
    expect(await ledgerEntryCount()).toBe(2);
  });

  it("should reject a negative amount", async () => {
    const account = await createFundedAccount();

    const response = await withdraw(account.accountNumber, "-100");

    expect(response.status).toBe(400);
    expect(await transactionCount()).toBe(1);
    expect(await ledgerEntryCount()).toBe(2);
  });

  it("should reject an invalid request body", async () => {
    await createFundedAccount();

    const response = await request(app)
      .post(WITHDRAW_URL)
      .set("Idempotency-Key", crypto.randomUUID())
      .send({});

    expect(response.status).toBe(400);
    expect(await transactionCount()).toBe(1);
    expect(await ledgerEntryCount()).toBe(2);
  });

  it("should reject a withdrawal from a BLOCKED account", async () => {
    const account = await createFundedAccount();
    await query("UPDATE bank_accounts SET status = 'BLOCKED' WHERE id = $1", [account.id]);

    const response = await withdraw(account.accountNumber, "500");

    expect(response.status).toBe(409);
    expect(await transactionCount()).toBe(1);
    expect(await ledgerEntryCount()).toBe(2);
    expect(await getBalance(account.accountNumber)).toBe(1000);
  });

  it("should reject a withdrawal from a CLOSED account", async () => {
    const account = await createFundedAccount();
    await query("UPDATE bank_accounts SET status = 'CLOSED' WHERE id = $1", [account.id]);

    const response = await withdraw(account.accountNumber, "500");

    expect(response.status).toBe(409);
    expect(await transactionCount()).toBe(1);
    expect(await ledgerEntryCount()).toBe(2);
    expect(await getBalance(account.accountNumber)).toBe(1000);
  });

  it("should reject a withdrawal greater than the available balance", async () => {
    const account = await createFundedAccount();

    const response = await withdraw(account.accountNumber, "1000.01");

    expect(response.status).toBe(409);
    expect(response.body.message).toBe("Insufficient funds for withdrawal.");
    expect(await transactionCount()).toBe(1);
    expect(await ledgerEntryCount()).toBe(2);
    expect(await getBalance(account.accountNumber)).toBe(1000);
  });

  it("should withdraw the entire balance", async () => {
    const account = await createFundedAccount();

    const response = await withdraw(account.accountNumber, INITIAL_BALANCE);

    expect(response.status).toBe(201);
    expect(await getBalance(account.accountNumber)).toBe(0);
  });

  it("should withdraw a remaining rupee", async () => {
    const account = await createFundedAccount();

    const firstResponse = await withdraw(account.accountNumber, "999.00");
    const secondResponse = await withdraw(account.accountNumber, "1.00");

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(201);
    expect(await getBalance(account.accountNumber)).toBe(0);
  });

  it("should reject a withdrawal after the balance reaches zero", async () => {
    const account = await createFundedAccount();
    await withdraw(account.accountNumber, INITIAL_BALANCE);

    const response = await withdraw(account.accountNumber, "1.00");

    expect(response.status).toBe(409);
    expect(await transactionCount()).toBe(2);
    expect(await ledgerEntryCount()).toBe(4);
    expect(await getBalance(account.accountNumber)).toBe(0);
  });

  it("should reject a missing idempotency key", async () => {
    const account = await createFundedAccount();

    const response = await request(app)
      .post(WITHDRAW_URL)
      .send({ accountNumber: account.accountNumber, amount: "500" });

    expect(response.status).toBe(400);
    expect(await transactionCount()).toBe(1);
    expect(await ledgerEntryCount()).toBe(2);
  });

  it("should replay the response for a duplicate idempotency key", async () => {
    const account = await createFundedAccount();
    const key = crypto.randomUUID();

    const first = await withdraw(account.accountNumber, "500", key);
    const second = await withdraw(account.accountNumber, "500", key);

    expect(first.status).toBe(201);
    expect(second.status).toBe(first.status);
    expect(second.body).toEqual(first.body);
    expect(await transactionCount()).toBe(2);
    expect(await ledgerEntryCount()).toBe(4);
    expect(await getBalance(account.accountNumber)).toBe(500);
  });

  it("should reject an idempotency key reused with a different request hash", async () => {
    const account = await createFundedAccount();
    const key = crypto.randomUUID();

    const first = await withdraw(account.accountNumber, "500", key);
    const second = await withdraw(account.accountNumber, "400", key);

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    expect(second.body.message).toBe("Request Hash Mismatch");
    expect(await transactionCount()).toBe(2);
    expect(await ledgerEntryCount()).toBe(4);
    expect(await getBalance(account.accountNumber)).toBe(500);
  });

  it("should roll back all writes when a ledger insert fails", async () => {
    const account = await createFundedAccount();
    await query(`
      CREATE FUNCTION fail_withdrawal_credit()
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
      CREATE TRIGGER fail_withdrawal_credit_trigger
      BEFORE INSERT ON ledger_entries
      FOR EACH ROW
      EXECUTE FUNCTION fail_withdrawal_credit();
    `);

    const response = await withdraw(account.accountNumber, "500");

    expect(response.status).toBe(500);
    expect(await transactionCount()).toBe(1);
    expect(await ledgerEntryCount()).toBe(2);
    expect(await getBalance(account.accountNumber)).toBe(1000);
  });
});
