import express from "express";

import {
  CreateSubscriber,
  GetAllSubscriber,
  GetOneSubscriber,
  ResetSubscriberPassword,
  UnblockSubscriber,
  UpdateSubscriber,
  ActivateSubscriber,
  BlockSubscriber,
} from "../controllers/subscriberController.js";

import { hasRole, isAuthenticated } from "../middlewares/authMiddleware.js";

const router = express.Router();
router.use(isAuthenticated, hasRole(["Admin", "SuperUser"]));

router.route("/").post(GetAllSubscriber);
router.post("/create", CreateSubscriber);
router.post("/detail", GetOneSubscriber);
router.put("/update", UpdateSubscriber);
router.put("/activate", ActivateSubscriber);
router.put("/block", BlockSubscriber);
router.put("/unblock", UnblockSubscriber);
router.put("/reset", ResetSubscriberPassword);

export default router;
