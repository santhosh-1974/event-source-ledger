import { z } from "zod";
import dotenv from "dotenv";

// Load .env file if present
dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(5001),
  POSTGRES_HOST: z.string(),
  POSTGRES_PORT: z.coerce.number().default(5432),
  POSTGRES_USER: z.string(),
  POSTGRES_PASSWORD: z.string(),
  POSTGRES_DB: z.string(),
  JWT_SECRET: z.string(),
  JWT_EXPIRATION_HOURS: z.coerce.number().default(24),
  // Base URL of Customer Service.
  CUSTOMER_SERVICE_URL: z.string().url(),
  // Secret shared between Identity and Customer services for internal APIs.
  CUSTOMER_PROVISIONING_SECRET: z.string(),
});

export const env = envSchema.parse(process.env);
