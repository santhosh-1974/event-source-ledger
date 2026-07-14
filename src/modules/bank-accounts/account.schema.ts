import { z } from "zod";

export const accountStatusValues = ["ACTIVE", "BLOCKED", "CLOSED"] as const;
export const accountTypeValues = ["SAVINGS", "CURRENT"] as const;

export const createAccountSchema = z.object({
    customerId: z.string().uuid("Customer id must be a valid UUID"),
    accountNumber: z.string().trim().min(1, "Account number is required").max(20, "Account number must be at most 20 characters"),
    accountType: z.enum(accountTypeValues),
    status: z.enum(accountStatusValues).optional(),
});

export const updateAccountSchema = z.object({
    accountNumber: z.string().trim().min(1, "Account number is required").max(20, "Account number must be at most 20 characters").optional(),
    accountType: z.enum(accountTypeValues).optional(),
    status: z.enum(accountStatusValues).optional(),
});

export const updateAccountStatusSchema = z.object({
    status: z.enum(accountStatusValues),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type UpdateAccountStatusInput = z.infer<typeof updateAccountStatusSchema>;