import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import app from "../helpers/app";
import { authenticatedRequest, registerTestUser } from "../helpers/auth";
import { query } from "../../src/database/database";
import { resetDatabase } from "../helpers/database";

beforeEach(async () => {
  await resetDatabase();
});

describe("Authentication API", () => {
  it("does not expose registration or login in the banking backend", async () => {
    const [register, login] = await Promise.all([
      request(app).post("/api/v1/auth/register"),
      request(app).post("/api/v1/auth/login"),
    ]);

    expect(register.status).toBe(401);
    expect(login.status).toBe(401);
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

  it("prevents access to another customer's accounts", async () => {
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

    const [accountList, account, balance, history] = await Promise.all([
      authenticatedRequest(app, owner.token).get("/api/v1/accounts"),
      authenticatedRequest(app, owner.token).get(`/api/v1/accounts/${otherAccount.body.data.id}`),
      authenticatedRequest(app, owner.token).get("/api/v1/banking/1100000002/balance"),
      authenticatedRequest(app, owner.token).get("/api/v1/banking/1100000002/history"),
    ]);

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
