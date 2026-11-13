import { z } from "zod";

import { env } from "../config/env";

const customerContactSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.uuid(),
    email: z.email(),
  }),
});

export async function getCustomerEmail(customerId: string): Promise<string> {
  const url = new URL(
    `/api/v1/internal/customers/${customerId}/contact`,
    env.CUSTOMER_SERVICE_URL
  );
  const response = await fetch(url, {
    headers: {
      "x-notification-service-secret":
        env.NOTIFICATION_CUSTOMER_LOOKUP_SECRET,
    },
    signal: AbortSignal.timeout(5_000),
  });

  if (!response.ok) {
    throw new Error(`Customer contact lookup failed with status ${response.status}`);
  }

  const result = customerContactSchema.parse(await response.json());
  if (result.data.id !== customerId) {
    throw new Error("Customer contact lookup returned an unexpected customer");
  }
  return result.data.email;
}
