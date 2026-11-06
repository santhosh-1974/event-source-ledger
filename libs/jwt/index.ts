import jwt, { JwtPayload } from "jsonwebtoken";
import { env } from "../src/config/env";

// Shared JWT configuration constants (must match original implementation)
const JWT_ISSUER = "event-sourced-ledger";
const JWT_AUDIENCE = "banking-api";

/**
 * Create a signed access token for a given customer ID.
 * Mirrors the original createAccessToken implementation.
 */
export function createAccessToken(customerId: string): string {
  return jwt.sign({ customerId }, env.JWT_SECRET, {
    algorithm: "HS256",
    subject: customerId,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    expiresIn: `${env.JWT_EXPIRATION_HOURS}h`,
  });
}

/**
 * Verify an access token and return the embedded customer ID (subject).
 * Throws UnauthorizedError on invalid tokens – callers should handle it.
 */
export function verifyAccessToken(token: string): string {
  const payload = jwt.verify(token, env.JWT_SECRET, {
    algorithms: ["HS256"],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  }) as JwtPayload & { customerId?: unknown };

  if (typeof payload.sub !== "string" || payload.customerId !== payload.sub) {
    // Importing error class lazily to avoid circular deps.
    const { UnauthorizedError } = require("../src/errors/errors");
    throw new UnauthorizedError("Invalid or expired authentication token");
  }

  return payload.sub;
}
