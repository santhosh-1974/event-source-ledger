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

router.post("/create-account", createAccountHandler);
router.get("/", getAllAccountsHandler);
router.patch("/:accountNumber/status", updateAccountStatusHandler);
router.get("/:accountId", getAccountByIdHandler);
router.patch("/:accountId", updateAccountHandler);
router.delete("/:accountId", deleteAccountHandler);

export default router;
