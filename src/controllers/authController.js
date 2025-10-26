import { ErrorHandler } from "../middlewares/errorMiddleware.js";
import { ValidationError } from "../middlewares/errorMiddleware.js";
import {
  verifyOTP,
  closeSessionAndSendOtpKey,
  resendOtpKey,
  login,
  logout,
} from "../services/authService.js";
import { createLogEntry } from "../utils/logger.js";
import { tryCatch } from "../utils/tryCatch.js";
import {
  signInSchema,
  verifyOTPSchema,
  closeSessionSchema,
  sendOtpSchema,
} from "../validations/authValidation.js";

// Utility function to extract log request data and send it to the authService
const Logdata = (req, action) => {
  return {
    ip: req.header("x-forwarded-for") || req.connection.remoteAddress,
    referrer: req.headers.referer || "-",
    userAgent: req.headers["user-agent"] || "-",
    action: action,
  };
};

const customLog = (req, options = {}) => {
  const { message, action, err } = options;

  // Get base log entry from createLogEntry
  const baseLogEntry = createLogEntry(req, err);

  // Add custom fields
  return {
    ...baseLogEntry,
    action: action || null,
    username: req.session?.username || null,
    ...(message && { message }),
  };
};

// Controller function for user login
export const Login = tryCatch(async (req, res) => {
  // Get IP address from request headers
  const ip = req.header("x-forwarded-for") || req.connection.remoteAddress;
  // Validate the request body against the schema
  const { error } = signInSchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Call the signIn service function to authenticate user
  const { hasSession, data } = await login(
    req.body,
    customLog(req, { action: "login" })
  );

  if (hasSession) {
    return res.status(200).json({
      success: true,
      message: "You have a session , do you want to close it ?",
      hasSession,
      data,
    });
  } else {
    return res.status(200).json({
      success: true,
      message: "OTP sent to your email. Please enter it.",
      hasSession,
      data,
    });
  }
});

// Controller function for closing an active session and sending OTP
export const CloseRunningSession = tryCatch(async (req, res) => {
  // Validate the request body against the schema
  const { error } = closeSessionSchema.validate(req.body);
  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Call the CloseSessionAndSendOtpKey service function to close session and send OTP
  const { hasSession, data, username } = await closeSessionAndSendOtpKey(
    req.body,
    customLog(req, { action: "login" })
  );

  // Respond with success message and data (userId,email)
  return res.status(200).json({
    success: true,
    message: "OTP sent to your email. Please enter it.",
    hasSession,
    data,
  });
});

export const ReSendOtpKey = tryCatch(async (req, res) => {
  // Validate the request body against the schema
  const { error } = sendOtpSchema.validate(req.body);
  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Call the sendOtpKey service function to resend OTP
  const { hasSession, data, username } = await resendOtpKey(
    req.body,
    customLog(req, { action: "login" })
  );

  // Respond with success message and data (userId,email)
  return res.status(200).json({
    success: true,
    message: "OTP envoyé à votre email. Veuillez le saisir.",
    hasSession,
    data,
  });
});

// Controller function for verifying OTP and logging in
export const VerifyOtpAndLogin = tryCatch(async (req, res) => {
  // Get IP address from request headers
  const ip = req.header("x-forwarded-for") || req.connection.remoteAddress;
  // Validate the request body against the schema
  const { error } = verifyOTPSchema.validate(req.body);
  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Call the verifyOTP service function to verify OTP and login
  const { sessionId, data } = await verifyOTP(
    { ...req.body, ip },
    customLog(req, { action: "login" })
  );

  // Set data in session cookies to send
  req.session.sessionId = sessionId;
  req.session.username = data.username;
  req.session.userId = data.userId;

  // Respond with success message and data
  return res.status(200).json({
    success: true,
    message: "Two-Factor Authentication successful. You are now logged in.",
    data,
  });
});

export const Logout = tryCatch(async (req, res) => {
  if (!req.session.sessionId) {
    return res.status(401).json({
      success: false,
      message:
        "Votre session a expiré. veuillez vous reconnecter pour continuer.",
      hasSession: false,
      logout: false,
    });
  }
  // Call the logOut service function to log out user
  await logout(req.session.sessionId, customLog(req, { action: "logout" }));

  // Destroy session and clear cookie upon successful logout
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      res.status(500).send("Internal Server Error");
    } else {
      res.clearCookie(process.env.SESSION_NAME);
      return res
        .status(200)
        .json({ success: true, message: "Logged out successfully" });
    }
  });
});
