import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createAccessToken } from "../../src/libs/jwt";
import { query } from "../../src/database/database";
import customerServiceApp from "../../services/customer-service/src/app";
import gatewayApp from "../../services/api-gateway/src/app";
import { registerTestUser } from "../helpers/auth";
import { resetDatabase } from "../helpers/database";

const provisioningSecret = process.env.CUSTOMER_PROVISIONING_SECRET!;

beforeEach(async () => {
  await resetDatabase();
});

async function customerCount(): Promise<number> {
  const result = await query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM customer.customers"
  );
  return Number(result.rows[0].count);
}

describe("Customer Service contracts", () => {
  it("requires the internal service secret for customer provisioning", async () => {
    const [missingSecret, invalidSecret] = await Promise.all([
      request(customerServiceApp).post("/api/v1/internal/customers").send({
        name: "Identity Customer",
        email: "identity@example.com",
        phone: "9876543210",
      }),
      request(customerServiceApp)
        .post("/api/v1/internal/customers")
        .set("x-internal-service-secret", "wrong-secret")
        .send({
          name: "Identity Customer",
          email: "identity@example.com",
          phone: "9876543210",
        }),
    ]);

    expect(missingSecret.status).toBe(401);
    expect(invalidSecret.status).toBe(401);
    expect(await customerCount()).toBe(0);
  });

  it("creates normalized profiles and maps duplicate email and phone conflicts", async () => {
    const headers = { "x-internal-service-secret": provisioningSecret };
    const payload = {
      name: "  Identity Customer  ",
      email: "IDENTITY@EXAMPLE.COM",
      phone: " 9876543210 ",
    };
    const created = await request(customerServiceApp)
      .post("/api/v1/internal/customers")
      .set(headers)
      .send(payload);
    const duplicateEmail = await request(customerServiceApp)
      .post("/api/v1/internal/customers")
      .set(headers)
      .send({ ...payload, phone: "9876543211" });
    const duplicatePhone = await request(customerServiceApp)
      .post("/api/v1/internal/customers")
      .set(headers)
      .send({ ...payload, email: "other@example.com" });

    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      name: "Identity Customer",
      email: "identity@example.com",
      phone: "9876543210",
    });
    expect(duplicateEmail.status).toBe(409);
    expect(duplicateEmail.body.message).toBe("Email already exists");
    expect(duplicatePhone.status).toBe(409);
    expect(duplicatePhone.body.message).toBe("Phone number already exists");
    expect(await customerCount()).toBe(1);
  });

  it("maps concurrent duplicate profile creation to a conflict", async () => {
    const headers = { "x-internal-service-secret": provisioningSecret };
    const [first, second] = await Promise.all(
      ["9876543210", "9876543211"].map((phone) =>
        request(customerServiceApp)
          .post("/api/v1/internal/customers")
          .set(headers)
          .send({
            name: "Identity Customer",
            email: "identity@example.com",
            phone,
          })
      )
    );

    expect([first.status, second.status].sort()).toEqual([201, 409]);
    expect(await customerCount()).toBe(1);
  });

  it("routes authenticated profile reads through the Gateway", async () => {
    const user = await registerTestUser(customerServiceApp, {
      name: "Customer Owner",
      email: "owner@example.com",
      phone: "9876543210",
    });

    const [unauthenticated, profile, gatewayProfile, internalRoute] =
      await Promise.all([
        request(customerServiceApp).get("/api/v1/customers/me"),
        request(customerServiceApp)
          .get(`/api/v1/customers/${user.customer.id}`)
          .set("Authorization", `Bearer ${user.token}`),
        request(gatewayApp)
          .get("/api/v1/customers/me")
          .set("Authorization", `Bearer ${user.token}`),
        request(gatewayApp)
          .post("/api/v1/internal/customers")
          .set("x-internal-service-secret", provisioningSecret)
          .send({
            name: "Hidden Customer",
            email: "hidden@example.com",
            phone: "9876543211",
          }),
      ]);

    expect(unauthenticated.status).toBe(401);
    expect(profile.status).toBe(200);
    expect(gatewayProfile.status).toBe(200);
    expect(gatewayProfile.body.data.id).toBe(user.customer.id);
    expect(internalRoute.status).toBe(404);
    expect(await customerCount()).toBe(1);
  });

  it("prevents cross-customer reads and updates", async () => {
    const owner = await registerTestUser(customerServiceApp, {
      name: "Customer Owner",
      email: "owner@example.com",
      phone: "9876543210",
    });
    const other = await registerTestUser(customerServiceApp, {
      name: "Other Customer",
      email: "other@example.com",
      phone: "9876543211",
    });

    const [read, update] = await Promise.all([
      request(customerServiceApp)
        .get(`/api/v1/customers/${other.customer.id}`)
        .set("Authorization", `Bearer ${owner.token}`),
      request(customerServiceApp)
        .patch(`/api/v1/customers/${other.customer.id}`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ name: "Changed Name" }),
    ]);

    expect(read.status).toBe(404);
    expect(update.status).toBe(404);
  });

  it("updates name and phone but rejects email changes", async () => {
    const user = await registerTestUser(customerServiceApp, {
      name: "Customer Owner",
      email: "owner@example.com",
      phone: "9876543210",
    });
    await registerTestUser(customerServiceApp, {
      name: "Other Customer",
      email: "other@example.com",
      phone: "9876543213",
    });
    const headers = { Authorization: `Bearer ${user.token}` };
    const updated = await request(gatewayApp)
      .patch("/api/v1/customers/me")
      .set(headers)
      .send({ name: "Updated Customer", phone: "9876543212" });
    const emailChange = await request(gatewayApp)
      .patch("/api/v1/customers/me")
      .set(headers)
      .send({ email: "new@example.com" });
    const duplicatePhone = await request(gatewayApp)
      .patch("/api/v1/customers/me")
      .set(headers)
      .send({ phone: "9876543213" });

    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({
      name: "Updated Customer",
      email: "owner@example.com",
      phone: "9876543212",
    });
    expect(emailChange.status).toBe(400);
    expect(duplicatePhone.status).toBe(409);
  });

  it("exposes only the customer identifier to internal existence checks", async () => {
    const user = await registerTestUser(customerServiceApp, {
      name: "Customer Owner",
      email: "owner@example.com",
      phone: "9876543210",
    });

    const [missingSecret, found, missing] = await Promise.all([
      request(customerServiceApp).get(
        `/api/v1/internal/customers/${user.customer.id}`
      ),
      request(customerServiceApp)
        .get(`/api/v1/internal/customers/${user.customer.id}`)
        .set("x-internal-service-secret", provisioningSecret),
      request(customerServiceApp)
        .get("/api/v1/internal/customers/00000000-0000-4000-8000-000000000000")
        .set("x-internal-service-secret", provisioningSecret),
    ]);

    expect(missingSecret.status).toBe(401);
    expect(found.body.data).toEqual({ id: user.customer.id });
    expect(missing.status).toBe(404);
  });

  it("rejects malformed or forged customer tokens", async () => {
    const forgedToken = createAccessToken(
      "00000000-0000-4000-8000-000000000000"
    );
    const response = await request(customerServiceApp)
      .get("/api/v1/customers/me")
      .set("Authorization", `Bearer ${forgedToken}.tampered`);

    expect(response.status).toBe(401);
  });
});
