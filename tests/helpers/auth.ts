import jwt from "jsonwebtoken";
import { Express } from "express";
import request, { Test } from "supertest";
import { randomUUID } from "node:crypto";

import { createAccessToken } from "../../src/libs/jwt";
import customerServiceApp from "../../services/customer-service/src/app";

const TEST_JWT_SECRET = "unit-test-only-signing-secret-never-used-in-production";
const TEST_JWT_ISSUER = "event-sourced-ledger";
const TEST_JWT_AUDIENCE = "banking-api";

export interface TestUser {
  customer: { id: string; name: string; email: string; phone: string };
  token: string;
}

let primaryUser: TestUser | undefined;
let fallbackUser: TestUser | undefined;

export function clearTestAuthentication(): void {
  primaryUser = undefined;
  fallbackUser = undefined;
}

export function currentTestCustomerId(): string {
  return (primaryUser ?? fallbackUser ?? createFallbackUser()).customer.id;
}

function createFallbackUser(): TestUser {
  const id = randomUUID();
  fallbackUser = {
    customer: { id, name: "Test User", email: "test-user@example.com", phone: "0000000000" },
    token: jwt.sign({ customerId: id }, TEST_JWT_SECRET, {
      algorithm: "HS256",
      subject: id,
      issuer: TEST_JWT_ISSUER,
      audience: TEST_JWT_AUDIENCE,
      expiresIn: "1h",
    }),
  };
  return fallbackUser;
}

function withBearer(test: Test, token: string): Test {
  return test.set("Authorization", `Bearer ${token}`);
}

export function authenticatedRequest(app: Express, token: string) {
  return {
    get: (url: string) => withBearer(request(app).get(url), token),
    post: (url: string) => withBearer(request(app).post(url), token),
    put: (url: string) => withBearer(request(app).put(url), token),
    patch: (url: string) => withBearer(request(app).patch(url), token),
    delete: (url: string) => withBearer(request(app).delete(url), token),
  };
}

export function requestAsTestUser(app: Express) {
  const user = primaryUser ?? fallbackUser ?? createFallbackUser();
  return authenticatedRequest(app, user.token);
}

export async function registerTestUser(
  _bankingApp: Express,
  details: { name: string; email: string; phone: string }
): Promise<TestUser> {
  const response = await request(customerServiceApp)
    .post("/api/v1/internal/customers")
    .set(
      "x-internal-service-secret",
      process.env.CUSTOMER_PROVISIONING_SECRET!
    )
    .send(details);
  if (response.status !== 201) {
    throw new Error(`Test customer provisioning failed (${response.status}): ${response.body.message ?? "unknown error"}`);
  }

  const customer = response.body.data as TestUser["customer"];
  const user: TestUser = {
    customer,
    token: createAccessToken(customer.id),
  };
  primaryUser ??= user;
  return user;
}
