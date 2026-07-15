import { NotFoundError } from "../../errors/errors";
import { TransactionDetails } from "./transaction.types";
import { findDetailsById } from "./transaction.repository";

export async function getTransactionDetails(transactionId: string): Promise<TransactionDetails> {
  const transaction = await findDetailsById(transactionId);
  if (!transaction) throw new NotFoundError("Transaction not found.");
  return transaction;
}
