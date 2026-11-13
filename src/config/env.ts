import dotenv from "dotenv"
import {z} from 'zod';

const envFile=process.env.NODE_ENV==='test'? ".env.test":".env"
dotenv.config({path:envFile,override: false,});

const envSchema=z.object({
    PORT:z.coerce.number().int().positive(),
    NODE_ENV:z.enum(["development","production","test"]),
    DATABASE_HOST:z.string().min(1),
    DATABASE_PORT: z.coerce.number().int().positive(),
    DATABASE_PASSWORD:z.string().min(1),
    DATABASE_NAME:z.string().min(1),
    DATABASE_USER:z.string().min(1),
    LOG_LEVEL:z.enum(['debug','info','warn','error','fatal','trace']),
    IDEMPOTENCY_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
    IDEMPOTENCY_CLEANUP_INTERVAL_MS: z.coerce.number().int().positive().default(3_600_000),
    JWT_SECRET: z.string().min(32),
    JWT_EXPIRATION_HOURS: z.coerce.number().int().positive().default(24),
    // Shared secret used by the Identity Service to call the internal customer provisioning endpoint.
    // No default — must be explicitly set in the environment.
    CUSTOMER_PROVISIONING_SECRET: z.string().min(1),
    CUSTOMER_SERVICE_URL: z.string().url(),
    OUTBOX_PUBLISHER_ENABLED: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
    OUTBOX_SQS_QUEUE_URL: z.preprocess(
        (value) => value === "" ? undefined : value,
        z.string().url().optional()
    ),
    AWS_REGION: z.string().min(1).default("us-east-1"),
    OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().min(100).default(1_000),
    OUTBOX_BATCH_SIZE: z.coerce.number().int().min(1).max(10).default(10),
    OUTBOX_LEASE_MS: z.coerce.number().int().min(1_000).default(60_000),
    OUTBOX_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(8),
    OUTBOX_RETRY_BASE_MS: z.coerce.number().int().min(1).default(1_000),
    OUTBOX_RETRY_MAX_MS: z.coerce.number().int().min(1).default(60_000),
    SCHEDULED_TRANSFER_WORKER_ENABLED: z
        .enum(["true", "false"])
        .default("true")
        .transform((value) => value === "true"),
    SCHEDULED_TRANSFER_POLL_INTERVAL_MS: z.coerce.number().int().min(1_000).default(30_000),
    SCHEDULED_TRANSFER_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(20),
    SCHEDULED_TRANSFER_MISFIRE_GRACE_SECONDS: z.coerce.number().int().min(30).max(3_600).default(300),
}).superRefine((config, context) => {
    if (config.OUTBOX_PUBLISHER_ENABLED && !config.OUTBOX_SQS_QUEUE_URL) {
        context.addIssue({
            code: "custom",
            path: ["OUTBOX_SQS_QUEUE_URL"],
            message: "OUTBOX_SQS_QUEUE_URL is required when the publisher is enabled",
        });
    }
})

const parsed=envSchema.safeParse(process.env)
if(!parsed.success){
    console.error("\n❌ Invalid environment variables\n");
    console.error(parsed.error.format());
    process.exit(1);
}
export const env=parsed.data;
