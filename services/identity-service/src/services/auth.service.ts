/**
 * auth.service.ts
 *
 * Authentication business logic for the Identity Service.
 *
 * JWT compatibility note:
 *   Tokens issued here are intentionally compatible with the existing monolith
 *   authentication middleware. The exact claims (iss, aud, sub, customerId, exp)
 *   must not be changed without also updating the monolith's verifyAccessToken.
 *
 * Partial-failure note (credential save after customer creation):
 *   Registration calls the Customer Service over HTTP before writing credentials
 *   to the local database. If createUser() fails after createCustomer() succeeds,
 *   the customer record already exists in the monolith's database and cannot be
 *   rolled back via a local transaction. The failure is logged (without passwords
 *   or secrets) and re-thrown so the caller receives a 500. The customer account
 *   will be orphaned — the operator must reconcile it manually or via a
 *   compensating job. This is a known limitation of the distributed design.
 *
 * findByEmail dependency note:
 *   findByEmail() currently JOINs the customers table that lives in the same
 *   Postgres instance used by the monolith. This is a temporary read dependency:
 *   once the Identity Service has its own read model (e.g., email → customerId
 *   stored in the users table) this JOIN can be removed.
 */

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { createCustomer, Customer } from "../clients/customer.client";
import { env } from "../config/env";
import { ConflictError, UnauthorizedError } from "../errors/errors";
import { createUser, findByEmail } from "../repositories/user.repository";
import { LoginInput, RegisterInput } from "../auth.schema";

// ── JWT constants — must match the monolith's src/libs/jwt/index.ts ──────────
const JWT_ISSUER = "event-sourced-ledger";
const JWT_AUDIENCE = "banking-api";
const BCRYPT_COST = 12;

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
 * register — creates a customer via the Customer Service and saves credentials.
 *
 * Order of operations:
 *  1. Hash password (bcrypt, cost 12)
 *  2. Call Customer Service → customer record created in monolith DB
 *  3. Save (customerId, passwordHash) in Identity Service DB
 *  4. Issue JWT
 *
 * If step 3 fails the customer already exists and cannot be rolled back.
 * See the module-level note above.
 */
export async function register(input: RegisterInput): Promise<RegisterResult> {
  const { name, email, phone, password } = input;

  // Step 1 — Hash password before making any external calls.
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  // Step 2 — Provision customer record via the Customer Service.
  // ConflictError / ValidationError propagate directly to the caller.
  const customer = await createCustomer({ name, email, phone });

  // Step 3 — Persist credentials in the Identity Service's own database.
  // If this fails the customer is already created — log and re-throw.
  try {
    await createUser(customer.id, passwordHash);
  } catch (err: unknown) {
    // Log without exposing passwords, secrets, or the full error chain.
    const code = (err as { code?: string }).code ?? "unknown";

    // Postgres unique-constraint violation code
    if (code === "23505") {
      // The users row already exists (duplicate registration race).
      throw new ConflictError("Credentials for this customer already exist");
    }

    // Any other DB error after the customer was already created.
    // We cannot undo the HTTP request to the Customer Service.
    console.error(
      "[auth.service] PARTIAL FAILURE: customer created but credential save failed. " +
        `customerId=${customer.id} pgCode=${code}`
    );
    throw err; // Re-throw original error — caller gets 500
  }

  // Step 4 — Issue access token.
  const token = generateAccessToken(customer.id);

  return { customer, token };
}

/**
 * login — verifies credentials and issues an access token.
 *
 * findByEmail() joins the customers table (see module-level note).
 * Uses a constant-time bcrypt compare to avoid timing-based enumeration.
 */
export async function login(input: LoginInput): Promise<LoginResult> {
  const { email, password } = input;

  // Step 1 — Look up credential row (JOIN with customers table).
  const credential = await findByEmail(email);

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
