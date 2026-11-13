import { Router } from "express";

import { authenticate } from "../middleware/authentication";
import accountRoutes from "../modules/bank-accounts/account.routes";
import bankingRoutes from "../modules/banking/banking.routes";
import transactionRoutes from "../modules/transactions/transaction.routes";
import beneficiaryRoutes from "../modules/beneficiaries/beneficiary.routes";
import scheduledTransferRoutes from "../modules/scheduled-transfers/scheduled-transfer.routes";
import reportRoutes from "../modules/reporting/report.routes";

const router = Router();

// All routes below require a valid user JWT
router.use(authenticate);
router.use("/accounts", accountRoutes);
router.use("/banking", bankingRoutes);
router.use("/transactions", transactionRoutes);
router.use("/beneficiaries", beneficiaryRoutes);
router.use("/scheduled-transfers", scheduledTransferRoutes);
router.use("/reports", reportRoutes);

export default router;
