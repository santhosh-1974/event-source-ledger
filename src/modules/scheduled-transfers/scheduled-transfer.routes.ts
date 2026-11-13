import { Router } from "express";

import { idempotencyMiddleware } from "../../middleware/idempotency.middleware";
import {
  changeScheduledTransferStateHandler,
  createScheduledTransferHandler,
  listScheduledTransferOccurrencesHandler,
  listScheduledTransfersHandler,
  retryScheduledTransferOccurrenceHandler,
} from "./scheduled-transfer.controller";

const router = Router();

router.get("/", listScheduledTransfersHandler);
router.post("/", idempotencyMiddleware, createScheduledTransferHandler);
router.get("/:scheduleId/occurrences", listScheduledTransferOccurrencesHandler);
router.post(
  "/:scheduleId/occurrences/:occurrenceId/retry",
  idempotencyMiddleware,
  retryScheduledTransferOccurrenceHandler
);
router.post("/:scheduleId/:action", changeScheduledTransferStateHandler);

export default router;
