import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import gatewayApp from "../../services/api-gateway/src/app";
import { authenticatedRequest } from "../helpers/auth";
import { resetDatabase } from "../helpers/database";

beforeEach(async () => {
  await resetDatabase();
});

describe("Phase 2 browser-to-Gateway customer journey", () => {
  it("registers and logs in through the Gateway, then completes core banking flows", async () => {
    const registration = await request(gatewayApp)
      .post("/api/v1/auth/register")
      .send({
        name: "Phase Two Customer",
        email: "phase-two@example.com",
        phone: "9876543210",
        password: "phase-two-password-2026",
      });

    expect(registration.status).toBe(201);
    expect(registration.body.data.customer.email).toBe("phase-two@example.com");

    const login = await request(gatewayApp)
      .post("/api/v1/auth/login")
      .send({
        email: "PHASE-TWO@EXAMPLE.COM",
        password: "phase-two-password-2026",
      });

    expect(login.status).toBe(200);
    expect(login.body.data.token).toEqual(expect.any(String));

    const client = authenticatedRequest(gatewayApp, login.body.data.token);
    const profile = await client.get("/api/v1/customers/me");
    expect(profile.status).toBe(200);
    expect(profile.body.data.id).toBe(registration.body.data.customer.id);

    const sender = await client.post("/api/v1/accounts").send({
      customerId: profile.body.data.id,
      accountNumber: "PHASE20001",
      accountType: "SAVINGS",
    });
    const recipient = await client.post("/api/v1/accounts").send({
      customerId: profile.body.data.id,
      accountNumber: "PHASE20002",
      accountType: "SAVINGS",
    });
    expect(sender.status).toBe(201);
    expect(recipient.status).toBe(201);

    const deposit = await client
      .post("/api/v1/banking/deposit")
      .set("Idempotency-Key", crypto.randomUUID())
      .send({ accountNumber: "PHASE20001", amount: "100.00" });
    const withdrawal = await client
      .post("/api/v1/banking/withdraw")
      .set("Idempotency-Key", crypto.randomUUID())
      .send({ accountNumber: "PHASE20001", amount: "10.00" });
    const transferKey = crypto.randomUUID();
    const transferPayload = {
      fromAccountNumber: "PHASE20001",
      toAccountNumber: "PHASE20002",
      amount: "5.00",
    };
    const transfer = await client
      .post("/api/v1/banking/transfer")
      .set("Idempotency-Key", transferKey)
      .send(transferPayload);
    const transferReplay = await client
      .post("/api/v1/banking/transfer")
      .set("Idempotency-Key", transferKey)
      .send(transferPayload);

    expect(deposit.status).toBe(201);
    expect(withdrawal.status).toBe(201);
    expect(transfer.status).toBe(201);
    expect(transferReplay.status).toBe(201);
    expect(transferReplay.body).toEqual(transfer.body);

    const [senderBalance, recipientBalance, history, transaction] =
      await Promise.all([
        client.get("/api/v1/banking/PHASE20001/balance"),
        client.get("/api/v1/banking/PHASE20002/balance"),
        client.get("/api/v1/banking/PHASE20001/history"),
        client.get(`/api/v1/transactions/${transfer.body.data.transactionId}`),
      ]);

    expect(senderBalance.body.data.balance).toBe("85.00");
    expect(recipientBalance.body.data.balance).toBe("5.00");
    expect(history.body.data.transactions).toHaveLength(3);
    expect(transaction.status).toBe(200);
    expect(transaction.body.data.entries).toHaveLength(4);
  });

  it("keeps internal customer provisioning unavailable through the public Gateway", async () => {
    const response = await request(gatewayApp)
      .post("/api/v1/internal/customers")
      .send({
        name: "Unauthorised Customer",
        email: "internal-route@example.com",
        phone: "9876543211",
      });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      message: "Not Found",
    });
  });
});
