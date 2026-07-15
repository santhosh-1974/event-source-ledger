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
const TRANSACTION_URL = "/api/v1/transactions";

interface AccountResponse {
  id: string;
  accountNumber: string;
}

interface OperationResponse {
  transactionId: string;
  reference: string;
}

interface TransactionEntry {
  id: string;
  transactionId: string;
  ledgerAccountId: string;
  bankAccountId: string | null;
  ledgerAccountName: string;
  entryType: "DEBIT" | "CREDIT";
  amount: string;
  createdAt: string;
}

interface TransactionDetails {
  transactionId: string;
  reference: string;
  type: string | null;
  createdAt: string;
  entries: TransactionEntry[];
  debitEntries: TransactionEntry[];
  creditEntries: TransactionEntry[];
}

interface TransactionSetup {
  sender: AccountResponse;
  receiver: AccountResponse;
  deposit: OperationResponse;
  withdrawal: OperationResponse;
  transfer: OperationResponse;
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

async function createTransactionSetup(): Promise<TransactionSetup> {
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

  const depositResponse = await request(app)
    .post(DEPOSIT_URL)
    .set("Idempotency-Key", crypto.randomUUID())
    .send({ accountNumber: sender.accountNumber, amount: "1000.00" });
  const withdrawalResponse = await request(app)
    .post(WITHDRAW_URL)
    .set("Idempotency-Key", crypto.randomUUID())
    .send({ accountNumber: sender.accountNumber, amount: "300.00" });
  const transferResponse = await request(app)
    .post(TRANSFER_URL)
    .set("Idempotency-Key", crypto.randomUUID())
    .send({
      fromAccountNumber: sender.accountNumber,
      toAccountNumber: receiver.accountNumber,
      amount: "200.00",
    });

  expect(depositResponse.status).toBe(201);
  expect(withdrawalResponse.status).toBe(201);
  expect(transferResponse.status).toBe(201);

  return {
    sender,
    receiver,
    deposit: depositResponse.body.data as OperationResponse,
    withdrawal: withdrawalResponse.body.data as OperationResponse,
    transfer: transferResponse.body.data as OperationResponse,
  };
}

async function getTransaction(transactionId: string) {
  return request(app).get(`${TRANSACTION_URL}/${transactionId}`);
}

async function expectTransactionMatchesDatabase(transactionId: string): Promise<void> {
  const response = await getTransaction(transactionId);
  const details = response.body.data as TransactionDetails;
  const transaction = await query<{
    id: string;
    reference: string;
    description: string | null;
    created_at: Date;
  }>(
    "SELECT id, reference, description, created_at FROM transactions WHERE id = $1",
    [transactionId]
  );
  const entries = await query<{
    id: string;
    transaction_id: string;
    ledger_account_id: string;
    bank_account_id: string | null;
    ledger_account_name: string;
    entry_type: "DEBIT" | "CREDIT";
    amount: string;
    created_at: Date;
  }>(
    `
    SELECT
      le.id,
      le.transaction_id,
      le.ledger_account_id,
      la.bank_account_id,
      la.name AS ledger_account_name,
      le.entry_type,
      le.amount,
      le.created_at
    FROM ledger_entries le
    INNER JOIN ledger_accounts la ON la.id = le.ledger_account_id
    WHERE le.transaction_id = $1
    ORDER BY le.created_at ASC, le.id ASC;
    `,
    [transactionId]
  );
  const expectedEntries = entries.rows.map((entry) => ({
    id: entry.id,
    transactionId: entry.transaction_id,
    ledgerAccountId: entry.ledger_account_id,
    bankAccountId: entry.bank_account_id,
    ledgerAccountName: entry.ledger_account_name,
    entryType: entry.entry_type,
    amount: entry.amount,
    createdAt: entry.created_at.toISOString(),
  }));

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);
  expect(details).toEqual({
    transactionId: transaction.rows[0].id,
    reference: transaction.rows[0].reference,
    type: transaction.rows[0].description,
    createdAt: transaction.rows[0].created_at.toISOString(),
    entries: expectedEntries,
    debitEntries: expectedEntries.filter((entry) => entry.entryType === "DEBIT"),
    creditEntries: expectedEntries.filter((entry) => entry.entryType === "CREDIT"),
  });
}

describe("Transaction Details API", () => {
  it("should retrieve an existing deposit transaction completely", async () => {
    const setup = await createTransactionSetup();

    await expectTransactionMatchesDatabase(setup.deposit.transactionId);

    const response = await getTransaction(setup.deposit.transactionId);
    const details = response.body.data as TransactionDetails;
    expect(details.reference).toBe(setup.deposit.reference);
    expect(details.type).toBe("Cash Deposit");
    expect(details.entries).toHaveLength(2);
    expect(details.debitEntries).toHaveLength(1);
    expect(details.creditEntries).toHaveLength(1);
    expect(details.entries.map((entry) => entry.amount)).toEqual(["1000.00", "1000.00"]);
  });

  it("should retrieve a withdrawal transaction with debit and credit entries", async () => {
    const setup = await createTransactionSetup();

    await expectTransactionMatchesDatabase(setup.withdrawal.transactionId);

    const response = await getTransaction(setup.withdrawal.transactionId);
    const details = response.body.data as TransactionDetails;
    expect(details.reference).toBe(setup.withdrawal.reference);
    expect(details.type).toBe("Cash Withdrawal");
    expect(details.entries).toHaveLength(2);
    expect(details.debitEntries).toHaveLength(1);
    expect(details.creditEntries).toHaveLength(1);
    expect(details.entries.map((entry) => entry.amount)).toEqual(["300.00", "300.00"]);
    expect(details.debitEntries[0].bankAccountId).toBe(setup.sender.id);
    expect(details.creditEntries[0].ledgerAccountName).toBe("Cash");
  });

  it("should retrieve a transfer transaction with four ledger entries", async () => {
    const setup = await createTransactionSetup();

    await expectTransactionMatchesDatabase(setup.transfer.transactionId);

    const response = await getTransaction(setup.transfer.transactionId);
    const details = response.body.data as TransactionDetails;
    const accountIds = details.entries
      .map((entry) => entry.bankAccountId)
      .filter((id): id is string => id !== null)
      .sort();

    expect(details.reference).toBe(setup.transfer.reference);
    expect(details.type).toBe("Transfer");
    expect(details.entries).toHaveLength(4);
    expect(details.debitEntries).toHaveLength(2);
    expect(details.creditEntries).toHaveLength(2);
    expect(details.entries.map((entry) => entry.amount)).toEqual([
      "200.00",
      "200.00",
      "200.00",
      "200.00",
    ]);
    expect(accountIds).toEqual([setup.receiver.id, setup.sender.id].sort());
    expect(details.entries.every((entry) => entry.transactionId === setup.transfer.transactionId)).toBe(true);
  });

  it("should return a unique reference and an ISO timestamp", async () => {
    const setup = await createTransactionSetup();
    const response = await getTransaction(setup.transfer.transactionId);
    const details = response.body.data as TransactionDetails;
    const referenceCount = await query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM transactions WHERE reference = $1",
      [details.reference]
    );

    expect(response.status).toBe(200);
    expect(details.transactionId).toBe(setup.transfer.transactionId);
    expect(details.reference).toBe(setup.transfer.reference);
    expect(Number(referenceCount.rows[0].count)).toBe(1);
    expect(new Date(details.createdAt).toISOString()).toBe(details.createdAt);
  });

  it("should return a very old transaction using its persisted timestamp", async () => {
    const setup = await createTransactionSetup();
    const createdAt = "2000-01-01T00:00:00.000Z";
    await query("UPDATE transactions SET created_at = $1 WHERE id = $2", [
      createdAt,
      setup.deposit.transactionId,
    ]);

    const response = await getTransaction(setup.deposit.transactionId);
    const details = response.body.data as TransactionDetails;

    expect(response.status).toBe(200);
    expect(details.createdAt).toBe(createdAt);
  });

  it("should retrieve a transaction containing a very large amount", async () => {
    const setup = await createTransactionSetup();
    const amount = "9999999999999999.99";
    const depositResponse = await request(app)
      .post(DEPOSIT_URL)
      .set("Idempotency-Key", crypto.randomUUID())
      .send({ accountNumber: setup.receiver.accountNumber, amount });
    const operation = depositResponse.body.data as OperationResponse;

    expect(depositResponse.status).toBe(201);
    await expectTransactionMatchesDatabase(operation.transactionId);

    const response = await getTransaction(operation.transactionId);
    const details = response.body.data as TransactionDetails;
    expect(details.entries.map((entry) => entry.amount)).toEqual([amount, amount]);
  });

  it("should reject an invalid transaction id", async () => {
    const response = await getTransaction("not-a-uuid");

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should return 404 for a missing transaction", async () => {
    const response = await getTransaction(crypto.randomUUID());

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Transaction not found.");
  });
});
