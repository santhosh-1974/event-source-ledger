/**
 * customer.client.ts
 *
 * HTTP client for the internal Customer provisioning endpoint exposed by
 * the backend monolith at:
 *   POST {CUSTOMER_SERVICE_URL}/api/v1/internal/customers
 *
 * This module uses Node.js native fetch (Node ≥ 18).
 * It does NOT import any monolith repositories, database code, or schemas.
 */

import { env } from "../config/env";
import {
  BadRequestError,
  ConflictError,
  InternalServerError,
  ServiceUnavailableError,
  UnauthorizedError,
  ValidationError,
} from "../errors/errors";

/** Shape of the customer record returned by the provisioning endpoint. */
export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string; // ISO-8601 string as returned over HTTP
}

/** Input accepted by createCustomer — mirrors the monolith's createCustomerSchema. */
export interface CreateCustomerInput {
  name: string;
  email: string;
  phone: string;
}

/** Request timeout in milliseconds. */
const REQUEST_TIMEOUT_MS = 8_000;

/**
 * Calls the internal Customer provisioning endpoint.
 *
 * @throws {ValidationError}    on 400 or 422 — bad input from the caller.
 * @throws {UnauthorizedError}  on 401 — secret misconfiguration between services.
 * @throws {ConflictError}      on 409 — email or phone already registered.
 * @throws {InternalServerError} on 5xx, timeouts, or network failures — customer
 *                               service is unavailable or misbehaving.
 */
export async function createCustomer(
  data: CreateCustomerInput
): Promise<Customer> {
  const url = `${env.CUSTOMER_SERVICE_URL.replace(/\/+$/, "")}/api/v1/internal/customers`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Secret is sent in a custom header; never echoed in error messages.
        "x-internal-service-secret": env.CUSTOMER_PROVISIONING_SECRET,
      },
      body: JSON.stringify(data),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timer);
    // AbortError means the request timed out; all others are network failures.
    const isTimeout =
      err instanceof Error && err.name === "AbortError";
    throw new ServiceUnavailableError(
      isTimeout
        ? "Customer service request timed out"
        : "Customer service is unavailable"
    );
  }
  clearTimeout(timer);

  // ----- handle HTTP error status codes -----

  if (response.status === 201) {
    // Success path — parse the envelope: { success: true, data: Customer }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new InternalServerError(
        "Customer service returned an unreadable 201 response"
      );
    }
    const envelope = body as { success?: boolean; data?: Customer };
    if (!envelope?.data) {
      throw new InternalServerError(
        "Customer service response is missing the data field"
      );
    }
    return envelope.data;
  }

  // For non-201 responses, try to extract an error message from the body
  // without crashing if it isn't JSON.
  let errorMessage = "Unknown customer service error";
  try {
    const errBody = (await response.json()) as { error?: string; message?: string };
    errorMessage = errBody?.error ?? errBody?.message ?? errorMessage;
  } catch {
    // ignore parse failure — use the default message
  }

  switch (true) {
    case response.status === 400:
      throw new BadRequestError(`Customer validation failed: ${errorMessage}`);

    case response.status === 401:
      // 401 means the shared secret is wrong — this is an internal
      // service misconfiguration, not a user error.
      throw new UnauthorizedError(
        "Internal service authentication failed — check CUSTOMER_PROVISIONING_SECRET"
      );

    case response.status === 409:
      throw new ConflictError(errorMessage);

    case response.status === 422:
      throw new ValidationError(`Customer validation failed: ${errorMessage}`);

    case response.status >= 500:
      throw new ServiceUnavailableError(
        `Customer service error (${response.status}): ${errorMessage}`
      );

    default:
      throw new InternalServerError(
        `Unexpected response from customer service (${response.status})`
      );
  }
}
