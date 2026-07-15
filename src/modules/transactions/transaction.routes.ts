import { Router } from "express";
import { getTransactionDetailsHandler } from "./transaction.controller";

const router = Router();

router.get("/:transactionId", getTransactionDetailsHandler);

export default router;
