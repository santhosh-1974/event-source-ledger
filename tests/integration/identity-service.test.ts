import jwt, { JwtPayload } from "jsonwebtoken";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import bankingApp from "../helpers/app";
import gatewayApp from "../../services/api-gateway/src/app";
import { query } from "../../src/database/database";
import { resetDatabase } from "../helpers/database";

let identityApp: typeof import("../../services/identity-service/src/app").default;
beforeAll(async () => {
  ({ default: identityApp } = await import(
    "../../services/identity-service/src/app"
  ));
});

beforeEach(async () => {
  await resetDatabase();
});

describe("Identity Service authentication", () => {
  it("registers through the protected customer contract and issues banking-compatible tokens", async () => {
    const response = await request(identityApp)
      .post("/api/v1/auth/register")
      .send({
        name: "Identity Customer",
        email: "IDENTITY@EXAMPLE.COM",
        phone: "9876543210",
        password: "correct-horse-battery-7",
        isAdmin: true,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.customer).toMatchObject({
      name: "Identity Customer",
      email: "identity@example.com",
      phone: "9876543210",
    });
    expect(response.body.data.customer.createdAt).toEqual(expect.any(String));
    expect(response.body.data.customer.isAdmin).toBeUndefined();

    const payload = jwt.decode(response.body.data.token) as JwtPayload;
    expect(payload).toMatchObject({
      customerId: response.body.data.customer.id,
      sub: response.body.data.customer.id,
      iss: "event-sourced-ledger",
      aud: "banking-api",
    });
    expect(payload.exp! - payload.iat!).toBe(24 * 60 * 60);

    const profile = await request(gatewayApp)
      .get("/api/v1/customers/me")
      .set("Authorization", `Bearer ${response.body.data.token}`);
    expect(profile.status).toBe(200);
    expect(profile.body.data.id).toBe(response.body.data.customer.id);

    const account = await request(bankingApp)
      .post("/api/v1/accounts")
      .set("Authorization", `Bearer ${response.body.data.token}`)
      .send({
        customerId: response.body.data.customer.id,
        accountNumber: "IDENTITYCUSTOMER001",
        accountType: "SAVINGS",
      });
    expect(account.status).toBe(201);

    const [identityCredentials, legacyCredentials] = await Promise.all([
      query<{ customer_id: string; email: string; password_hash: string }>(
        `SELECT customer_id, email, password_hash
         FROM identity.credentials
         WHERE email = $1`,
        ["identity@example.com"]
      ),
      query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM legacy_users"
      ),
    ]);
    expect(identityCredentials.rows).toHaveLength(1);
    expect(identityCredentials.rows[0].customer_id).toBe(
      response.body.data.customer.id
    );
    expect(identityCredentials.rows[0].password_hash).not.toBe(
      "correct-horse-battery-7"
    );
    expect(legacyCredentials.rows[0].count).toBe("0");
  });

  it("authenticates with normalized email and rejects incorrect passwords", async () => {
    const registration = await request(identityApp)
      .post("/api/v1/auth/register")
      .send({
        name: "Identity Customer",
        email: "identity@example.com",
        phone: "9876543210",
        password: "correct-horse-battery-7",
      });
    const login = await request(identityApp)
      .post("/api/v1/auth/login")
      .send({
        email: "IDENTITY@EXAMPLE.COM",
        password: "correct-horse-battery-7",
      });
    const rejected = await request(identityApp)
      .post("/api/v1/auth/login")
      .send({
        email: "identity@example.com",
        password: "incorrect-horse-battery-7",
      });

    expect(registration.status).toBe(201);
    expect(login.status).toBe(200);
    expect(login.body.data.customerId).toBe(registration.body.data.customer.id);
    expect(
      await request(gatewayApp)
        .get("/api/v1/customers/me")
        .set("Authorization", `Bearer ${login.body.data.token}`)
    ).toMatchObject({ status: 200 });
    expect(rejected.status).toBe(401);
  });

  it("rejects duplicate registrations without creating a second credential", async () => {
    const payload = {
      name: "Identity Customer",
      email: "identity@example.com",
      phone: "9876543210",
      password: "correct-horse-battery-7",
    };
    const first = await request(identityApp)
      .post("/api/v1/auth/register")
      .send(payload);
    const duplicate = await request(identityApp)
      .post("/api/v1/auth/register")
      .send({ ...payload, phone: "9876543211" });
    const counts = await query<{ customers: string; credentials: string }>(`
      SELECT
        (SELECT COUNT(*)::text FROM customer.customers) AS customers,
        (SELECT COUNT(*)::text FROM identity.credentials) AS credentials
    `);

    expect(first.status).toBe(201);
    expect(duplicate.status).toBe(409);
    expect(counts.rows[0]).toEqual({ customers: "1", credentials: "1" });
  });

  it("returns a service error without storing credentials when provisioning fails", async () => {
    await query(`
      CREATE FUNCTION fail_identity_customer_insert()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'forced customer provisioning failure';
      END;
      $$;
    `);
    await query(`
      CREATE TRIGGER fail_identity_customer_insert_trigger
      BEFORE INSERT ON customer.customers
      FOR EACH ROW EXECUTE FUNCTION fail_identity_customer_insert();
    `);

    try {
      const response = await request(identityApp)
        .post("/api/v1/auth/register")
        .send({
          name: "Identity Customer",
          email: "identity@example.com",
          phone: "9876543210",
          password: "correct-horse-battery-7",
        });
      const credentials = await query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM identity.credentials"
      );

      expect(response.status).toBe(503);
      expect(credentials.rows[0].count).toBe("0");
    } finally {
      await query(
        "DROP TRIGGER IF EXISTS fail_identity_customer_insert_trigger ON customer.customers"
      );
      await query("DROP FUNCTION IF EXISTS fail_identity_customer_insert()");
    }
  });
});
