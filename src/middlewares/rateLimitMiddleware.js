import rateLimit from "express-rate-limit";
import nodemailer from "nodemailer";
import { rateLimitLogger } from "../utils/logger.js";
import redisClient from "../configs/cache.js";

// Helper function to get real client IP
function getClientIP(req) {
  return (
    req.headers["x-client-ip"] ||
    req.headers["x-real-ip"] ||
    req.headers["x-forwarded-for"] ||
    req.connection.remoteAddress
  );
}

// Configure email transporter
const transporter = nodemailer.createTransport({
  host: "mail.aps.dz",
  port: 25,
  auth: {
    user: process.env.ADMIN_MAIL,
    pass: process.env.ADMIN_MAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

// Function to send notification email
const sendNotificationEmail = async (
  ipAddress,
  endpoint,
  hitCount,
  userAgent
) => {
  try {
    await transporter.sendMail({
      from: process.env.ADMIN_MAIL,
      to: process.env.RECEPTION_MAIL,
      subject: `🚨 Rate Limit Exceeded Alert - ${process.env.PROJECT_NAME} - ${process.env.PROJECT_LANG}`,
      html: `
        <h2>Rate Limit Exceeded Alert</h2>
        <p><strong>Time:</strong> ${getAlgeriaTime()}</p>
        <p><strong>IP Address:</strong> ${ipAddress}</p>
        <p><strong>Endpoint:</strong> ${endpoint}</p>
        <p><strong>Hit Count:</strong> ${hitCount}</p>
        <p><strong>User Agent:</strong> ${userAgent || "N/A"}</p>
        <h3>The IP address ${ipAddress} has exceeded the rate limit and has been blocked for 1 hour.</h3>
      `,
    });
    rateLimitLogger.info(
      `Rate limit notification email sent for IP: ${ipAddress}`
    );
  } catch (error) {
    rateLimitLogger.error(
      "Error sending rate limit notification email:",
      error
    );
  }
};

// Redis-based IP Block Store
class RedisIPBlockStore {
  constructor(maxBlockTimeMs = 60 * 60 * 1000) {
    this.maxBlockTimeMs = maxBlockTimeMs;
    this.keyPrefix = "rate_limit_block:";
  }

  getBlockKey(ipAddress) {
    return `${this.keyPrefix}${ipAddress}`;
  }

  async blockIP(ipAddress, hitCount = 1) {
    const key = this.getBlockKey(ipAddress);
    const now = Date.now();

    try {
      const existing = await redisClient.hGetAll(key);
      const currentHitCount = existing.hitCount
        ? parseInt(existing.hitCount)
        : 0;

      const blockData = {
        timestamp: now.toString(),
        hitCount: (currentHitCount + hitCount).toString(),
        notified: existing.notified || "false",
      };

      await redisClient
        .multi()
        .hSet(key, blockData)
        .expire(key, Math.ceil(this.maxBlockTimeMs / 1000))
        .exec();

      return {
        timestamp: now,
        hitCount: parseInt(blockData.hitCount),
        notified: blockData.notified === "true",
      };
    } catch (error) {
      rateLimitLogger.error("Redis error in blockIP:", error);
      throw error;
    }
  }

  async isBlocked(ipAddress) {
    const key = this.getBlockKey(ipAddress);

    try {
      const blockData = await redisClient.hGetAll(key);

      if (Object.keys(blockData).length === 0) {
        return { blocked: false };
      }

      const timestamp = parseInt(blockData.timestamp);
      const now = Date.now();

      if (now - timestamp < this.maxBlockTimeMs) {
        return {
          blocked: true,
          hitCount: parseInt(blockData.hitCount),
          timestamp,
          notified: blockData.notified === "true",
        };
      } else {
        await redisClient.del(key);
        return { blocked: false };
      }
    } catch (error) {
      rateLimitLogger.error("Redis error in isBlocked:", error);
      return { blocked: false };
    }
  }

  async markNotified(ipAddress) {
    const key = this.getBlockKey(ipAddress);

    try {
      await redisClient.hSet(key, "notified", "true");
    } catch (error) {
      rateLimitLogger.error("Redis error in markNotified:", error);
    }
  }
}

// Redis-based Notification Tracker
class RedisNotificationTracker {
  constructor(cooldownMs = 24 * 60 * 60 * 1000) {
    this.cooldownMs = cooldownMs;
    this.keyPrefix = "rate_limit_notification:";
  }

  getNotificationKey(ipAddress) {
    return `${this.keyPrefix}${ipAddress}`;
  }

  async shouldNotify(ipAddress) {
    const key = this.getNotificationKey(ipAddress);

    try {
      const lastNotification = await redisClient.get(key);
      const now = Date.now();

      if (
        !lastNotification ||
        now - parseInt(lastNotification) > this.cooldownMs
      ) {
        await redisClient.setEx(
          key,
          Math.ceil(this.cooldownMs / 1000),
          now.toString()
        );
        return true;
      }
      return false;
    } catch (error) {
      rateLimitLogger.error("Redis error in shouldNotify:", error);
      return true; // Fail open - allow notification on error
    }
  }
}

const ipBlockStore = new RedisIPBlockStore();
const notificationTracker = new RedisNotificationTracker();

// Middleware to check for blocked IPs
const blockMiddleware = async (req, res, next) => {
  const ipAddress = getClientIP(req);

  try {
    const blockInfo = await ipBlockStore.isBlocked(ipAddress);

    if (blockInfo.blocked) {
      rateLimitLogger.warn(`Blocked IP attempted request: ${ipAddress}`, {
        endpoint: req.originalUrl,
        hitCount: blockInfo.hitCount,
        userAgent: req.headers["user-agent"],
      });

      return res.status(429).json({
        success: false,
        message:
          "Votre adresse IP a été bloquée pendant 1 heure en raison d'un nombre excessif de requêtes.",
      });
    }

    next();
  } catch (error) {
    rateLimitLogger.error("Block middleware error:", error);
    next(); // Fail open for availability
  }
};

// Enhanced rate limiter with Redis store
const rateLimitMiddleware = rateLimit({
  windowMs: 30 * 1000, // 30 seconds window
  max: 60, // 60 requests per 30 seconds
  standardHeaders: true,
  legacyHeaders: false,

  // Redis store for rate limiting
  store: new (class RedisRateLimitStore {
    constructor() {
      this.keyPrefix = "rate_limit:";
    }

    async increment(key) {
      const redisKey = `${this.keyPrefix}${key}`;

      try {
        const current = await redisClient.incr(redisKey);

        if (current === 1) {
          await redisClient.expire(redisKey, 30); // 30 seconds
        }

        return {
          totalHits: current,
          resetTime: new Date(Date.now() + 30000),
        };
      } catch (error) {
        rateLimitLogger.error("Redis rate limit store error:", error);
        return {
          totalHits: 1,
          resetTime: new Date(Date.now() + 30000),
        };
      }
    }

    async decrement(key) {
      const redisKey = `${this.keyPrefix}${key}`;
      try {
        await redisClient.decr(redisKey);
      } catch (error) {
        rateLimitLogger.error("Redis rate limit decrement error:", error);
      }
    }

    async resetKey(key) {
      const redisKey = `${this.keyPrefix}${key}`;
      try {
        await redisClient.del(redisKey);
      } catch (error) {
        rateLimitLogger.error("Redis rate limit reset error:", error);
      }
    }
  })(),

  keyGenerator: (req) => {
    const ip = getClientIP(req);
    const userId = req.session?.userid || "";
    return userId ? `${ip}-${userId}` : ip;
  },

  handler: async (req, res, next, options) => {
    const ipAddress = getClientIP(req);
    const endpoint = req.originalUrl;
    const userAgent = req.headers["user-agent"];

    try {
      rateLimitLogger.warn(`Rate limit exceeded for IP: ${ipAddress}`, {
        endpoint,
        userAgent,
      });

      // Block the IP and get block data
      const blockData = await ipBlockStore.blockIP(ipAddress);

      // Send response immediately for better performance
      const response = res.status(429).json({
        success: false,
        hasSession: false,
        message:
          "Trop de requêtes créées à partir de cette adresse IP. Vous êtes bloqué pendant 1 heure.",
      });

      // Send email notification asynchronously (don't wait)
      const shouldNotify = await notificationTracker.shouldNotify(ipAddress);

      if (shouldNotify && !blockData.notified) {
        // Fire and forget - don't await these operations
        sendNotificationEmail(
          ipAddress,
          endpoint,
          blockData.hitCount,
          userAgent
        ).catch((error) =>
          rateLimitLogger.error("Failed to send notification email:", error)
        );

        ipBlockStore
          .markNotified(ipAddress)
          .catch((error) =>
            rateLimitLogger.error("Failed to mark IP as notified:", error)
          );
      }

      return response;
    } catch (error) {
      rateLimitLogger.error("Rate limit handler error:", error);

      return res.status(429).json({
        success: false,
        hasSession: false,
        message:
          "Trop de requêtes créées à partir de cette adresse IP. Vous êtes bloqué pendant 1 heure.",
      });
    }
  },
});

// Export combined middleware
export const combinedRateLimitMiddleware = [
  blockMiddleware,
  rateLimitMiddleware,
];

// Export for testing or direct use
export { ipBlockStore, notificationTracker };

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
