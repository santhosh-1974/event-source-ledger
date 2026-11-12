import { z } from "zod";

import { env } from "../../config/env";
import {
  InternalServerError,
  NotFoundError,
  ServiceUnavailableError,
} from "../../errors/errors";

const customerExistsResponse = z.object({
  success: z.literal(true),
  data: z.object({ id: z.string().uuid() }),
});

const REQUEST_TIMEOUT_MS = 5_000;

export async function assertCustomerExists(customerId: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(
      `${env.CUSTOMER_SERVICE_URL.replace(/\/+$/, "")}/api/v1/internal/customers/${encodeURIComponent(customerId)}`,
      {
        headers: {
          "x-internal-service-secret": env.CUSTOMER_PROVISIONING_SECRET,
        },
        signal: controller.signal,
      }
    );
  } catch (error: unknown) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    throw new ServiceUnavailableError(
      timedOut ? "Customer service request timed out" : "Customer service is unavailable"
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 404) {
    throw new NotFoundError("Customer not found.");
  }
  if (response.status === 401) {
    throw new InternalServerError("Customer service authentication failed");
  }
  if (response.status >= 500) {
    throw new ServiceUnavailableError(
      `Customer service returned status ${response.status}`
    );
  }
  if (response.status !== 200) {
    throw new InternalServerError(
      `Unexpected response from customer service (${response.status})`
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new InternalServerError("Customer service returned invalid JSON");
  }

  if (!customerExistsResponse.safeParse(body).success) {
    throw new InternalServerError("Customer service returned an invalid response");
  }
}
