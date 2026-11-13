import { Router } from "express";

import {
  createBeneficiaryHandler,
  listBeneficiariesHandler,
  updateBeneficiaryHandler,
} from "./beneficiary.controller";

const router = Router();

router.get("/", listBeneficiariesHandler);
router.post("/", createBeneficiaryHandler);
router.patch("/:beneficiaryId", updateBeneficiaryHandler);

export default router;
