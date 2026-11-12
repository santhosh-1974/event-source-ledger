import { Router } from "express";

import {
  getCurrentCustomerHandler,
  getCustomerByIdHandler,
  updateCurrentCustomerHandler,
  updateCustomerByIdHandler,
} from "../customer.controller";

const router = Router();

router.get("/", getCurrentCustomerHandler);
router.get("/me", getCurrentCustomerHandler);
router.get("/:customerId", getCustomerByIdHandler);
router.patch("/me", updateCurrentCustomerHandler);
router.patch("/:customerId", updateCustomerByIdHandler);

export default router;
