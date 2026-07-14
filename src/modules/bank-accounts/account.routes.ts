import { Router } from "express";
import {
    createAccountHandler,
    deleteAccountHandler,
    getAccountByIdHandler,
    getAllAccountsHandler,
    updateAccountHandler,
    updateAccountStatusHandler,
} from "./account.controller";

const router = Router();

router.post("/", createAccountHandler);
router.get("/", getAllAccountsHandler);
router.get("/:accountId", getAccountByIdHandler);
router.patch("/:accountId", updateAccountHandler);
router.patch("/:accountNumber/status", updateAccountStatusHandler);
router.delete("/:accountId", deleteAccountHandler);

export default router;