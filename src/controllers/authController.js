/**
 * @fileoverview Authentication Controller
 * 
 * Handles all authentication-related operations including:
 * - User login with OTP verification
 * - Session management (active session detection, closing sessions)
 * - Two-factor authentication (2FA) via OTP
 * - User logout
 * 
 * @module controllers/authController
 * @requires ../middlewares/errorMiddleware
 * @requires ../services/authService
 * @requires ../utils/logger
 * @requires ../utils/tryCatch
 * @requires ../validations/authValidation
 */

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

/**
 * Utility function to extract log request data for authentication actions
 * 
 * @param {Object} req - Express request object
 * @param {string} action - Action being performed (e.g., 'login', 'logout')
 * @returns {Object} Log data object containing IP, referrer, user agent, and action
 */
const Logdata = (req, action) => {
  return {
    ip: req.header("x-forwarded-for") || req.connection.remoteAddress,
    referrer: req.headers.referer || "-",
    userAgent: req.headers["user-agent"] || "-",
    action: action,
  };
};

/**
 * Creates a custom log entry with request context
 * 
 * @param {Object} req - Express request object
 * @param {Object} options - Additional logging options
 * @param {string} [options.message] - Custom log message
 * @param {string} [options.action] - Action being logged
 * @param {Error} [options.err] - Error object if applicable
 * @returns {Object} Enhanced log entry with custom fields
 */
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

/**
 * Handles user login with OTP verification
 * 
 * Validates credentials and checks for active sessions.
 * If user has an active session, returns session info for confirmation.
 * Otherwise, generates and sends OTP to user's email.
 * 
 * @async
 * @function Login
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body containing login credentials
 * @param {string} req.body.username - User's username
 * @param {string} req.body.password - User's password
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response with success status, message, and data
 * @throws {ValidationError} If request validation fails
 * @throws {ErrorHandler} If authentication fails
 * 
 * @example
 * // Request body:
 * {
 *   "username": "john.doe",
 *   "password": "securePassword123"
 * }
 * 
 * // Response (no active session):
 * {
 *   "success": true,
 *   "message": "OTP sent to your email. Please enter it.",
 *   "hasSession": false,
 *   "data": { "userId": 123, "email": "john@example.com" }
 * }
 */
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

/**
 * Closes an active user session and sends new OTP
 * 
 * Used when a user wants to close their existing active session
 * and login from a different device/location.
 * 
 * @async
 * @function CloseRunningSession
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {number} req.body.userId - User ID whose session should be closed
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response with OTP sent confirmation
 * @throws {ValidationError} If request validation fails
 * 
 * @example
 * // Request body:
 * {
 *   "userId": 123
 * }
 */
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

/**
 * Resends OTP to user's email
 * 
 * Used when the user doesn't receive the OTP or it has expired.
 * Generates a new OTP and sends it to the registered email.
 * 
 * @async
 * @function ReSendOtpKey
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {number} req.body.userId - User ID
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response confirming OTP resent
 * @throws {ValidationError} If request validation fails
 */
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

/**
 * Verifies OTP and completes login process
 * 
 * Validates the OTP entered by the user and, if correct,
 * creates a session and logs the user into the system.
 * 
 * @async
 * @function VerifyOtpAndLogin
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {number} req.body.userId - User ID
 * @param {string} req.body.otp - OTP code to verify
 * @param {Object} req.session - Express session object
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response with user data and session info
 * @throws {ValidationError} If request validation fails
 * @throws {ErrorHandler} If OTP is invalid or expired
 * 
 * @example
 * // Request body:
 * {
 *   "userId": 123,
 *   "otp": "123456"
 * }
 * 
 * // Response:
 * {
 *   "success": true,
 *   "message": "Two-Factor Authentication successful. You are now logged in.",
 *   "data": {
 *     "userId": 123,
 *     "username": "john.doe",
 *     "email": "john@example.com",
 *     "roles": ["Rédacteur"]
 *   }
 * }
 */
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

/**
 * Logs out the current user
 * 
 * Destroys the user's session, clears cookies, and logs the logout action.
 * 
 * @async
 * @function Logout
 * @param {Object} req - Express request object
 * @param {Object} req.session - Express session object
 * @param {string} req.session.sessionId - Current session ID
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response confirming logout
 * @throws {ErrorHandler} If session doesn't exist or logout fails
 * 
 * @example
 * // Response:
 * {
 *   "success": true,
 *   "message": "Logged out successfully"
 * }
 */
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
