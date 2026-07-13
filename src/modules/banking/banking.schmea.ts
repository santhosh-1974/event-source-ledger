import { z } from "zod";

const amountSchema = z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount").refine((value) => Number(value) > 0, "Amount must be greater than zero");
const accountNumberSchema = z.string().trim().min(1, "Account number is required").max(20);

export const depositInputSchema = z.object({
    amount: amountSchema,
    accountNumber: accountNumberSchema,
});

export const withdrawInputSchema = z.object({
    amount: amountSchema,
    accountNumber: accountNumberSchema,
});

export const transferInputSchema = z.object({
    fromAccountNumber: accountNumberSchema,
    toAccountNumber: accountNumberSchema,
    amount: amountSchema,
    description: z.string().trim().max(255).optional(),
});

export type depositInput = z.infer<typeof depositInputSchema>;
export type withdrawInput = z.infer<typeof withdrawInputSchema>;
export type transferInput = z.infer<typeof transferInputSchema>;

