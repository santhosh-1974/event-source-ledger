import { z } from "zod";
import dotenv from "dotenv";

// Load .env file if present
dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  IDENTITY_SERVICE_URL: z.string().url(),
  CUSTOMER_SERVICE_URL: z.string().url(),
  BANKING_SERVICE_URL: z.string().url(),
  NOTIFICATION_SERVICE_URL: z
    .string()
    .url()
    .default("http://localhost:5003"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
});

export const env = envSchema.parse(process.env);
