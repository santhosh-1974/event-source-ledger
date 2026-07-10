import { Router } from "express";
import {createCustomerHandler,getCustomerByIdHandler,getAllCustomersHandler,
} from "./customer.controller";

const router = Router();

router.post("/create-customer", createCustomerHandler);
router.get("/", getAllCustomersHandler);
router.get("/:customerId", getCustomerByIdHandler);

export default router;