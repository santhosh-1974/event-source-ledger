import { Router } from "express";

import { authenticate } from "../middleware/authentication";
import accountRoutes from "../modules/bank-accounts/account.routes";
import authRoutes from "../modules/auth/auth.routes";
import bankingRoutes from "../modules/banking/banking.routes";
import customerRoutes from "../modules/customers/customer.routes";
import internalRoutes from "../modules/customers/internal.routes";
import transactionRoutes from "../modules/transactions/transaction.routes";

const router = Router();

// Public routes
router.use("/auth", authRoutes);

// Internal service-to-service routes — protected by shared secret, NOT by user JWT
router.use("/internal", internalRoutes);

// All routes below require a valid user JWT
router.use(authenticate);
router.use("/customers", customerRoutes);
router.use("/accounts", accountRoutes);
router.use("/banking", bankingRoutes);
router.use("/transactions", transactionRoutes);

export default router;
