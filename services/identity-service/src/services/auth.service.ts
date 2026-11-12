import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { createCustomer, Customer } from "../clients/customer.client";
import { env } from "../config/env";
import { ConflictError, UnauthorizedError } from "../errors/errors";
import {
  createCredential,
  findCredentialByEmail,
} from "../repositories/credential.repository";
import { LoginInput, RegisterInput } from "../auth.schema";

// ── JWT constants — must match the monolith's src/libs/jwt/index.ts ──────────
const JWT_ISSUER = "event-sourced-ledger";
const JWT_AUDIENCE = "banking-api";
const BCRYPT_COST = 12;

function isUniqueViolation(
  error: unknown
): error is { code: "23505"; constraint?: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Generates an HS256 access token that the monolith's authentication
 * middleware can verify without modification.
 */
function generateAccessToken(customerId: string): string {
  return jwt.sign({ customerId }, env.JWT_SECRET, {
    algorithm: "HS256",
    subject: customerId,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    expiresIn: `${env.JWT_EXPIRATION_HOURS}h`,
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface RegisterResult {
  customer: Customer;
  token: string;
}

export interface LoginResult {
  customerId: string;
  token: string;
}

/**
 * register — provisions a customer via the Banking API and stores credentials
 * in the Identity-owned schema.
 *
 * Order of operations:
 *  1. Hash password (bcrypt, cost 12)
 *  2. Call Customer Service → customer record created in monolith DB
 *  3. Save (customerId, email, passwordHash) in the Identity schema
 *  4. Issue JWT
 *
 * If step 3 fails the customer already exists and cannot be rolled back.
 */
export async function register(input: RegisterInput): Promise<RegisterResult> {
  const { name, email, phone, password } = input;

  // Step 1 — Hash password before making any external calls.
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  // Step 2 — Provision customer record via the Customer Service.
  // ConflictError / ValidationError propagate directly to the caller.
  const customer = await createCustomer({ name, email, phone });

  // Step 3 — Persist credentials in the Identity-owned schema.
  try {
    await createCredential(customer.id, customer.email, passwordHash);
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      if (err.constraint === "credentials_email_key") {
        throw new ConflictError("Email already exists");
      }
      if (err.constraint === "credentials_customer_id_key") {
        throw new ConflictError("Credentials for this customer already exist");
      }
    }

    console.error(
      "[auth.service] PARTIAL FAILURE: customer created but credential save failed. " +
        `customerId=${customer.id} pgCode=${
          isUniqueViolation(err) ? err.code : "unknown"
        }`
    );
    throw err;
  }

  // Step 4 — Issue access token.
  const token = generateAccessToken(customer.id);

  return { customer, token };
}

/**
 * login — verifies credentials and issues an access token.
 *
 * Email is looked up in the Identity-owned credentials table; no customer
 * database join is required.
 * Uses a constant-time bcrypt compare to avoid timing-based enumeration.
 */
export async function login(input: LoginInput): Promise<LoginResult> {
  const { email, password } = input;

  // Step 1 — Look up the credential by the normalized login email.
  const credential = await findCredentialByEmail(email);

  // Step 2 — Validate password. Use the same error message whether the email
  // is not found or the password is wrong to avoid user enumeration.
  const INVALID_MSG = "Invalid email or password";

  if (!credential) {
    // Run a dummy bcrypt to prevent timing-based email enumeration.
    await bcrypt.hash(password, BCRYPT_COST);
    throw new UnauthorizedError(INVALID_MSG);
  }

  const passwordMatch = await bcrypt.compare(password, credential.password_hash);
  if (!passwordMatch) {
    throw new UnauthorizedError(INVALID_MSG);
  }

  // Step 3 — Issue access token.
  const token = generateAccessToken(credential.customer_id);

  return { customerId: credential.customer_id, token };
}
