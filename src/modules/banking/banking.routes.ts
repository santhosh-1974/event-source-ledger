import { Router } from "express";
import { depositHandler, getAccountBalanceHandler, getAccountTransactionsHandler, transferHandler, withdrawHandler } from "./banking.controller";

const router = Router();

router.post("/deposit", depositHandler);
router.post("/withdraw", withdrawHandler);
router.post("/transfer", transferHandler);
router.get("/:accountNumber/balance", getAccountBalanceHandler);
router.get("/:accountNumber/transactions", getAccountTransactionsHandler);

export default router;