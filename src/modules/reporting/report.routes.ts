import { Router } from "express";

import { accountStatementHandler } from "./report.controller";

const router = Router();

router.get("/statements/:accountNumber", accountStatementHandler);

export default router;
