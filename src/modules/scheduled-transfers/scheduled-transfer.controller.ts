import { Request, Response } from "express";

import { NotFoundError } from "../../errors/errors";
import { IdempotencyRequest } from "../../middleware/idempotency.middleware";
import {
  createScheduledTransfer,
  getScheduledTransferOccurrences,
  getScheduledTransfers,
  retryScheduledTransferOccurrence,
  setScheduledTransferState,
} from "./scheduled-transfer.service";
import {
  createScheduledTransferSchema,
  occurrenceParamsSchema,
  scheduleIdSchema,
} from "./scheduled-transfer.schema";

function customerId(req: Request): string {
  if (!req.auth?.customerId) {
    throw new NotFoundError("Authenticated customer not found.");
  }
  return req.auth.customerId;
}

export async function listScheduledTransfersHandler(
  req: Request,
  res: Response
): Promise<void> {
  const data = await getScheduledTransfers(customerId(req));
  res.status(200).json({ success: true, data });
}

export async function createScheduledTransferHandler(
  req: Request,
  res: Response
): Promise<void> {
  const input = createScheduledTransferSchema.parse(req.body);
  const idempotencyKey = (req as IdempotencyRequest).idempotencyKey;
  const data = await createScheduledTransfer(
    input,
    customerId(req),
    idempotencyKey
  );
  res.status(201).json({ success: true, data });
}

export async function changeScheduledTransferStateHandler(
  req: Request,
  res: Response
): Promise<void> {
  const scheduleId = scheduleIdSchema.parse(req.params.scheduleId);
  const action = req.params.action;
  if (action !== "pause" && action !== "resume" && action !== "cancel") {
    throw new NotFoundError("Scheduled transfer action not found.");
  }
  const data = await setScheduledTransferState(
    customerId(req),
    scheduleId,
    action
  );
  res.status(200).json({ success: true, data });
}

export async function listScheduledTransferOccurrencesHandler(
  req: Request,
  res: Response
): Promise<void> {
  const params = occurrenceParamsSchema
    .pick({ scheduleId: true })
    .parse(req.params);
  const data = await getScheduledTransferOccurrences(
    customerId(req),
    params.scheduleId
  );
  res.status(200).json({ success: true, data });
}

export async function retryScheduledTransferOccurrenceHandler(
  req: Request,
  res: Response
): Promise<void> {
  const { scheduleId, occurrenceId } = occurrenceParamsSchema.parse(
    req.params
  );
  const idempotencyKey = (req as IdempotencyRequest).idempotencyKey;
  const data = await retryScheduledTransferOccurrence(
    customerId(req),
    scheduleId,
    occurrenceId,
    idempotencyKey
  );
  res.status(200).json({ success: true, data });
}
