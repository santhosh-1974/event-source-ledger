import { z } from "zod";

export const createAccountSchema = z.object({
    name: z.string().trim().min(2, "Account name must be at least 2 characters").max(255),
    type: z.enum(["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"]),
    category: z.enum(["SYSTEM", "CUSTOMER"]),
});

export const updateAccountSchema = createAccountSchema.partial();

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;