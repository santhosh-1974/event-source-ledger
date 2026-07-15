import { z } from "zod";

export const transactionParamsSchema = z.object({
  transactionId: z.string().uuid("Transaction id must be a valid UUID"),
});
