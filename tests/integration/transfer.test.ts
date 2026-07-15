import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import app from "../helpers/app";
import { resetDatabase } from "../helpers/database";
import { query } from "../../src/database/database";

const CUSTOMER_URL = "/api/v1/customers/create-customer";
const ACCOUNT_URL = "/api/v1/accounts";
const DEPOSIT_URL = "/api/v1/banking/deposit";
const TRANSFER_URL = "/api/v1/banking/transfer";

const SENDER_ACCOUNT_NUMBER = "1000000001";
const RECEIVER_ACCOUNT_NUMBER = "1000000002";
const INITIAL_SENDER_BALANCE = "5000.00";

interface AccountResponse {
  id: string;
  accountNumber: string;
}

interface TransferResponse {
  transactionId: string;
  reference: string;
}

interface FundedAccounts {
  sender: AccountResponse;
  receiver: AccountResponse;
}

beforeEach(async () => {
  await resetDatabase();
});

afterEach(async () => {
  await query("DROP TRIGGER IF EXISTS fail_transfer_credit_trigger ON ledger_entries;");
  await query("DROP FUNCTION IF EXISTS fail_transfer_credit();");
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

async function createFundedAccounts(): Promise<FundedAccounts> {
  const senderCustomer = await createCustomer(
    "Santhosh",
    "santhosh@gmail.com",
    "9876543210"
  );
  const sender = await createAccount(senderCustomer.id, SENDER_ACCOUNT_NUMBER);

  const deposit = await request(app)
    .post(DEPOSIT_URL)
    .set("Idempotency-Key", crypto.randomUUID())
    .send({
      accountNumber: sender.accountNumber,
      amount: INITIAL_SENDER_BALANCE,
    });

  expect(deposit.status).toBe(201);

  const receiverCustomer = await createCustomer(
    "Priya",
    "priya@gmail.com",
    "9876543211"
  );
  const receiver = await createAccount(receiverCustomer.id, RECEIVER_ACCOUNT_NUMBER);

  return { sender, receiver };
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

async function transfer(
  fromAccountNumber: string,
  toAccountNumber: string,
  amount: string,
  idempotencyKey = crypto.randomUUID()
) {
  return request(app)
    .post(TRANSFER_URL)
    .set("Idempotency-Key", idempotencyKey)
    .send({ fromAccountNumber, toAccountNumber, amount });
}

describe("Transfer API", () => {
  it("should transfer money successfully", async () => {
    const { sender, receiver } = await createFundedAccounts();

    const response = await transfer(
      sender.accountNumber,
      receiver.accountNumber,
      "500.00"
    );

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.transactionId).toBeDefined();
    expect(response.body.data.reference).toBeDefined();
    expect(await transactionCount()).toBe(2);
    expect(await ledgerEntryCount()).toBe(6);
    expect(await getBalance(sender.accountNumber)).toBe(4500);
    expect(await getBalance(receiver.accountNumber)).toBe(500);
  });

  it("should persist four balanced ledger entries for the same transfer transaction", async () => {
    const { sender, receiver } = await createFundedAccounts();

    const response = await transfer(sender.accountNumber, receiver.accountNumber, "500.00");
    const result = response.body.data as TransferResponse;

    const transaction = await query<{
      id: string;
      reference: string;
      description: string | null;
    }>(
      "SELECT id, reference, description FROM transactions WHERE id = $1",
      [result.transactionId]
    );
    const entries = await query<{
      transaction_id: string;
      entry_type: "DEBIT" | "CREDIT";
      amount: string;
      account_name: string;
    }>(
      `
      SELECT le.transaction_id, le.entry_type, le.amount, la.name AS account_name
      FROM ledger_entries le
      INNER JOIN ledger_accounts la ON la.id = le.ledger_account_id
      WHERE le.transaction_id = $1
      ORDER BY le.created_at, le.id;
      `,
      [result.transactionId]
    );
    const totals = await query<{ debit_total: string; credit_total: string }>(
      `
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE entry_type = 'DEBIT'), 0)::text AS debit_total,
        COALESCE(SUM(amount) FILTER (WHERE entry_type = 'CREDIT'), 0)::text AS credit_total
      FROM ledger_entries
      WHERE transaction_id = $1;
      `,
      [result.transactionId]
    );
    const accounts = await query<{ account_number: string; status: string }>(
      "SELECT account_number, status FROM bank_accounts ORDER BY account_number"
    );

    expect(transaction.rows).toEqual([
      {
        id: result.transactionId,
        reference: result.reference,
        description: "Transfer",
      },
    ]);
    expect(entries.rows).toHaveLength(4);
    expect(entries.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          transaction_id: result.transactionId,
          entry_type: "DEBIT",
          amount: "500.00",
          account_name: `Customer account ${sender.accountNumber}`,
        }),
        expect.objectContaining({
          transaction_id: result.transactionId,
          entry_type: "CREDIT",
          amount: "500.00",
          account_name: "Cash",
        }),
        expect.objectContaining({
          transaction_id: result.transactionId,
          entry_type: "DEBIT",
          amount: "500.00",
          account_name: "Cash",
        }),
        expect.objectContaining({
          transaction_id: result.transactionId,
          entry_type: "CREDIT",
          amount: "500.00",
          account_name: `Customer account ${receiver.accountNumber}`,
        }),
      ])
    );
    expect(Number(totals.rows[0].debit_total)).toBe(1000);
    expect(totals.rows[0].debit_total).toBe(totals.rows[0].credit_total);
    expect(accounts.rows).toEqual([
      { account_number: sender.accountNumber, status: "ACTIVE" },
      { account_number: receiver.accountNumber, status: "ACTIVE" },
    ]);
  });

  it("should conserve money across sender and receiver balances", async () => {
    const { sender, receiver } = await createFundedAccounts();
    const beforeTotal =
      (await getBalance(sender.accountNumber)) +
      (await getBalance(receiver.accountNumber));

    const response = await transfer(sender.accountNumber, receiver.accountNumber, "500");
    const afterTotal =
      (await getBalance(sender.accountNumber)) +
      (await getBalance(receiver.accountNumber));

    expect(response.status).toBe(201);
    expect(beforeTotal).toBe(5000);
    expect(afterTotal).toBe(5000);
  });

  it("should reject a missing sender account number", async () => {
    const { receiver } = await createFundedAccounts();

    const response = await request(app)
      .post(TRANSFER_URL)
      .set("Idempotency-Key", crypto.randomUUID())
      .send({ toAccountNumber: receiver.accountNumber, amount: "500" });

    expect(response.status).toBe(400);
    expect(await transactionCount()).toBe(1);
    expect(await ledgerEntryCount()).toBe(2);
  });

  it("should reject a missing receiver account number", async () => {
    const { sender } = await createFundedAccounts();

    const response = await request(app)
      .post(TRANSFER_URL)
      .set("Idempotency-Key", crypto.randomUUID())
      .send({ fromAccountNumber: sender.accountNumber, amount: "500" });

    expect(response.status).toBe(400);
    expect(await transactionCount()).toBe(1);
    expect(await ledgerEntryCount()).toBe(2);
  });

  it("should reject a missing amount", async () => {
    const { sender, receiver } = await createFundedAccounts();

    const response = await request(app)
      .post(TRANSFER_URL)
      .set("Idempotency-Key", crypto.randomUUID())
      .send({
        fromAccountNumber: sender.accountNumber,
        toAccountNumber: receiver.accountNumber,
      });

    expect(response.status).toBe(400);
    expect(await transactionCount()).toBe(1);
    expect(await ledgerEntryCount()).toBe(2);
  });

  it("should reject an invalid idempotency key", async () => {
    const { sender, receiver } = await createFundedAccounts();

    const response = await request(app)
      .post(TRANSFER_URL)
      .set("Idempotency-Key", "not-a-uuid")
      .send({
        fromAccountNumber: sender.accountNumber,
        toAccountNumber: receiver.accountNumber,
        amount: "500",
      });

    expect(response.status).toBe(400);
    expect(await transactionCount()).toBe(1);
    expect(await ledgerEntryCount()).toBe(2);
  });

  it("should reject an invalid amount", async () => {
    const { sender, receiver } = await createFundedAccounts();

    const response = await transfer(sender.accountNumber, receiver.accountNumber, "invalid");

    expect(response.status).toBe(400);
    expect(await transactionCount()).toBe(1);
    expect(await ledgerEntryCount()).toBe(2);
  });

  it("should reject a negative amount", async () => {
    const { sender, receiver } = await createFundedAccounts();

    const response = await transfer(sender.accountNumber, receiver.accountNumber, "-500");

    expect(response.status).toBe(400);
    expect(await transactionCount()).toBe(1);
    expect(await ledgerEntryCount()).toBe(2);
  });

  it("should reject a zero amount", async () => {
    const { sender, receiver } = await createFundedAccounts();

    const response = await transfer(sender.accountNumber, receiver.accountNumber, "0");

    expect(response.status).toBe(400);
    expect(await transactionCount()).toBe(1);
    expect(await ledgerEntryCount()).toBe(2);
  });

  it("should reject an invalid request body", async () => {
    await createFundedAccounts();

    const response = await request(app)
      .post(TRANSFER_URL)
      .set("Idempotency-Key", crypto.randomUUID())
      .send({});

    expect(response.status).toBe(400);
    expect(await transactionCount()).toBe(1);
    expect(await ledgerEntryCount()).toBe(2);
  });

  it("should reject a missing sender account", async () => {
    const { receiver } = await createFundedAccounts();

    const response = await transfer("9999999999", receiver.accountNumber, "500");

    expect(response.status).toBe(404);
    expect(await transactionCount()).toBe(1);
    expect(await ledgerEntryCount()).toBe(2);
  });

  it("should reject a missing receiver account", async () => {
    const { sender } = await createFundedAccounts();

    const response = await transfer(sender.accountNumber, "9999999999", "500");

    expect(response.status).toBe(404);
    expect(await transactionCount()).toBe(1);
    expect(await ledgerEntryCount()).toBe(2);
  });

  it("should reject a transfer to the sender account", async () => {
    const { sender } = await createFundedAccounts();

    const response = await transfer(sender.accountNumber, sender.accountNumber, "500");

    expect(response.status).toBe(409);
    expect(response.body.message).toBe("Sender and receiver accounts must be different.");
    expect(await transactionCount()).toBe(1);
    expect(await ledgerEntryCount()).toBe(2);
  });

  it("should reject a transfer that exceeds the sender balance", async () => {
    const { sender, receiver } = await createFundedAccounts();

    const response = await transfer(sender.accountNumber, receiver.accountNumber, "5000.01");

    expect(response.status).toBe(409);
    expect(response.body.message).toBe("Insufficient funds for transfer.");
    expect(await getBalance(sender.accountNumber)).toBe(5000);
    expect(await getBalance(receiver.accountNumber)).toBe(0);
  });

  it("should reject a transfer from a BLOCKED sender", async () => {
    const { sender, receiver } = await createFundedAccounts();
    await query("UPDATE bank_accounts SET status = 'BLOCKED' WHERE id = $1", [sender.id]);

    const response = await transfer(sender.accountNumber, receiver.accountNumber, "500");

    expect(response.status).toBe(409);
    expect(await getBalance(sender.accountNumber)).toBe(5000);
    expect(await getBalance(receiver.accountNumber)).toBe(0);
  });

  it("should reject a transfer to a BLOCKED receiver", async () => {
    const { sender, receiver } = await createFundedAccounts();
    await query("UPDATE bank_accounts SET status = 'BLOCKED' WHERE id = $1", [receiver.id]);

    const response = await transfer(sender.accountNumber, receiver.accountNumber, "500");

    expect(response.status).toBe(409);
    expect(await getBalance(sender.accountNumber)).toBe(5000);
    expect(await getBalance(receiver.accountNumber)).toBe(0);
  });

  it("should reject a transfer from a CLOSED sender", async () => {
    const { sender, receiver } = await createFundedAccounts();
    await query("UPDATE bank_accounts SET status = 'CLOSED' WHERE id = $1", [sender.id]);

    const response = await transfer(sender.accountNumber, receiver.accountNumber, "500");

    expect(response.status).toBe(409);
    expect(await getBalance(sender.accountNumber)).toBe(5000);
    expect(await getBalance(receiver.accountNumber)).toBe(0);
  });

  it("should reject a transfer to a CLOSED receiver", async () => {
    const { sender, receiver } = await createFundedAccounts();
    await query("UPDATE bank_accounts SET status = 'CLOSED' WHERE id = $1", [receiver.id]);

    const response = await transfer(sender.accountNumber, receiver.accountNumber, "500");

    expect(response.status).toBe(409);
    expect(await getBalance(sender.accountNumber)).toBe(5000);
    expect(await getBalance(receiver.accountNumber)).toBe(0);
  });

  it("should reject a missing idempotency key", async () => {
    const { sender, receiver } = await createFundedAccounts();

    const response = await request(app)
      .post(TRANSFER_URL)
      .send({
        fromAccountNumber: sender.accountNumber,
        toAccountNumber: receiver.accountNumber,
        amount: "500",
      });

    expect(response.status).toBe(400);
    expect(await transactionCount()).toBe(1);
    expect(await ledgerEntryCount()).toBe(2);
  });

  it("should replay the response for a duplicate idempotency key", async () => {
    const { sender, receiver } = await createFundedAccounts();
    const key = crypto.randomUUID();

    const first = await transfer(sender.accountNumber, receiver.accountNumber, "500", key);
    const second = await transfer(sender.accountNumber, receiver.accountNumber, "500", key);

    expect(first.status).toBe(201);
    expect(second.status).toBe(first.status);
    expect(second.body).toEqual(first.body);
    expect(await transactionCount()).toBe(2);
    expect(await ledgerEntryCount()).toBe(6);
    expect(await getBalance(sender.accountNumber)).toBe(4500);
    expect(await getBalance(receiver.accountNumber)).toBe(500);
  });

  it("should reject an idempotency key reused with a different request hash", async () => {
    const { sender, receiver } = await createFundedAccounts();
    const key = crypto.randomUUID();

    const first = await transfer(sender.accountNumber, receiver.accountNumber, "500", key);
    const second = await transfer(sender.accountNumber, receiver.accountNumber, "400", key);

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    expect(second.body.message).toBe("Request Hash Mismatch");
    expect(await transactionCount()).toBe(2);
    expect(await ledgerEntryCount()).toBe(6);
  });

  it("should roll back all writes when a ledger insert fails", async () => {
    const { sender, receiver } = await createFundedAccounts();
    await query(`
      CREATE FUNCTION fail_transfer_credit()
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
      CREATE TRIGGER fail_transfer_credit_trigger
      BEFORE INSERT ON ledger_entries
      FOR EACH ROW
      EXECUTE FUNCTION fail_transfer_credit();
    `);

    const response = await transfer(sender.accountNumber, receiver.accountNumber, "500");

    expect(response.status).toBe(500);
    expect(await transactionCount()).toBe(1);
    expect(await ledgerEntryCount()).toBe(2);
    expect(await getBalance(sender.accountNumber)).toBe(5000);
    expect(await getBalance(receiver.accountNumber)).toBe(0);
  });

  it("should preserve balances and prevent negative money during concurrent transfers", async () => {
    const { sender, receiver } = await createFundedAccounts();

    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        transfer(sender.accountNumber, receiver.accountNumber, "500")
      )
    );
    const senderBalance = await getBalance(sender.accountNumber);
    const receiverBalance = await getBalance(receiver.accountNumber);

    expect(responses).toHaveLength(10);
    expect(responses.every((response) => response.status === 201)).toBe(true);
    expect(await transactionCount()).toBe(11);
    expect(await ledgerEntryCount()).toBe(42);
    expect(senderBalance).toBe(0);
    expect(receiverBalance).toBe(5000);
    expect(senderBalance).toBeGreaterThanOrEqual(0);
    expect(receiverBalance).toBeGreaterThanOrEqual(0);
    expect(senderBalance + receiverBalance).toBe(5000);
  });
});
