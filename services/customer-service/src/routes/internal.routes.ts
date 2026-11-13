import { Router } from "express";

import {
  createCustomerHandler,
  getCustomerContactHandler,
  getCustomerExistenceHandler,
} from "../customer.controller";
import { verifyInternalSecret } from "../middleware/internal-auth";
import { verifyNotificationServiceSecret } from "../middleware/notification-auth";

const router = Router();

router.post("/", verifyInternalSecret, createCustomerHandler);
router.get(
  "/:customerId/contact",
  verifyNotificationServiceSecret,
  getCustomerContactHandler
);
router.get("/:customerId", verifyInternalSecret, getCustomerExistenceHandler);

export default router;
