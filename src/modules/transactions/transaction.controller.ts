import { Request, Response } from "express";
import { transactionParamsSchema } from "./transaction.schema";
import { getTransactionDetails } from "./transaction.service";

export async function getTransactionDetailsHandler(req: Request, res: Response): Promise<void> {
  const { transactionId } = transactionParamsSchema.parse(req.params);
  const transaction = await getTransactionDetails(transactionId);
  res.status(200).json({ success: true, data: transaction });
}
