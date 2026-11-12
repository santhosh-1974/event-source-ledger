import { Router } from "express";

import { authenticate } from "../middleware/authentication";
import accountRoutes from "../modules/bank-accounts/account.routes";
import bankingRoutes from "../modules/banking/banking.routes";
import transactionRoutes from "../modules/transactions/transaction.routes";

const router = Router();

// All routes below require a valid user JWT
router.use(authenticate);
router.use("/accounts", accountRoutes);
router.use("/banking", bankingRoutes);
router.use("/transactions", transactionRoutes);

export default router;
