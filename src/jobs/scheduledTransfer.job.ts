import { env } from "../config/env";
import { logger } from "../config/logger";
import { processDueScheduledTransfers } from "../modules/scheduled-transfers/scheduled-transfer.service";

let pollingTimer: ReturnType<typeof setInterval> | null = null;
let activePoll: Promise<void> | null = null;

export function startScheduledTransferJob(): void {
  if (!env.SCHEDULED_TRANSFER_WORKER_ENABLED || pollingTimer) return;

  const runPoll = () => {
    if (activePoll) return;
    activePoll = processDueScheduledTransfers()
      .then((result) => {
        if (result.succeeded || result.failed || result.skipped) {
          logger.info(result, "Scheduled transfer poll completed");
        }
      })
      .catch((error: unknown) => {
        logger.error({ err: error }, "Scheduled transfer poll failed");
      })
      .finally(() => {
        activePoll = null;
      });
  };

  runPoll();
  pollingTimer = setInterval(runPoll, env.SCHEDULED_TRANSFER_POLL_INTERVAL_MS);
  pollingTimer.unref();
  logger.info(
    {
      pollIntervalMs: env.SCHEDULED_TRANSFER_POLL_INTERVAL_MS,
      misfireGraceSeconds: env.SCHEDULED_TRANSFER_MISFIRE_GRACE_SECONDS,
    },
    "Scheduled transfer worker started"
  );
}

export async function stopScheduledTransferJob(): Promise<void> {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
  if (activePoll) await activePoll;
}
