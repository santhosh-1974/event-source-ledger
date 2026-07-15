import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import app from "../helpers/app";
import { resetDatabase } from "../helpers/database";
import { query } from "../../src/database/database";

const CUSTOMER_URL = "/api/v1/customers/create-customer";
const ACCOUNT_URL = "/api/v1/accounts";
const DEPOSIT_URL = "/api/v1/banking/deposit";

beforeEach(async () => {
  await resetDatabase();
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

  return response.body.data;
}

async function createAccount() {
  const customer = await createCustomer();

  const response = await request(app)
    .post(ACCOUNT_URL)
    .send({
      customerId: customer.id,
      accountNumber: "1000000001",
      accountType: "SAVINGS",
    });

  expect(response.status).toBe(201);

  return response.body.data;
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
    `
    SELECT COUNT(*)::text AS count
    FROM transactions
    `
  );

  return Number(result.rows[0].count);
}

async function ledgerEntryCount(): Promise<number> {
  const result = await query<{ count: string }>(
    `
    SELECT COUNT(*)::text AS count
    FROM ledger_entries
    `
  );

  return Number(result.rows[0].count);
}

describe("Deposit API", () => {
  it("should deposit money successfully", async () => {
    const account = await createAccount();

    const response = await request(app)
      .post(DEPOSIT_URL)
      .set("Idempotency-Key", crypto.randomUUID())
      .send({
        accountNumber: account.accountNumber,
        amount: "1000.00",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    expect(await transactionCount()).toBe(1);

    expect(await ledgerEntryCount()).toBe(2);

    expect(await getBalance(account.accountNumber)).toBe(1000);
  });

  it("should reject invalid account number", async () => {
    const response = await request(app)
      .post(DEPOSIT_URL)
      .set("Idempotency-Key", crypto.randomUUID())
      .send({
        accountNumber: "9999999999",
        amount: "1000",
      });

    expect(response.status).toBe(404);

    expect(await transactionCount()).toBe(0);

    expect(await ledgerEntryCount()).toBe(0);
  });

  it("should reject zero amount", async () => {
    const account = await createAccount();

    const response = await request(app)
      .post(DEPOSIT_URL)
      .set("Idempotency-Key", crypto.randomUUID())
      .send({
        accountNumber: account.accountNumber,
        amount: "0",
      });

    expect(response.status).toBe(400);

    expect(await transactionCount()).toBe(0);

    expect(await ledgerEntryCount()).toBe(0);
  });

  it("should reject negative amount", async () => {
    const account = await createAccount();

    const response = await request(app)
      .post(DEPOSIT_URL)
      .set("Idempotency-Key", crypto.randomUUID())
      .send({
        accountNumber: account.accountNumber,
        amount: "-100",
      });

    expect(response.status).toBe(400);

    expect(await transactionCount()).toBe(0);

    expect(await ledgerEntryCount()).toBe(0);
  });
  it("should reject invalid request body", async () => {
    const response = await request(app)
      .post(DEPOSIT_URL)
      .set("Idempotency-Key", crypto.randomUUID())
      .send({});

    expect(response.status).toBe(400);

    expect(await transactionCount()).toBe(0);
    expect(await ledgerEntryCount()).toBe(0);
  });

  it("should reject missing idempotency key", async () => {
    const account = await createAccount();

    const response = await request(app)
      .post(DEPOSIT_URL)
      .send({
        accountNumber: account.accountNumber,
        amount: "1000",
      });

    expect(response.status).toBe(400);

    expect(await transactionCount()).toBe(0);
    expect(await ledgerEntryCount()).toBe(0);
  });

  it("should reject deposit into CLOSED account", async () => {
    const account = await createAccount();

    await query(
      `
      UPDATE bank_accounts
      SET status='CLOSED'
      WHERE account_number=$1
      `,
      [account.accountNumber]
    );

    const response = await request(app)
      .post(DEPOSIT_URL)
      .set("Idempotency-Key", crypto.randomUUID())
      .send({
        accountNumber: account.accountNumber,
        amount: "1000",
      });

    expect(response.status).toBe(409);

    expect(await transactionCount()).toBe(0);
    expect(await ledgerEntryCount()).toBe(0);
  });

  it("should reject deposit into BLOCKED account", async () => {
    const account = await createAccount();

    await query(
      `
      UPDATE bank_accounts
      SET status='BLOCKED'
      WHERE account_number=$1
      `,
      [account.accountNumber]
    );

    const response = await request(app)
      .post(DEPOSIT_URL)
      .set("Idempotency-Key", crypto.randomUUID())
      .send({
        accountNumber: account.accountNumber,
        amount: "1000",
      });

    expect(response.status).toBe(409);

    expect(await transactionCount()).toBe(0);
    expect(await ledgerEntryCount()).toBe(0);
  });

  it("should create one transaction", async () => {
    const account = await createAccount();

    await request(app)
      .post(DEPOSIT_URL)
      .set("Idempotency-Key", crypto.randomUUID())
      .send({
        accountNumber: account.accountNumber,
        amount: "500",
      });

    const result = await query<{ count: string }>(
      `
      SELECT COUNT(*)::text AS count
      FROM transactions
      `
    );

    expect(Number(result.rows[0].count)).toBe(1);
  });

  it("should create exactly two ledger entries", async () => {
    const account = await createAccount();

    await request(app)
      .post(DEPOSIT_URL)
      .set("Idempotency-Key", crypto.randomUUID())
      .send({
        accountNumber: account.accountNumber,
        amount: "500",
      });

    const result = await query<{ count: string }>(
      `
      SELECT COUNT(*)::text AS count
      FROM ledger_entries
      `
    );

    expect(Number(result.rows[0].count)).toBe(2);
  });

  it("should store correct amount in ledger entries", async () => {
    const account = await createAccount();

    await request(app)
      .post(DEPOSIT_URL)
      .set("Idempotency-Key", crypto.randomUUID())
      .send({
        accountNumber: account.accountNumber,
        amount: "750",
      });

    const result = await query<{ amount: string }>(
      `
      SELECT amount
      FROM ledger_entries
      ORDER BY created_at
      `
    );

    expect(result.rows).toHaveLength(2);

    expect(Number(result.rows[0].amount)).toBe(750);
    expect(Number(result.rows[1].amount)).toBe(750);
  });

  it("should replay response for duplicate idempotency key", async () => {
    const account = await createAccount();

    const key = crypto.randomUUID();

    const first = await request(app)
      .post(DEPOSIT_URL)
      .set("Idempotency-Key", key)
      .send({
        accountNumber: account.accountNumber,
        amount: "1000",
      });

    const second = await request(app)
      .post(DEPOSIT_URL)
      .set("Idempotency-Key", key)
      .send({
        accountNumber: account.accountNumber,
        amount: "1000",
      });

    expect(second.status).toBe(first.status);

    expect(second.body).toEqual(first.body);

    expect(await transactionCount()).toBe(1);

    expect(await ledgerEntryCount()).toBe(2);

    expect(await getBalance(account.accountNumber)).toBe(1000);
  });

})
