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

export const transactionHistoryQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.enum(["asc", "desc"]).default("desc"),
});

export const balanceQuerySchema = z.object({
    at: z.string().datetime({ offset: true }).optional(),
});

export type depositInput = z.infer<typeof depositInputSchema>;
export type withdrawInput = z.infer<typeof withdrawInputSchema>;
export type transferInput = z.infer<typeof transferInputSchema>;

