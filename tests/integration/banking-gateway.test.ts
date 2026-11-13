import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import gatewayApp from "../../services/api-gateway/src/app";
import { authenticatedRequest, registerTestUser } from "../helpers/auth";
import { resetDatabase } from "../helpers/database";

beforeEach(async () => {
  await resetDatabase();
});

describe("Banking Core Gateway contract v1", () => {
  it("proxies account and financial operations while rejecting unregistered paths", async () => {
    const user = await registerTestUser(gatewayApp, {
      name: "Gateway Banking User",
      email: "gateway-banking@example.com",
      phone: "9876543210",
    });
    const client = authenticatedRequest(gatewayApp, user.token);

    const [senderResponse, receiverResponse] = await Promise.all([
      client.post("/api/v1/accounts").send({
        customerId: user.customer.id,
        accountNumber: "1500000001",
        accountType: "SAVINGS",
      }),
      client.post("/api/v1/accounts").send({
        customerId: user.customer.id,
        accountNumber: "1500000002",
        accountType: "CURRENT",
      }),
    ]);

    expect(senderResponse.status).toBe(201);
    expect(receiverResponse.status).toBe(201);

    const accountList = await client.get("/api/v1/accounts");
    expect(accountList.status).toBe(200);
    expect(accountList.body.data).toHaveLength(2);

    const deposit = await client
      .post("/api/v1/banking/deposit")
      .set("Idempotency-Key", crypto.randomUUID())
      .send({ accountNumber: "1500000001", amount: "100.00" });
    const withdrawal = await client
      .post("/api/v1/banking/withdraw")
      .set("Idempotency-Key", crypto.randomUUID())
      .send({ accountNumber: "1500000001", amount: "10.00" });
    const transfer = await client
      .post("/api/v1/banking/transfer")
      .set("Idempotency-Key", crypto.randomUUID())
      .send({
        fromAccountNumber: "1500000001",
        toAccountNumber: "1500000002",
        amount: "5.00",
      });

    expect(deposit.status).toBe(201);
    expect(withdrawal.status).toBe(201);
    expect(transfer.status).toBe(201);

    const [senderBalance, receiverBalance, history, transaction] =
      await Promise.all([
        client.get("/api/v1/banking/1500000001/balance"),
        client.get("/api/v1/banking/1500000002/balance"),
        client.get("/api/v1/banking/1500000001/history"),
        client.get(`/api/v1/transactions/${transfer.body.data.transactionId}`),
      ]);

    expect(senderBalance.body.data.balance).toBe("85.00");
    expect(receiverBalance.body.data.balance).toBe("5.00");
    expect(history.body.data.transactions).toHaveLength(3);
    expect(transaction.status).toBe(200);
    expect(transaction.body.data.entries).toHaveLength(4);

    const unknownRoute = await client.get("/api/v1/not-a-banking-resource");
    const internalRoute = await client.get("/api/v1/internal/customers");
    expect(unknownRoute.status).toBe(404);
    expect(internalRoute.status).toBe(404);
    expect(unknownRoute.body).toEqual({
      success: false,
      message: "Not Found",
    });
  });

  it("preserves authentication errors at the public Gateway", async () => {
    const response = await request(gatewayApp).get("/api/v1/accounts");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      message: "Authentication required",
    });
  });
});
