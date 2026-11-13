import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5002),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  POSTGRES_HOST: z.string().min(1),
  POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
  POSTGRES_USER: z.string().min(1),
  POSTGRES_PASSWORD: z.string().min(1),
  POSTGRES_DB: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  CUSTOMER_PROVISIONING_SECRET: z.string().min(1),
  NOTIFICATION_CUSTOMER_LOOKUP_SECRET: z.string().min(1),
});

export const env = envSchema.parse(process.env);
