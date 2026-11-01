import { z } from "zod";

import { createCustomerSchema } from "../customers/customer.schema";

const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(72, "Password must be at most 72 characters")
  .refine((password) => Buffer.byteLength(password, "utf8") <= 72, "Password must be at most 72 bytes");

export const registerSchema = createCustomerSchema.extend({
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
