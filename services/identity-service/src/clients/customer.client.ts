/**
 * customer.client.ts
 *
 * HTTP client for the internal Customer provisioning endpoint exposed by
 * Customer Service at:
 *   POST {CUSTOMER_SERVICE_URL}/api/v1/internal/customers
 *
 * This module uses Node.js native fetch (Node ≥ 18).
 * It does NOT import any monolith repositories, database code, or schemas.
 */

import { z } from "zod";

import { env } from "../config/env";
import {
  BadRequestError,
  ConflictError,
  InternalServerError,
  ServiceUnavailableError,
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

const customerEnvelopeSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string().email(),
    phone: z.string(),
    createdAt: z.string().datetime(),
  }),
});

/** Request timeout in milliseconds. */
const REQUEST_TIMEOUT_MS = 8_000;

/**
 * Calls the internal Customer provisioning endpoint.
 *
 * @throws {ValidationError}    on 400 or 422 — bad input from the caller.
 * @throws {InternalServerError} on 401 — secret misconfiguration between services.
 * @throws {ConflictError}      on 409 — email or phone already registered.
 * @throws {ServiceUnavailableError} on 5xx, timeouts, or network failures.
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
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new InternalServerError(
        "Customer service returned an unreadable success response"
      );
    }
    const parsed = customerEnvelopeSchema.safeParse(body);
    if (!parsed.success) {
      throw new InternalServerError(
        "Customer service returned an invalid success response"
      );
    }
    return parsed.data.data;
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
      throw new InternalServerError(
        "Customer service authentication failed"
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
