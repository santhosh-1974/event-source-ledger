import { Router } from "express";
import {
    createAccountHandler,
    deleteAccountHandler,
    getAccountByIdHandler,
    getAllAccountsHandler,
    updateAccountHandler,
} from "./account.controller";

const router = Router();

router.post("/", createAccountHandler);
router.get("/", getAllAccountsHandler);
router.get("/:accountId", getAccountByIdHandler);
router.patch("/:accountId", updateAccountHandler);
router.delete("/:accountId", deleteAccountHandler);

export default router;