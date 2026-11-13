import { z } from "zod";

const amountSchema = z
  .string()
  .trim()
  .regex(/^\d{1,16}(\.\d{1,2})?$/, "Amount must fit NUMERIC(18,2)")
  .refine((value) => {
    const [whole, fraction = ""] = value.split(".");
    return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0")) > 0n;
  }, "Amount must be greater than zero");

export const createScheduledTransferSchema = z
  .object({
    fromAccountNumber: z.string().trim().min(1).max(20),
    beneficiaryId: z.uuid(),
    amount: amountSchema,
    description: z.string().trim().max(255).optional(),
    frequency: z.enum(["ONCE", "WEEKLY", "MONTHLY"]),
    startsAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const scheduleIdSchema = z.uuid();

export const occurrenceParamsSchema = z.object({
  scheduleId: z.uuid(),
  occurrenceId: z.uuid(),
});

export type CreateScheduledTransferInput = z.infer<
  typeof createScheduledTransferSchema
>;
