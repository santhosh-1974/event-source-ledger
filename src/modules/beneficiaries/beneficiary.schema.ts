import { z } from "zod";

const accountNumberSchema = z.string().trim().min(1).max(20);

export const createBeneficiarySchema = z
  .object({
    accountNumber: accountNumberSchema,
    displayName: z.string().trim().min(1).max(80),
  })
  .strict();

export const updateBeneficiarySchema = z
  .object({
    enabled: z.boolean(),
  })
  .strict();

export const beneficiaryIdSchema = z.uuid();

export type CreateBeneficiaryInput = z.infer<typeof createBeneficiarySchema>;
