import express from "express";
import {
  CloseRunningSession,
  Login,
  Logout,
  ReSendOtpKey,
  VerifyOtpAndLogin,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/login", Login);
router.post("/close", CloseRunningSession);
router.post("/resend", ReSendOtpKey);
router.post("/verifiy", VerifyOtpAndLogin);
router.post("/logout", Logout);

export default router;
