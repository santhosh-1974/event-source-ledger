import { z } from "zod";

const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(72, "Password must be at most 72 characters")
  .refine(
    (password) => Buffer.byteLength(password, "utf8") <= 72,
    "Password must be at most 72 bytes"
  );

export const registerSchema = z.object({
  name: z.string().trim().min(3).max(255),
  email: z.string().trim().email().toLowerCase(),
  phone: z.string().trim().regex(/^\d{10}$/),
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: passwordSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
