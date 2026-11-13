import { Router } from "express";

import { authenticate } from "../middleware/authentication";
import {
  getPreferenceHandler,
  updatePreferenceHandler,
} from "./preferences.controller";

const router = Router();

router.use(authenticate);
router.get("/preferences", getPreferenceHandler);
router.put("/preferences", updatePreferenceHandler);

export default router;
