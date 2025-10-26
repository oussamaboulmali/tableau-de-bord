import {
  PrismaClientKnownRequestError,
  PrismaClientUnknownRequestError,
  PrismaClientValidationError,
} from "@prisma/client/runtime/library.js";
import {
  dbErrorLogger,
  serverErrorLogger,
  userErrorLogger,
  createLogEntry,
} from "../utils/logger.js";

/**
 * Base error class for all application errors
 */
export class AppError extends Error {
  constructor(statusCode = 500, message, options = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;

    // Additional metadata
    this.inputError = options.inputError ?? null;
    this.isBlocked = options.isBlocked ?? false;
    this.hasSession = options.hasSession ?? null;
    this.logout = options.logout ?? false;

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Factory method for creating error instances with a specific status
   */
  static withStatus(status, message, options = {}) {
    return new this(status, message, options);
  }
}

/**
 * Legacy ErrorHandler class for backward compatibility
 * @deprecated Use AppError instead
 */
export class ErrorHandler extends AppError {
  constructor(
    statusCode,
    message,
    hasSession = null,
    logout = false,
    inputError = null
  ) {
    super(statusCode, message, { hasSession, logout, inputError });
    this.status = "error";
  }
}

/**
 * Specific error classes for common error scenarios
 */
export class ValidationError extends AppError {
  constructor(message, inputError = null) {
    super(400, message, { inputError });
  }
}

export class AuthenticationError extends AppError {
  constructor(message, options = {}) {
    const { isBlocked = false, hasSession = null, logout = false } = options;
    super(401, message, { isBlocked, hasSession, logout });
  }
}

export class AuthorizationError extends AppError {
  constructor(message, options = {}) {
    const { isBlocked = true, hasSession = null, logout = false } = options;
    super(403, message, { isBlocked, hasSession, logout });
  }
}

export class NotFoundError extends AppError {
  constructor(message) {
    super(404, message);
  }
}

export class ConflictError extends AppError {
  constructor(message, inputError = null) {
    super(409, message, { inputError });
  }
}

export class RateLimitError extends AppError {
  constructor(message, isBlocked = true) {
    super(429, message, { isBlocked });
  }
}

/**
 * Global error handler middleware
 */
export const errorHandler = (err, req, res, next) => {
  // Set default values if not present
  err.statusCode = err.statusCode || 500;
  err.message = err.message || "Something went wrong";

  // Create standardized log entry
  const logEntry = createLogEntry(req, err);

  // Handle specific error types
  if (err instanceof AppError) {
    // Handle known operational errors
    userErrorLogger.error(logEntry);

    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.hasSession !== null && { hasSession: err.hasSession }),
      ...(err.logout !== undefined && { logout: err.logout }),
      ...(err.isBlocked && { isBlocked: true }),
      ...(err.inputError &&
        process.env.NODE_ENV !== "production" && {
          inputError: err.inputError,
        }),
      ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
    });
  }

  // Handle Prisma database errors
  if (isPrismaError(err)) {
    dbErrorLogger.error(logEntry);

    const sanitizedError = handlePrismaError(err);

    return res.status(sanitizedError.statusCode).json({
      success: false,
      status: "error",
      message:
        process.env.NODE_ENV === "production"
          ? sanitizedError.message
          : err.message,
      ...(process.env.NODE_ENV !== "production" && {
        stack: err.stack,
        details: sanitizedError.details,
      }),
    });
  }

  // Handle all other unexpected errors
  serverErrorLogger.error(logEntry);

  // In production, never leak error details
  const responseMessage =
    process.env.NODE_ENV === "production"
      ? "An error occurred from server"
      : err.message;

  return res.status(err.statusCode).json({
    success: false,
    status: "error",
    statusCode: err.statusCode,
    message: responseMessage,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
};

/**
 * Legacy error handler for backward compatibility
 * @deprecated Use errorHandler instead
 */
export const handleError = errorHandler;

/**
 * Helper to check if error is from Prisma
 */
function isPrismaError(err) {
  return (
    err instanceof PrismaClientValidationError ||
    err instanceof PrismaClientKnownRequestError ||
    err instanceof PrismaClientUnknownRequestError
  );
}

/**
 * Process Prisma errors to get useful information
 */
function handlePrismaError(err) {
  // Default error response
  const error = {
    statusCode: 500,
    message: "Database error occurred",
    details: {},
  };

  if (err instanceof PrismaClientKnownRequestError) {
    // Handle known Prisma errors
    // See: https://www.prisma.io/docs/reference/api-reference/error-reference#error-codes
    error.details.code = err.code;

    // Process specific error codes
    switch (err.code) {
      case "P2002": // Unique constraint failed
        error.statusCode = 409;
        error.message = "A record with this data already exists";
        error.details.fields = err.meta?.target;
        break;

      case "P2025": // Record not found
        error.statusCode = 404;
        error.message = "Requested record not found";
        break;

      case "P2003": // Foreign key constraint failed
        error.statusCode = 400;
        error.message = "Related record not found";
        error.details.field = err.meta?.field_name;
        break;

      case "P2014": // Invalid ID
        error.statusCode = 400;
        error.message = "Invalid ID provided";
        break;

      case "P2021": // Table does not exist
        error.statusCode = 500;
        error.message = "Database configuration error";
        break;

      case "P2022": // Column does not exist
        error.statusCode = 500;
        error.message = "Database schema error";
        break;

      // Add more specific error codes as needed
      default:
        error.statusCode = 500;
        error.message = "Database operation failed";
    }
  } else if (err instanceof PrismaClientValidationError) {
    // Validation errors (usually bad inputs)
    error.statusCode = 400;
    error.message = "Invalid input data";
  } else if (err instanceof PrismaClientUnknownRequestError) {
    // Unknown errors
    error.statusCode = 500;
    error.message = "An error occurred from server try again";
  }

  return error;
}

// Helper functions for creating errors (convenient for controllers)
export const createError = {
  validation: (message, inputError = null) =>
    new ValidationError(message, inputError),
  authentication: (message, options = {}) =>
    new AuthenticationError(message, options),
  authorization: (message, options = {}) =>
    new AuthorizationError(message, options),
  notFound: (message) => new NotFoundError(message),
  conflict: (message, inputError = null) =>
    new ConflictError(message, inputError),
  rateLimit: (message) => new RateLimitError(message),
  custom: (statusCode, message, options = {}) =>
    new AppError(statusCode, message, options),

  // Legacy helper for backward compatibility
  legacy: (
    statusCode,
    message,
    hasSession = null,
    logout = false,
    inputError = null
  ) => new ErrorHandler(statusCode, message, hasSession, logout, inputError),
};

/**
 * Legacy customLog function for backward compatibility
 * @deprecated createLogEntry from logger is used instead
 */
export const customLog = (req, err) => {
  return {
    statusCode: err.statusCode,
    ip: req.header("x-forwarded-for") || req.connection.remoteAddress,
    method: req.method || "-",
    url: req.originalUrl || "-",
    referrer: req.headers.referer || "-",
    userAgent: req.headers["user-agent"] || "-",
    hasSession: err.hasSession,
    message: err.message + (err.inputError ? " --> " + err.inputError : ""),
    stack: err.stack,
    timestamp: new Date().toISOString(),
  };
};
