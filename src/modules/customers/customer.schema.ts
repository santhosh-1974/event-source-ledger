import { z } from "zod";

export const createCustomerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Full name must be at least 3 characters")
    .max(255),

  email: z
    .email()
    .trim()
    .toLowerCase(),

  phone: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Phone number must contain exactly 10 digits"),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;