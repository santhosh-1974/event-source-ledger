import { Router } from "express";

import {
  createCustomerHandler,
  getCustomerExistenceHandler,
} from "../customer.controller";
import { verifyInternalSecret } from "../middleware/internal-auth";

const router = Router();

router.post("/", verifyInternalSecret, createCustomerHandler);
router.get("/:customerId", verifyInternalSecret, getCustomerExistenceHandler);

export default router;
