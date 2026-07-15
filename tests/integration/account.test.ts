import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import app from "../helpers/app";
import { resetDatabase } from "../helpers/database";
import { query } from "../../src/database/database";

const CUSTOMER_URL = "/api/v1/customers/create-customer";
const ACCOUNT_URL = "/api/v1/accounts";

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

  return response.body.data;
}

async function accountCount(): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM bank_accounts`
  );

  return Number(result.rows[0].count);
}

describe("Bank Account API", () => {
  it("should create an account", async () => {
    const customer = await createCustomer();

    const payload = {
      customerId: customer.id,
      accountNumber: "1000000001",
      accountType: "SAVINGS",
    };

    const response = await request(app)
      .post(ACCOUNT_URL)
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    expect(response.body.data.accountNumber).toBe(payload.accountNumber);
    expect(response.body.data.accountType).toBe(payload.accountType);
    expect(response.body.data.status).toBe("ACTIVE");

    expect(await accountCount()).toBe(1);

    const db = await query<{
      account_number: string;
      account_type: string;
      status: string;
    }>(
      `
      SELECT account_number,
             account_type,
             status
      FROM bank_accounts
      WHERE account_number=$1
      `,
      [payload.accountNumber]
    );

    expect(db.rows[0].account_number).toBe(payload.accountNumber);
    expect(db.rows[0].account_type).toBe(payload.accountType);
    expect(db.rows[0].status).toBe("ACTIVE");
  });

  it("should reject duplicate account numbers", async () => {
    const customer = await createCustomer();

    const payload = {
      customerId: customer.id,
      accountNumber: "1000000001",
      accountType: "SAVINGS",
    };

    await request(app).post(ACCOUNT_URL).send(payload);

    const response = await request(app)
      .post(ACCOUNT_URL)
      .send(payload);

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Account number already exists");

    expect(await accountCount()).toBe(1);
  });

  it("should reject invalid customer id", async () => {
    const response = await request(app)
      .post(ACCOUNT_URL)
      .send({
        customerId: "invalid-id",
        accountNumber: "1000000001",
        accountType: "SAVINGS",
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);

    expect(await accountCount()).toBe(0);
  });

  it("should reject invalid account type", async () => {
    const customer = await createCustomer();

    const response = await request(app)
      .post(ACCOUNT_URL)
      .send({
        customerId: customer.id,
        accountNumber: "1000000001",
        accountType: "BUSINESS",
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);

    expect(await accountCount()).toBe(0);
  });

  it("should reject missing required fields", async () => {
    const response = await request(app)
      .post(ACCOUNT_URL)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);

    expect(await accountCount()).toBe(0);
  });

  it("should reject account number longer than 20 characters", async () => {
    const customer = await createCustomer();

    const response = await request(app)
      .post(ACCOUNT_URL)
      .send({
        customerId: customer.id,
        accountNumber: "123456789012345678901",
        accountType: "SAVINGS",
      });

    expect(response.status).toBe(400);
    expect(await accountCount()).toBe(0);
  });
});