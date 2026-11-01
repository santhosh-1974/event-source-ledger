import { Router } from "express";
import { getCustomerByIdHandler, getCurrentCustomerHandler } from "./customer.controller";

const router = Router();

// Customer creation is only available through /auth/register so customer and
// credentials are committed atomically.
router.get("/", getCurrentCustomerHandler);
router.get("/me", getCurrentCustomerHandler);
router.get("/:customerId", getCustomerByIdHandler);

export default router;