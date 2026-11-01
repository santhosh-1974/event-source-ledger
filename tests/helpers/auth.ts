import jwt from "jsonwebtoken";
import { Express } from "express";
import request, { Test } from "supertest";
import { randomUUID } from "node:crypto";

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
    patch: (url: string) => withBearer(request(app).patch(url), token),
    delete: (url: string) => withBearer(request(app).delete(url), token),
  };
}

export function requestAsTestUser(app: Express) {
  const user = primaryUser ?? fallbackUser ?? createFallbackUser();
  return authenticatedRequest(app, user.token);
}

export async function registerTestUser(
  app: Express,
  details: { name: string; email: string; phone: string; password?: string }
): Promise<TestUser> {
  const password = details.password ?? "correct-horse-battery-7";
  const response = await request(app).post("/api/v1/auth/register").send({ ...details, password });
  if (response.status !== 201) {
    throw new Error(`Test user registration failed (${response.status}): ${response.body.message ?? "unknown error"}`);
  }

  const user: TestUser = {
    customer: response.body.data.customer,
    token: response.body.data.token,
  };
  primaryUser ??= user;
  return user;
}

export async function authenticateTestUser(
  app: Express,
  email: string,
  password: string
): Promise<string> {
  const response = await request(app).post("/api/v1/auth/login").send({ email, password });
  if (response.status !== 200 || typeof response.body.data?.token !== "string") {
    throw new Error(`Test user login failed (${response.status})`);
  }
  return response.body.data.token;
}
