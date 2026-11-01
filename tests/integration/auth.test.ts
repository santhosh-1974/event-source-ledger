import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import app from "../helpers/app";
import { authenticateTestUser, authenticatedRequest, registerTestUser } from "../helpers/auth";
import { query } from "../../src/database/database";
import { resetDatabase } from "../helpers/database";

const AUTH_URL = "/api/v1/auth";

beforeEach(async () => {
  await resetDatabase();
});

describe("Authentication API", () => {
  it("registers a customer and credential atomically and returns a signed token", async () => {
    const response = await request(app).post(`${AUTH_URL}/register`).send({
      name: "Riya Shah",
      email: "riya@example.com",
      phone: "9876543210",
      password: "correct-horse-battery-7",
      isAdmin: true,
    });

    expect(response.status).toBe(201);
    expect(response.body.data.token).toEqual(expect.any(String));
    const decodedToken = jwt.decode(response.body.data.token) as jwt.JwtPayload;
    expect(decodedToken.exp! - decodedToken.iat!).toBe(24 * 60 * 60);
    expect(response.body.data.customer).toMatchObject({
      name: "Riya Shah",
      email: "riya@example.com",
      phone: "9876543210",
    });
    expect(response.body.data.customer.isAdmin).toBeUndefined();

    const rows = await query<{
      customer_count: string;
      user_count: string;
      password_hash: string;
    }>(`
      SELECT
        (SELECT COUNT(*)::text FROM customers) AS customer_count,
        (SELECT COUNT(*)::text FROM users) AS user_count,
        (SELECT password_hash FROM users LIMIT 1) AS password_hash;
    `);
    expect(rows.rows[0].customer_count).toBe("1");
    expect(rows.rows[0].user_count).toBe("1");
    expect(rows.rows[0].password_hash).not.toBe("correct-horse-battery-7");
  });

  it("rolls back customer creation if credential persistence fails", async () => {
    await query(`
      CREATE FUNCTION fail_user_insert()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'forced credential failure';
      END;
      $$;
    `);
    await query(`
      CREATE TRIGGER fail_user_insert_trigger
      BEFORE INSERT ON users FOR EACH ROW EXECUTE FUNCTION fail_user_insert();
    `);

    try {
      const response = await request(app).post(`${AUTH_URL}/register`).send({
        name: "Atomic Customer",
        email: "atomic@example.com",
        phone: "9876543210",
        password: "correct-horse-battery-7",
      });
      const counts = await query<{ customers: string; users: string }>(`
        SELECT
          (SELECT COUNT(*)::text FROM customers) AS customers,
          (SELECT COUNT(*)::text FROM users) AS users
      `);

      expect(response.status).toBe(500);
      expect(counts.rows[0]).toEqual({ customers: "0", users: "0" });
    } finally {
      await query("DROP TRIGGER IF EXISTS fail_user_insert_trigger ON users");
      await query("DROP FUNCTION IF EXISTS fail_user_insert()");
    }
  });

  it("authenticates a registered user and rejects an incorrect password", async () => {
    const credentials = {
      name: "Riya Shah",
      email: "riya@example.com",
      phone: "9876543210",
      password: "correct-horse-battery-7",
    };
    await request(app).post(`${AUTH_URL}/register`).send(credentials);

    const loginToken = await authenticateTestUser(app, credentials.email, credentials.password);
    const rejected = await request(app).post(`${AUTH_URL}/login`).send({
      email: credentials.email,
      password: "wrong-password-123",
    });

    expect(loginToken).toEqual(expect.any(String));
    expect(rejected.status).toBe(401);
  });

  it("validates registration and rejects duplicate email", async () => {
    const payload = {
      name: "Riya Shah",
      email: "riya@example.com",
      phone: "9876543210",
      password: "correct-horse-battery-7",
    };
    await request(app).post(`${AUTH_URL}/register`).send(payload);

    const duplicate = await request(app).post(`${AUTH_URL}/register`).send({
      ...payload,
      phone: "9876543211",
    });
    const invalid = await request(app).post(`${AUTH_URL}/register`).send({
      ...payload,
      email: "not-an-email",
    });

    expect(duplicate.status).toBe(409);
    expect(invalid.status).toBe(400);
  });

  it("keeps health endpoints public and blocks protected routes without a token", async () => {
    const [health, ready, accounts, customers] = await Promise.all([
      request(app).get("/health"),
      request(app).get("/ready"),
      request(app).get("/api/v1/accounts"),
      request(app).get("/api/v1/customers"),
    ]);

    expect(health.status).toBe(200);
    expect(ready.status).toBe(200);
    expect(accounts.status).toBe(401);
    expect(customers.status).toBe(401);
    expect(JSON.stringify(health.body)).not.toContain("database");
    expect(JSON.stringify(ready.body)).not.toContain("connectionString");
  });

  it("prevents IDOR access to another customer's customer and accounts", async () => {
    const owner = await registerTestUser(app, {
      name: "Owner One",
      email: "owner-one@example.com",
      phone: "9876543210",
    });
    const other = await registerTestUser(app, {
      name: "Owner Two",
      email: "owner-two@example.com",
      phone: "9876543211",
    });
    const ownerAccount = await authenticatedRequest(app, owner.token)
      .post("/api/v1/accounts")
      .send({ customerId: owner.customer.id, accountNumber: "1100000001", accountType: "SAVINGS" });
    const otherAccount = await authenticatedRequest(app, other.token)
      .post("/api/v1/accounts")
      .send({ customerId: other.customer.id, accountNumber: "1100000002", accountType: "SAVINGS" });

    expect(ownerAccount.status).toBe(201);
    expect(otherAccount.status).toBe(201);

    const [customer, accountList, account, balance, history] = await Promise.all([
      authenticatedRequest(app, owner.token).get(`/api/v1/customers/${other.customer.id}`),
      authenticatedRequest(app, owner.token).get("/api/v1/accounts"),
      authenticatedRequest(app, owner.token).get(`/api/v1/accounts/${otherAccount.body.data.id}`),
      authenticatedRequest(app, owner.token).get("/api/v1/banking/1100000002/balance"),
      authenticatedRequest(app, owner.token).get("/api/v1/banking/1100000002/history"),
    ]);

    expect(customer.status).toBe(404);
    expect(accountList.body.data).toHaveLength(1);
    expect(accountList.body.data[0].id).toBe(ownerAccount.body.data.id);
    expect(account.status).toBe(404);
    expect(balance.status).toBe(404);
    expect(history.status).toBe(404);
  });

  it("rejects transfers unless the caller owns both accounts", async () => {
    const owner = await registerTestUser(app, {
      name: "Owner One",
      email: "owner-one@example.com",
      phone: "9876543210",
    });
    const other = await registerTestUser(app, {
      name: "Owner Two",
      email: "owner-two@example.com",
      phone: "9876543211",
    });
    await authenticatedRequest(app, owner.token)
      .post("/api/v1/accounts")
      .send({ customerId: owner.customer.id, accountNumber: "1200000001", accountType: "SAVINGS" });
    await authenticatedRequest(app, other.token)
      .post("/api/v1/accounts")
      .send({ customerId: other.customer.id, accountNumber: "1200000002", accountType: "SAVINGS" });

    const response = await authenticatedRequest(app, owner.token)
      .post("/api/v1/banking/transfer")
      .set("Idempotency-Key", crypto.randomUUID())
      .send({ fromAccountNumber: "1200000001", toAccountNumber: "1200000002", amount: "10.00" });
    const transactionCount = await query<{ count: string }>("SELECT COUNT(*)::text AS count FROM transactions");

    expect(response.status).toBe(404);
    expect(transactionCount.rows[0].count).toBe("0");
  });

  it("rejects a caller-supplied customer id that is not the authenticated owner", async () => {
    const owner = await registerTestUser(app, {
      name: "Owner One",
      email: "owner-one@example.com",
      phone: "9876543210",
    });
    const other = await registerTestUser(app, {
      name: "Owner Two",
      email: "owner-two@example.com",
      phone: "9876543211",
    });

    const response = await authenticatedRequest(app, owner.token)
      .post("/api/v1/accounts")
      .send({ customerId: other.customer.id, accountNumber: "1300000001", accountType: "SAVINGS" });
    const count = await query<{ count: string }>("SELECT COUNT(*)::text AS count FROM bank_accounts");

    expect(response.status).toBe(404);
    expect(count.rows[0].count).toBe("0");
  });

  it("prevents another customer from reading transaction details", async () => {
    const owner = await registerTestUser(app, {
      name: "Owner One",
      email: "owner-one@example.com",
      phone: "9876543210",
    });
    const other = await registerTestUser(app, {
      name: "Owner Two",
      email: "owner-two@example.com",
      phone: "9876543211",
    });
    const account = await authenticatedRequest(app, owner.token)
      .post("/api/v1/accounts")
      .send({ customerId: owner.customer.id, accountNumber: "1400000001", accountType: "SAVINGS" });
    const deposit = await authenticatedRequest(app, owner.token)
      .post("/api/v1/banking/deposit")
      .set("Idempotency-Key", crypto.randomUUID())
      .send({ accountNumber: "1400000001", amount: "10.00" });

    expect(account.status).toBe(201);
    expect(deposit.status).toBe(201);
    const ownerCanRead = await authenticatedRequest(app, owner.token)
      .get(`/api/v1/transactions/${deposit.body.data.transactionId}`);
    const otherCannotRead = await authenticatedRequest(app, other.token)
      .get(`/api/v1/transactions/${deposit.body.data.transactionId}`);

    expect(ownerCanRead.status).toBe(200);
    expect(otherCannotRead.status).toBe(404);
  });
});
