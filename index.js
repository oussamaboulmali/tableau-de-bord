import express from "express";
import session from "express-session";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import { handleError } from "./src/middlewares/errorMiddleware.js";
import {
  addRequestId,
  appLogger,
  httpLoggerMiddleware,
  morganConfig,
} from "./src/utils/logger.js";
import authRouter from "./src/routes/auth.js";
import roleRouter from "./src/routes/role.js";
import userRouter from "./src/routes/user.js";
import logRouter from "./src/routes/log.js";
import categorieRouter from "./src/routes/categorie.js";
import tagRouter from "./src/routes/tag.js";
import articleRouter from "./src/routes/article.js";
import imageRouter from "./src/routes/image.js";
import galleryRouter from "./src/routes/galleryArticle.js";
import dossierRouter from "./src/routes/dossier.js";
import bannerRouter from "./src/routes/banner.js";
import infographieRouter from "./src/routes/infographie.js";
import cahierRouter from "./src/routes/cahier.js";
import videoRouter from "./src/routes/video.js";
import galleryHomeRouter from "./src/routes/gallery.js";
import emergencyBandRouter from "./src/routes/emergencyBand.js";
import subscriberRouter from "./src/routes/subscriber.js";
import { combinedRateLimitMiddleware } from "./src/middlewares/rateLimitMiddleware.js";
import compression from "compression";
import { validateClient } from "./src/middlewares/authMiddleware.js";
import prisma from "./src/configs/database.js";
import redisStore from "./src/configs/redisSessionStore.js";
import { combinedSecurityMiddleware } from "./src/middlewares/securityMiddleware.js";
import forbiddenWordsService from "./src/helpers/forbiddenWordsHelper.js";
import { forbiddenWordsMiddleware } from "./src/middlewares/forbiddenWordsMiddleware.js";
import { securityLoggingMiddleware } from "./src/middlewares/securityMiddleware2.js";

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Trust proxy for proper IP detection behind load balancers
app.set("trust proxy", 1);

// Add request ID to each request (important for traceability)
app.use(addRequestId);

// Request logging
app.use(httpLoggerMiddleware);

// Security middleware
app.use(helmet());

// Configure CORS with specific origin(s)
app.use(
  cors({
    origin: [
      "http://dev-dashboard.aps.dz",
      "https://dev-dashboard.aps.dz",
      "https://dashboard.aps.dz",
      "http://dash.aps.dz:5173",
      "http://localhost:5173",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT"],
  })
);

// Restrict all other methods on the server side
app.use((req, res, next) => {
  if (["GET", "POST", "PUT"].includes(req.method)) {
    next();
  } else {
    const err = new Error(`Method ${req.method} not allowed`);
    err.statusCode = 405;
    next(err);
  }
});

// Parsing middleware
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    name: process.env.SESSION_NAME,
    resave: false,
    saveUninitialized: false,
    store: redisStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "Lax",
      maxAge: process.env.SESSION_TIME * 60 * 1000,
    },
    rolling: true,
  })
);

try {
  await forbiddenWordsService.loadForbiddenWords();
  console.log("✅ Forbidden words loaded successfully");
} catch (error) {
  console.error("❌ Failed to load forbidden words:", error);
}

//app.use(validateClient);
// Rate limiting (uncomment to enable)
//app.use(combinedSecurityMiddleware);
//app.use(combinedRateLimitMiddleware);
app.use(securityLoggingMiddleware);
app.use(forbiddenWordsMiddleware);

// API Routes
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/roles", roleRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/logs", logRouter);
app.use("/api/v1/categories", categorieRouter);
app.use("/api/v1/tags", tagRouter);
app.use("/api/v1/articles", articleRouter);
app.use("/api/v1/images", imageRouter);
app.use("/api/v1/galleries", galleryRouter);
app.use("/api/v1/dossiers", dossierRouter);
app.use("/api/v1/banners", bannerRouter);
app.use("/api/v1/infographies", infographieRouter);
app.use("/api/v1/cahiers", cahierRouter);
app.use("/api/v1/videos", videoRouter);
app.use("/api/v1/galleryhome", galleryHomeRouter);
app.use("/api/v1/emergencies", emergencyBandRouter);
app.use("/api/v1/subscribers", subscriberRouter);

// Handle 404 for unmatched routes
app.all("*path", (req, res, next) => {
  const err = new Error(`Cannot find ${req.originalUrl} on this server`);
  err.statusCode = 404;
  next(err);
});

// Global error handler - ALWAYS the last middleware
app.use(handleError);

// Start the server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  appLogger.info(
    `Server is running on port ${PORT} in ${process.env.NODE_ENV} mode`
  );
});

// Improved graceful shutdown handler
const shutdown = async (signal) => {
  appLogger.info(`${signal} received. Shutting down gracefully...`);

  // Close server first (stop accepting new connections)
  server.close(async () => {
    try {
      // Disconnect from the database
      appLogger.info("Closing database connections...");
      await prisma.$disconnect();
      appLogger.info("Database connections closed");

      // Close any other connections (Redis, etc.)
      // await redisStore.close(); // Uncomment if your Redis store has a close method

      appLogger.info("Shutdown completed successfully");
      process.exit(0);
    } catch (err) {
      appLogger.error("Error during shutdown:", {
        error: err.message,
        stack: err.stack,
      });
      process.exit(1);
    }
  });

  // Force shutdown after 30 seconds if graceful shutdown fails
  setTimeout(() => {
    appLogger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 30000);
};

// Attach shutdown handlers
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
