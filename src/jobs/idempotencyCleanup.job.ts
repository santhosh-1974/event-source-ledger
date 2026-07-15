import { env } from "../config/env";
import { logger } from "../config/logger";
import { cleanupExpiredKeys } from "../modules/idempotency/idempotency.service";

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

export function startIdempotencyCleanupJob(): void {
    if (cleanupTimer) {
        return;
    }
    const runCleanup = async () => {
        try {
            const deleted = await cleanupExpiredKeys();
            if (deleted > 0) {
                logger.info({ deleted }, "Cleaned up expired idempotency keys");
            }
        } catch (error) {
            logger.error(error, "Failed to clean up expired idempotency keys");
        }
    };

    void runCleanup();
    cleanupTimer = setInterval(runCleanup, env.IDEMPOTENCY_CLEANUP_INTERVAL_MS);
    cleanupTimer.unref();
}

export function stopIdempotencyCleanupJob(): void {
    if (cleanupTimer) {
        clearInterval(cleanupTimer);
        cleanupTimer = null;
    }
}
