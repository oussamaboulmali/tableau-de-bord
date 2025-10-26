// lockService.js
import redisClient from "../configs/cache.js";

class ArticleLockService {
  constructor() {
    this.LOCK_DURATION = 10 * 60; // 10 minutes in seconds
    this.LANG_PREFIX = process.env.WEBSITE_LANG || "fr"; // Get from env
  }

  // Generate lock keys
  _getLockKey(articleId) {
    return `${this.LANG_PREFIX}:article_lock:${articleId}`;
  }

  _getUserLockKey(userId) {
    return `${this.LANG_PREFIX}:user_lock:${userId}`;
  }

  _getConnectedUsersKey() {
    return `${this.LANG_PREFIX}:connected_users`;
  }

  /**
   * Attempt to acquire lock for an article
   */
  async acquireLock(userId, articleId, username) {
    try {
      const lockKey = this._getLockKey(articleId);
      const userLockKey = this._getUserLockKey(userId);

      // Check if article is already locked
      const existingLock = await redisClient.get(lockKey);
      if (existingLock) {
        const lockData = JSON.parse(existingLock);

        // If locked by same user, extend the lock
        if (lockData.userId === userId) {
          return await this._refreshLock(userId, articleId, username);
        }

        // Check if the user who locked it is still connected
        const isUserConnected = await this.isUserConnected(lockData.userId);
        if (!isUserConnected) {
          // User disconnected, release their lock
          await this.releaseUserLocks(lockData.userId);
        } else {
          // Article is locked by another connected user
          return {
            success: false,
            message: `Article is being edited by ${lockData.username}`,
            lockedBy: lockData.username,
            expiresAt: lockData.expiresAt,
          };
        }
      }

      // Check if user already has a lock on another article
      const currentUserLock = await redisClient.get(userLockKey);
      if (currentUserLock) {
        const currentLock = JSON.parse(currentUserLock);
        // Release the previous lock
        await this.releaseLock(userId, currentLock.articleId);
      }

      // Create new lock
      const expiresAt = Date.now() + this.LOCK_DURATION * 1000;
      const lockData = {
        userId,
        username,
        articleId,
        expiresAt,
        acquiredAt: Date.now(),
      };

      // Set article lock with expiration
      await redisClient.setEx(
        lockKey,
        this.LOCK_DURATION,
        JSON.stringify(lockData)
      );

      // Set user lock tracking with expiration
      await redisClient.setEx(
        userLockKey,
        this.LOCK_DURATION,
        JSON.stringify({ articleId, expiresAt })
      );

      // Track connected user
      await this._markUserConnected(userId);

      return {
        success: true,
        message: "Lock acquired successfully",
        expiresAt,
        remainingTime: this.LOCK_DURATION,
      };
    } catch (error) {
      console.error("Error acquiring lock:", error);
      throw error;
    }
  }

  /**
   * Refresh existing lock (when same user requests lock again)
   */
  async _refreshLock(userId, articleId, username) {
    const lockKey = this._getLockKey(articleId);
    const userLockKey = this._getUserLockKey(userId);

    const expiresAt = Date.now() + this.LOCK_DURATION * 1000;
    const lockData = {
      userId,
      username,
      articleId,
      expiresAt,
      acquiredAt: Date.now(),
    };

    // Refresh both locks
    await redisClient.setEx(
      lockKey,
      this.LOCK_DURATION,
      JSON.stringify(lockData)
    );
    await redisClient.setEx(
      userLockKey,
      this.LOCK_DURATION,
      JSON.stringify({ articleId, expiresAt })
    );
    await this._markUserConnected(userId);

    return {
      success: true,
      message: "Lock refreshed successfully",
      expiresAt,
      remainingTime: this.LOCK_DURATION,
    };
  }

  /**
   * Release lock for specific article
   */
  async releaseLock(userId, articleId) {
    try {
      const lockKey = this._getLockKey(articleId);
      const userLockKey = this._getUserLockKey(userId);

      // Verify user owns this lock
      const existingLock = await redisClient.get(lockKey);
      if (existingLock) {
        const lockData = JSON.parse(existingLock);
        if (lockData.userId === userId) {
          // Delete both locks
          await redisClient.del(lockKey);
          await redisClient.del(userLockKey);
          return { success: true, message: "Lock released successfully" };
        }
      }

      return { success: false, message: "No valid lock found" };
    } catch (error) {
      console.error("Error releasing lock:", error);
      throw error;
    }
  }

  /**
   * Release all locks for a user (when disconnecting)
   */
  async releaseUserLocks(userId) {
    try {
      const userLockKey = this._getUserLockKey(userId);
      const userLock = await redisClient.get(userLockKey);

      if (userLock) {
        const lockData = JSON.parse(userLock);
        const articleLockKey = this._getLockKey(lockData.articleId);

        // Delete both locks
        await redisClient.del(articleLockKey);
        await redisClient.del(userLockKey);
      }

      // Remove from connected users
      await this._markUserDisconnected(userId);

      return { success: true };
    } catch (error) {
      console.error("Error releasing user locks:", error);
      throw error;
    }
  }

  /**
   * Check lock status for an article
   */
  async checkLockStatus(articleId, userId = null) {
    try {
      const lockKey = this._getLockKey(articleId);
      const existingLock = await redisClient.get(lockKey);

      if (!existingLock) {
        return {
          isLocked: false,
          canEdit: true,
        };
      }

      const lockData = JSON.parse(existingLock);
      const isOwner = userId && lockData.userId === userId;
      const remainingTime = Math.max(0, lockData.expiresAt - Date.now());

      // Check if lock holder is still connected
      const isHolderConnected = await this.isUserConnected(lockData.userId);

      if (!isHolderConnected && !isOwner) {
        // Lock holder disconnected, clean up
        await this.releaseUserLocks(lockData.userId);
        return {
          isLocked: false,
          canEdit: true,
        };
      }

      return {
        isLocked: true,
        canEdit: isOwner,
        lockedBy: lockData.username,
        lockedByUserId: lockData.userId,
        expiresAt: lockData.expiresAt,
        remainingTime: Math.floor(remainingTime / 1000),
        isOwner,
      };
    } catch (error) {
      console.error("Error checking lock status:", error);
      throw error;
    }
  }

  /**
   * Track connected users
   */
  async _markUserConnected(userId) {
    const connectedKey = this._getConnectedUsersKey();
    await redisClient.hSet(connectedKey, userId, Date.now());
  }

  async _markUserDisconnected(userId) {
    const connectedKey = this._getConnectedUsersKey();
    await redisClient.hDel(connectedKey, userId);
  }

  async isUserConnected(userId) {
    const connectedKey = this._getConnectedUsersKey();
    const lastSeen = await redisClient.hGet(connectedKey, userId);
    return !!lastSeen;
  }

  /**
   * Get user's current lock info
   */
  async getUserCurrentLock(userId) {
    try {
      const userLockKey = this._getUserLockKey(userId);
      const userLock = await redisClient.get(userLockKey);

      if (!userLock) {
        return { hasLock: false };
      }

      const lockData = JSON.parse(userLock);
      const remainingTime = Math.max(0, lockData.expiresAt - Date.now());

      return {
        hasLock: true,
        articleId: lockData.articleId,
        expiresAt: lockData.expiresAt,
        remainingTime: Math.floor(remainingTime / 1000),
      };
    } catch (error) {
      console.error("Error getting user lock:", error);
      throw error;
    }
  }

  /**
   * Clean up expired locks (optional maintenance function)
   */
  async cleanupExpiredLocks() {
    try {
      // Redis automatically handles expiration, but we can clean connected users
      const connectedKey = this._getConnectedUsersKey();
      const allConnected = await redisClient.hGetAll(connectedKey);

      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

      for (const [userId, lastSeen] of Object.entries(allConnected)) {
        if (parseInt(lastSeen) < fiveMinutesAgo) {
          await this.releaseUserLocks(userId);
        }
      }
    } catch (error) {
      console.error("Error cleaning up locks:", error);
    }
  }
}

export default new ArticleLockService();
