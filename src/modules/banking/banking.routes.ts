import { Router } from "express";
import { idempotencyMiddleware } from "../../middleware/idempotency.middleware";
import { depositHandler, getAccountBalanceHandler, getAccountTransactionsHandler, transferHandler, withdrawHandler } from "./banking.controller";

const router = Router();

router.post("/deposit", idempotencyMiddleware, depositHandler);
router.post("/withdraw", idempotencyMiddleware, withdrawHandler);
router.post("/transfer", idempotencyMiddleware, transferHandler);
router.get("/:accountNumber/balance", getAccountBalanceHandler);
router.get("/:accountNumber/transactions", getAccountTransactionsHandler);

export default router;