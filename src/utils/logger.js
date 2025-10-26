import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import morgan from "morgan";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

// Ensure required directories exist
const requiredDirs = [
  path.join(process.env.LOG_PATH, "logs_info", "erreurs_connexion"),
];

requiredDirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configuration
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const COLORS = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "white",
};

// Environment-based settings
const LOG_PATH = process.env.LOG_PATH || "logs";
const NODE_ENV = process.env.NODE_ENV || "development";
const LOG_LEVEL = NODE_ENV === "production" ? "info" : "debug";
const SHOW_STACK_TRACE = NODE_ENV !== "production";

// Add colors to Winston
winston.addColors(COLORS);

// Common format for all loggers
const commonFormat = winston.format.combine(
  winston.format.errors({ stack: true }),
  winston.format.timestamp({
    format: () =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Algiers",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        fractionalSecondDigits: 3,
        hour12: false,
      })
        .format(new Date())
        .replace(", ", "T"),
  }),
  winston.format.metadata({
    fillExcept: ["message", "level", "timestamp", "stack"],
  })
);

// Console format with colors
const consoleFormat = winston.format.combine(
  commonFormat,
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, metadata, stack }) => {
    const metaStr = Object.keys(metadata).length
      ? `\n${JSON.stringify(metadata, null, 2)}`
      : "";

    const stackStr = stack && SHOW_STACK_TRACE ? `\n${stack}` : "";

    return `${timestamp} [${level}]: ${message}${metaStr}${stackStr}`;
  })
);

// File format (JSON for better parsing)
const fileFormat = winston.format.combine(commonFormat, winston.format.json());

// Create a standard rotate file transport
const createRotateTransport = (level, category) => {
  return new DailyRotateFile({
    level,
    dirname: path.join(LOG_PATH, category),
    filename: "%DATE%.log",
    datePattern: "YYYY-MM-DD",
    format: fileFormat,
  });
};

// Create logger factory
const createLogger = (category, level = "error", is_saved = true) => {
  return winston.createLogger({
    level: LOG_LEVEL,
    levels: LOG_LEVELS,
    ...(category !== "http"
      ? {
          defaultMeta: {
            service: category,
            source: process.env.PROJECT_NAME || "unknown",
            website: process.env.PROJECT_LANG || "unknown",
          },
        }
      : {}),
    transports: [
      // Console for all logs
      new winston.transports.Console({
        format: consoleFormat,
      }),
      // Files only for specified level
      ...(is_saved ? [createRotateTransport(level, category)] : []),
    ],
    // Don't exit on handled exceptions
    exitOnError: false,
  });
};

// Create specific loggers
export const userErrorLogger = createLogger("user-errors", "error");
export const serverErrorLogger = createLogger("server-errors", "error");
export const dbErrorLogger = createLogger("db-errors", "error");
export const httpLogger = createLogger("http", "http", false);
export const appLogger = createLogger("app", "info");
export const rateLimitLogger = createLogger("rate-limit-alerts", "info");
export const securityLogger = createLogger("security-alerts", "warn");

// Special JSON-only loggers (infoLogger and deniedLogger)
export const infoLogger = (folderName) => {
  const dirPath = path.join(LOG_PATH, "logs_info", folderName);

  // Créer le dossier s'il n'existe pas
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✅ Created log folder: ${dirPath}`);
  }
  return winston.createLogger({
    level: "info",
    levels: LOG_LEVELS,
    format: winston.format.combine(
      winston.format.errors({ stack: true }),
      winston.format.timestamp({
        format: () =>
          new Intl.DateTimeFormat("en-CA", {
            timeZone: "Africa/Algiers",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            fractionalSecondDigits: 3,
            hour12: false,
          })
            .format(new Date())
            .replace(", ", "T"),
      }),
      winston.format.json()
    ),
    defaultMeta: {
      service: "info-logger",
      source: process.env.PROJECT_NAME || "unknown",
      website: process.env.PROJECT_LANG || "unknown",
    },
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize({ all: true }),
          winston.format.printf(
            ({
              timestamp,
              level,
              message,
              ip,
              referrer,
              userAgent,
              username,
            }) => {
              return `${timestamp} [${level.toUpperCase()}] [Client ${ip}] ${
                username ? `[user ${username}]` : ""
              } ${message} \nreferer: ${referrer}, agent: ${userAgent}`;
            }
          )
        ),
      }),
      new DailyRotateFile({
        level: "info",
        dirname: path.join(LOG_PATH, "logs_info", folderName),
        filename: "%DATE%.log",
        datePattern: "YYYY-MM-DD",
        format: winston.format.json(),
      }),
    ],
    exitOnError: false,
  });
};

export const deniedLogger = winston.createLogger({
  level: "error",
  levels: LOG_LEVELS,
  format: winston.format.combine(
    winston.format.errors({ stack: true }),
    winston.format.timestamp({
      format: () =>
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Africa/Algiers",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          fractionalSecondDigits: 3,
          hour12: false,
        })
          .format(new Date())
          .replace(", ", "T"),
    }),
    winston.format.json()
  ),
  defaultMeta: {
    service: "denied-logger",
    source: process.env.PROJECT_NAME || "unknown",
    website: process.env.PROJECT_LANG || "unknown",
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.printf(
          ({
            timestamp,
            level,
            message,
            ip,
            referrer,
            userAgent,
            username,
          }) => {
            return `${timestamp} [${level.toUpperCase()}] [Client ${ip}] ${
              username ? `[user ${username}]` : ""
            } ${message} \nreferer: ${referrer} agent: ${userAgent}`;
          }
        )
      ),
    }),
    new DailyRotateFile({
      level: "info",
      dirname: path.join(LOG_PATH, "logs_info", "erreurs_connexion"),
      filename: "%DATE%.log",
      datePattern: "YYYY-MM-DD",
      format: winston.format.json(),
    }),
  ],
  exitOnError: false,
});

// Exception handlers
const exceptionHandlers = [
  new winston.transports.Console({
    format: consoleFormat,
  }),
  createRotateTransport("error", "exceptions"),
];

// Create a root logger with unhandled exception and rejection handling
export const logger = winston.createLogger({
  level: LOG_LEVEL,
  levels: LOG_LEVELS,
  format: commonFormat,
  defaultMeta: {
    service: "api",
    source: process.env.PROJECT_NAME || "unknown",
    website: process.env.PROJECT_LANG || "unknown",
  },
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
    }),
  ],
  exceptionHandlers,
  rejectionHandlers: exceptionHandlers,
});

// Create a token for request ID
morgan.token("id", (req) => req.id);

// Add request ID middleware
export const addRequestId = (req, res, next) => {
  req.id = uuidv4();
  res.setHeader("X-Request-ID", req.id);
  next();
};

morgan.token("client-ip", (req) => {
  return (
    req.headers["x-client-ip"] ||
    req.headers["x-real-ip"] ||
    req.header["x-forwarded-for"]
  );
});

// Morgan middleware configured for Winston
export const httpLoggerMiddleware = morgan(
  ":id :client-ip :method :url :status :response-time ms - :res[content-length]",
  {
    stream: {
      write: (message) => httpLogger.http(message.trim()),
    },
  }
);

// Keep the old morganConfig for backward compatibility
export const morganConfig = morgan(
  ":method :url :status :res[content-length] - :response-time ms",
  {
    stream: {
      write: (message) => httpLogger.http(message.trim()),
    },
  }
);

// Helper for creating standardized log entries
export const createLogEntry = (req, err) => {
  return {
    requestId: req.id,
    source: process.env.PROJECT_NAME || "unknown",
    website: process.env.PROJECT_LANG || "unknown",
    ...(err && { statusCode: err.statusCode || 500 }),
    ip:
      req.headers["x-client-ip"] ||
      req.headers["x-real-ip"] ||
      req.header["x-forwarded-for"],
    method: req.method || "-",
    url: req.originalUrl || "-",
    referrer: req.headers.referer || "-",
    userAgent: req.headers["user-agent"] || "-",
    ...(err && { message: err.message }),
    ...(err && err.inputError && { inputError: err.inputError }),
    timestamp: getAlgeriaTime(),
    ...(err && { stack: err.stack }),
  };
};

function getAlgeriaTime() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Algiers",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
    hour12: false,
  })
    .format(new Date())
    .replace(", ", "T");
}

// Setup for uncaught exceptions
process.on("uncaughtException", (err) => {
  logger.error({
    message: "UNCAUGHT EXCEPTION! Shutting down...",
    error: err.message,
    stack: err.stack,
  });

  // Give logger time to write, then exit
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Setup for unhandled rejections
process.on("unhandledRejection", (err) => {
  logger.error({
    message: "UNHANDLED REJECTION! Shutting down...",
    error: err.message,
    stack: err.stack,
  });

  // Give logger time to write, then exit
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});
