import { Router } from "express";
import { idempotencyMiddleware } from "../../middleware/idempotency.middleware";
import { requireOwnedAccounts } from "../../middleware/ownership";
import { depositHandler, getAccountBalanceHandler, getAccountTransactionsHandler, transferHandler, withdrawHandler } from "./banking.controller";

const router = Router();

router.post("/deposit", requireOwnedAccounts(["accountNumber"], "body"), idempotencyMiddleware, depositHandler);
router.post("/withdraw", requireOwnedAccounts(["accountNumber"], "body"), idempotencyMiddleware, withdrawHandler);
router.post("/transfer", requireOwnedAccounts(["fromAccountNumber", "toAccountNumber"], "body"), idempotencyMiddleware, transferHandler);
router.get("/:accountNumber/balance", requireOwnedAccounts(["accountNumber"], "params"), getAccountBalanceHandler);
router.get("/:accountNumber/history", requireOwnedAccounts(["accountNumber"], "params"), getAccountTransactionsHandler);

export default router;
