import { Router } from "express";
import { createAccountHandler, getAccountByIdHandler, getAllAccountsHandler } from "./account.controller";

const router = Router();

router.post("/", createAccountHandler);
router.get("/", getAllAccountsHandler);
router.get("/:accountId", getAccountByIdHandler);

// Account updates, deletion and status changes are administrative operations;
// keep them disabled until an administrator authorization model exists.

export default router;