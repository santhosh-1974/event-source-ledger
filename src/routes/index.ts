import { Router } from "express";
import accountRoutes from "../modules/accounts/account.routes";
import customerRoutes from "../modules/customers/customer.routes";

const router = Router();

router.use("/customers", customerRoutes);
router.use("/accounts", accountRoutes);

export default router;


