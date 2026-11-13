import app from "./app"
import { connectDB, disconnectDB } from "./database/database"
import { env } from "./config/env";
import { logger } from "./config/logger";
import { startIdempotencyCleanupJob, stopIdempotencyCleanupJob } from "./jobs/idempotencyCleanup.job";
import { startOutboxPublisherJob, stopOutboxPublisherJob } from "./jobs/outboxPublisher.job";

async function bootstrap() {
    try {
        await connectDB();
        startIdempotencyCleanupJob();
        startOutboxPublisherJob();

        const server = app.listen(env.PORT, () => logger.info(`Server running on http://localhost:${env.PORT}`))

        let shuttingDown = false;
        async function shutdown(signal: string) {
            if (shuttingDown) return;
            shuttingDown = true;
            logger.info(`${signal} received.Shutting down`)
            stopIdempotencyCleanupJob();
            try {
                await stopOutboxPublisherJob();
                await new Promise<void>((resolve, reject) => {
                    server.close((error) => {
                        if (error) reject(error);
                        else resolve();
                    });
                });
                await disconnectDB();
                logger.info("HTTP server closed")
            } catch (error) {
                logger.error({ err: error }, "Failed during graceful shutdown");
                process.exitCode = 1;
            }
        }

        process.on("SIGINT", () => shutdown("SIGINT"))
        process.on("SIGTERM", () => shutdown("SIGTERM"))
    } catch (err) {
        logger.fatal(err, "Application failed to start")
        process.exit(1)
    }
}
bootstrap();