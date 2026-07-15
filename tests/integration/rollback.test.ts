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

beforeEach(async () => {
  await resetDatabase();
});

afterEach(async () => {
  await query("DROP TRIGGER IF EXISTS fail_rollback_ledger_trigger ON ledger_entries;");
  await query("DROP FUNCTION IF EXISTS fail_rollback_ledger();");
  await query("DROP TRIGGER IF EXISTS fail_rollback_transaction_trigger ON transactions;");
  await query("DROP FUNCTION IF EXISTS fail_rollback_transaction();");
  await query("DROP TRIGGER IF EXISTS fail_rollback_idempotency_trigger ON idempotency_keys;");
  await query("DROP FUNCTION IF EXISTS fail_rollback_idempotency();");
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

async function fundAccount(accountNumber: string, amount = "1000.00"): Promise<void> {
  const response = await request(app)
    .post(DEPOSIT_URL)
    .set("Idempotency-Key", crypto.randomUUID())
    .send({ accountNumber, amount });

  expect(response.status).toBe(201);
}

async function getBalance(accountNumber: string): Promise<string> {
  const response = await request(app).get(`/api/v1/banking/${accountNumber}/balance`);

  expect(response.status).toBe(200);

  return response.body.data.balance as string;
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

async function createLedgerFailureTrigger(failOn: "DEBIT" | "CREDIT") {
  await query(`
    CREATE FUNCTION fail_rollback_ledger()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF NEW.entry_type = '${failOn}' THEN
        RAISE EXCEPTION 'forced ledger failure';
      END IF;
      RETURN NEW;
    END;
    $$;
  `);
  await query(`
    CREATE TRIGGER fail_rollback_ledger_trigger
    BEFORE INSERT ON ledger_entries
    FOR EACH ROW
    EXECUTE FUNCTION fail_rollback_ledger();
  `);
}

describe("Banking Transaction Rollback API", () => {
  it("should roll back a deposit when the first ledger insert fails after transaction creation", async () => {
    const { sender } = await createAccounts();
    await createLedgerFailureTrigger("DEBIT");

    const response = await request(app)
      .post(DEPOSIT_URL)
      .set("Idempotency-Key", crypto.randomUUID())
      .send({ accountNumber: sender.accountNumber, amount: "500.00" });

    expect(response.status).toBe(500);
    expect(await transactionCount()).toBe(0);
    expect(await ledgerEntryCount()).toBe(0);
    expect(await getBalance(sender.accountNumber)).toBe("0.00");
  });

  it("should roll back a withdrawal after the debit entry and before the credit entry", async () => {
    const { sender } = await createAccounts();
    await fundAccount(sender.accountNumber);
    await createLedgerFailureTrigger("CREDIT");

    const response = await request(app)
      .post(WITHDRAW_URL)
      .set("Idempotency-Key", crypto.randomUUID())
      .send({ accountNumber: sender.accountNumber, amount: "300.00" });

    expect(response.status).toBe(500);
    expect(await transactionCount()).toBe(1);
    expect(await ledgerEntryCount()).toBe(2);
    expect(await getBalance(sender.accountNumber)).toBe("1000.00");
  });

  it("should roll back a transfer after the sender debit and before the cash credit", async () => {
    const { sender, receiver } = await createAccounts();
    await fundAccount(sender.accountNumber);
    await createLedgerFailureTrigger("CREDIT");

    const response = await request(app)
      .post(TRANSFER_URL)
      .set("Idempotency-Key", crypto.randomUUID())
      .send({
        fromAccountNumber: sender.accountNumber,
        toAccountNumber: receiver.accountNumber,
        amount: "200.00",
      });

    expect(response.status).toBe(500);
    expect(await transactionCount()).toBe(1);
    expect(await ledgerEntryCount()).toBe(2);
    expect(await getBalance(sender.accountNumber)).toBe("1000.00");
    expect(await getBalance(receiver.accountNumber)).toBe("0.00");
  });

  it("should roll back when transaction creation fails", async () => {
    const { sender } = await createAccounts();
    await query(`
      CREATE FUNCTION fail_rollback_transaction()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RAISE EXCEPTION 'forced transaction failure';
      END;
      $$;
    `);
    await query(`
      CREATE TRIGGER fail_rollback_transaction_trigger
      BEFORE INSERT ON transactions
      FOR EACH ROW
      EXECUTE FUNCTION fail_rollback_transaction();
    `);

    const response = await request(app)
      .post(DEPOSIT_URL)
      .set("Idempotency-Key", crypto.randomUUID())
      .send({ accountNumber: sender.accountNumber, amount: "500.00" });

    expect(response.status).toBe(500);
    expect(await transactionCount()).toBe(0);
    expect(await ledgerEntryCount()).toBe(0);
    expect(await getBalance(sender.accountNumber)).toBe("0.00");
  });

  it("should roll back banking writes when completing the idempotency record fails", async () => {
    const { sender } = await createAccounts();
    await query(`
      CREATE FUNCTION fail_rollback_idempotency()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        IF NEW.status = 'COMPLETED' THEN
          RAISE EXCEPTION 'forced idempotency completion failure';
        END IF;
        RETURN NEW;
      END;
      $$;
    `);
    await query(`
      CREATE TRIGGER fail_rollback_idempotency_trigger
      BEFORE UPDATE ON idempotency_keys
      FOR EACH ROW
      EXECUTE FUNCTION fail_rollback_idempotency();
    `);

    const response = await request(app)
      .post(DEPOSIT_URL)
      .set("Idempotency-Key", crypto.randomUUID())
      .send({ accountNumber: sender.accountNumber, amount: "500.00" });

    expect(response.status).toBe(500);
    expect(await transactionCount()).toBe(0);
    expect(await ledgerEntryCount()).toBe(0);
    expect(await getBalance(sender.accountNumber)).toBe("0.00");
  });

  it("should release locks after rollback so a subsequent withdrawal succeeds", async () => {
    const { sender } = await createAccounts();
    await fundAccount(sender.accountNumber);
    const key = crypto.randomUUID();
    await createLedgerFailureTrigger("CREDIT");

    const failed = await request(app)
      .post(WITHDRAW_URL)
      .set("Idempotency-Key", key)
      .send({ accountNumber: sender.accountNumber, amount: "300.00" });
    await query("DROP TRIGGER fail_rollback_ledger_trigger ON ledger_entries;");
    await query("DROP FUNCTION fail_rollback_ledger();");

    const retried = await request(app)
      .post(WITHDRAW_URL)
      .set("Idempotency-Key", key)
      .send({ accountNumber: sender.accountNumber, amount: "300.00" });

    expect(failed.status).toBe(500);
    expect(retried.status).toBe(201);
    expect(await transactionCount()).toBe(2);
    expect(await ledgerEntryCount()).toBe(4);
    expect(await getBalance(sender.accountNumber)).toBe("700.00");
  });
});
