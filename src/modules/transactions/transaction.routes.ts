import { Router } from "express";
import { requireOwnedTransaction } from "../../middleware/ownership";
import { getTransactionDetailsHandler } from "./transaction.controller";

const router = Router();

router.get("/:transactionId", requireOwnedTransaction, getTransactionDetailsHandler);

export default router;
