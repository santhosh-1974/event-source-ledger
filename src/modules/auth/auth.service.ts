import bcrypt from "bcrypt";
import jwt, { JwtPayload } from "jsonwebtoken";
import { PoolClient } from "pg";

import { env } from "../../config/env";
import { getClient, pool } from "../../database/database";
import { ConflictError, UnauthorizedError } from "../../errors/errors";
import { create } from "../customers/customer.repository";
import { Customer } from "../customers/customer.types";
import { LoginInput, RegisterInput } from "./auth.schema";

const BCRYPT_COST = 12;
const JWT_ISSUER = "event-sourced-ledger";
const JWT_AUDIENCE = "banking-api";

interface CredentialRow {
  customer_id: string;
  password_hash: string;
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  return typeof error === "object" && error !== null &&
    "code" in error && (error as { code?: string }).code === "23505" &&
    "constraint" in error && (error as { constraint?: string }).constraint === constraint;
}

function createAccessToken(customerId: string): string {
  return jwt.sign({ customerId }, env.JWT_SECRET, {
    algorithm: "HS256",
    subject: customerId,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    expiresIn: `${env.JWT_EXPIRATION_HOURS}h`,
  });
}

export function verifyAccessToken(token: string): string {
  const payload = jwt.verify(token, env.JWT_SECRET, {
    algorithms: ["HS256"],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  }) as JwtPayload & { customerId?: unknown };

  if (typeof payload.sub !== "string" || payload.customerId !== payload.sub) {
    throw new UnauthorizedError("Invalid or expired authentication token");
  }

  return payload.sub;
}

export async function register(input: RegisterInput): Promise<{ customer: Customer; token: string }> {
  const { password, ...customerInput } = input;
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const client = await getClient();

  try {
    await client.query("BEGIN");
    const customer = await create(customerInput, client);
    await client.query(
      "INSERT INTO users (customer_id, password_hash) VALUES ($1, $2)",
      [customer.id, passwordHash]
    );
    await client.query("COMMIT");
    return { customer, token: createAccessToken(customer.id) };
  } catch (error) {
    await client.query("ROLLBACK");
    if (isUniqueViolation(error, "customers_email_key")) {
      throw new ConflictError("Email already exists");
    }
    if (isUniqueViolation(error, "customers_phone_key")) {
      throw new ConflictError("Phone number already exists");
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function login(input: LoginInput): Promise<{ token: string }> {
  const result = await pool.query<CredentialRow>(
    `
    SELECT c.id AS customer_id, u.password_hash
    FROM customers c
    INNER JOIN users u ON u.customer_id = c.id
    WHERE c.email = $1
    `,
    [input.email]
  );
  const credential = result.rows[0];
  const validPassword = credential
    ? await bcrypt.compare(input.password, credential.password_hash)
    : false;

  if (!credential || !validPassword) {
    throw new UnauthorizedError("Invalid email or password");
  }

  return { token: createAccessToken(credential.customer_id) };
}

export async function findCustomerForAuth(customerId: string, client?: PoolClient): Promise<Customer | null> {
  const db = client ?? pool;
  const result = await db.query<{
    id: string;
    name: string;
    email: string;
    phone: string;
    created_at: Date;
  }>(
    "SELECT id, name, email, phone, created_at FROM customers WHERE id = $1",
    [customerId]
  );
  const row = result.rows[0];
  return row ? {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    createdAt: row.created_at,
  } : null;
}
