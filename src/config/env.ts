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
})

const parsed=envSchema.safeParse(process.env)
if(!parsed.success){
    console.error("\n❌ Invalid environment variables\n");
    console.error(parsed.error.format());
    process.exit(1);
}
export const env=parsed.data;