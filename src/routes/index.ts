import { Router } from "express";
import accountRoutes from "../modules/bank-accounts/account.routes";
import bankingRoutes from "../modules/banking/banking.routes";
import customerRoutes from "../modules/customers/customer.routes";
import transactionRoutes from "../modules/transactions/transaction.routes";

const router = Router();

router.use("/customers", customerRoutes);
router.use("/accounts", accountRoutes);
router.use("/banking", bankingRoutes);
router.use("/transactions", transactionRoutes);

export default router;


