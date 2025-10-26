import express from "express";
import {
  ChangeStateEmergencyband,
  CreateEmergencyband,
  GetAllEmergencybands,
  GetOneEmergencyband,
  UpdateEmergencyband,
} from "../controllers/emergencyBandController.js";

import {
  hasPrivilege,
  isAuthenticated,
} from "../middlewares/authMiddleware.js";

const router = express.Router();
router.use(isAuthenticated);

router.route("/").post(hasPrivilege("emergency.view"), GetAllEmergencybands);
router
  .route("/update")
  .put(hasPrivilege("emergency.edit"), UpdateEmergencyband);
router
  .route("/detail")
  .post(hasPrivilege("emergency.view"), GetOneEmergencyband);
router
  .route("/create")
  .post(hasPrivilege("emergency.create"), CreateEmergencyband);
router
  .route("/state")
  .put(hasPrivilege("emergency.publish"), ChangeStateEmergencyband);

export default router;
