import express from "express";
import {
  ClearSession,
  CreateFrontLog,
  GetAllSessionsLogs,
  GetLogsFileName,
  GetOneLog,
} from "../controllers/logController.js";
import { isAuthenticated } from "../middlewares/authMiddleware.js";

const router = express.Router();
router.route("/front").post(CreateFrontLog);
router.use(isAuthenticated);

router.route("/").post(GetLogsFileName);
router.route("/file").post(GetOneLog);
router.route("/session").post(GetAllSessionsLogs).put(ClearSession);

export default router;
