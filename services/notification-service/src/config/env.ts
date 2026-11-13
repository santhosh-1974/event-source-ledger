import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(5003),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    POSTGRES_HOST: z.string().min(1),
    POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
    POSTGRES_USER: z.string().min(1),
    POSTGRES_PASSWORD: z.string().min(1),
    POSTGRES_DB: z.string().min(1),
    JWT_SECRET: z.string().min(32),
    CUSTOMER_SERVICE_URL: z.string().url(),
    NOTIFICATION_CUSTOMER_LOOKUP_SECRET: z.string().min(1),
    NOTIFICATION_CONSUMER_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    NOTIFICATION_SQS_QUEUE_URL: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().url().optional()
    ),
    NOTIFICATION_SES_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    NOTIFICATION_SES_FROM_EMAIL: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.email().optional()
    ),
    AWS_REGION: z.string().min(1).default("us-east-1"),
    NOTIFICATION_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(100).default(5),
    NOTIFICATION_SEND_LEASE_SECONDS: z.coerce.number().int().min(30).max(3600).default(180),
    NOTIFICATION_SQS_WAIT_TIME_SECONDS: z.coerce.number().int().min(1).max(20).default(20),
    NOTIFICATION_SQS_VISIBILITY_TIMEOUT_SECONDS: z.coerce.number().int().min(30).max(43200).default(300),
  })
  .superRefine((config, context) => {
    if (config.NOTIFICATION_SES_ENABLED && !config.NOTIFICATION_SES_FROM_EMAIL) {
      context.addIssue({
        code: "custom",
        path: ["NOTIFICATION_SES_FROM_EMAIL"],
        message: "A verified sender address is required when SES is enabled",
      });
    }

    if (config.NOTIFICATION_CONSUMER_ENABLED) {
      if (!config.NOTIFICATION_SQS_QUEUE_URL) {
        context.addIssue({
          code: "custom",
          path: ["NOTIFICATION_SQS_QUEUE_URL"],
          message: "A queue URL is required when the consumer is enabled",
        });
      }
      if (!config.NOTIFICATION_SES_ENABLED) {
        context.addIssue({
          code: "custom",
          path: ["NOTIFICATION_SES_ENABLED"],
          message: "SES must be enabled when the SQS consumer is enabled",
        });
      }
    }
  });

export const env = envSchema.parse(process.env);
