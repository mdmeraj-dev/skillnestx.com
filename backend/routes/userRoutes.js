import express from "express";
import rateLimit from "express-rate-limit";
import {
  getCurrentUser,
  updateProfile,
  deleteAccount,
  getAllUsers,
  searchUsers,
  deleteUser,
  toggleUserBan,
  getUserDetails,
  getTotalUsers,
  getRecentUsers,
} from "../controllers/userController.js";
import {
  ensureAuthenticated,
  ensureAdmin,
  sendError,
  setSecurityHeaders,
} from "../middleware/authMiddleware.js";
import validator from "validator";
import { logger } from "../utils/logger.js";

const router = express.Router();

// Centralized rate limit configuration
const createRateLimiter = (options) => {
  const { windowMs, max, code, message } = options;
  return rateLimit({
    windowMs,
    max,
    handler: (req, res) => {
      const traceId = req.headers["x-trace-id"] || Date.now().toString(36);
      sendError(res, 429, code, message, traceId);
    },
    keyGenerator: (req) => req.user.userId, // All routes are authenticated
  });
};

const rateLimitConfig = {
  updateProfile: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Tightened for security
    code: "TOO_MANY_UPDATE_ATTEMPTS",
    message: "Too many profile update attempts. Please try again later.",
  }),
  deleteAccount: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // Tightened for security
    code: "TOO_MANY_DELETE_ATTEMPTS",
    message: "Too many account deletion attempts. Please try again later.",
  }),
};

// Validation middleware
const validateSearchInput = (req, res, next) => {
  const traceId = req.headers["x-trace-id"] || Date.now().toString(36);
  const { query } = req.query;
  if (!query?.trim()) {
    logger.warn("Search users failed: Search query is required", { traceId });
    return sendError(
      res,
      400,
      "INVALID_INPUT",
      "Search query is required",
      traceId
    );
  }
  const sanitizedQuery = query.trim().replace(/[<>&"']/g, "");
  if (sanitizedQuery.length > 100) {
    logger.warn(`Search query too long: ${sanitizedQuery.length} characters`, {
      traceId,
    });
    return sendError(
      res,
      400,
      "INVALID_QUERY_LENGTH",
      "Search query cannot exceed 100 characters",
      traceId
    );
  }
  req.query.query = sanitizedQuery;
  next();
};

const validateUserIdInput = (req, res, next) => {
  const traceId = req.headers["x-trace-id"] || Date.now().toString(36);
  const { userId } = req.params;
  if (!validator.isMongoId(userId)) {
    logger.warn(`Invalid user ID: ${userId}`, { traceId });
    return sendError(res, 400, "INVALID_USER_ID", "Invalid user ID", traceId);
  }
  next();
};

const validateMetricsInput = (req, res, next) => {
  const traceId = req.headers["x-trace-id"] || Date.now().toString(36);
  const { year, month } = req.query;
  if (year) {
    const yearNum = parseInt(year, 10);
    if (
      isNaN(yearNum) ||
      yearNum < 2000 ||
      yearNum > new Date().getFullYear() + 1
    ) {
      logger.warn(`Invalid year parameter: ${year}`, { traceId });
      return sendError(
        res,
        400,
        "INVALID_YEAR",
        "Valid year (2000 to next year) is required",
        traceId
      );
    }
    req.query.year = yearNum.toString();
  }
  if (month) {
    const monthNum = parseInt(month, 10);
    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      logger.warn(`Invalid month parameter: ${month}`, { traceId });
      return sendError(
        res,
        400,
        "INVALID_MONTH",
        "Valid month (1-12) is required",
        traceId
      );
    }
    req.query.month = monthNum.toString();
  }
  next();
};

// User routes
router.get("/current", setSecurityHeaders, ensureAuthenticated, getCurrentUser);
router.patch(
  "/update-profile",
  setSecurityHeaders,
  ensureAuthenticated,
  rateLimitConfig.updateProfile,
  updateProfile
);
router.delete(
  "/delete-account",
  setSecurityHeaders,
  ensureAuthenticated,
  rateLimitConfig.deleteAccount,
  deleteAccount
);

// Admin routes
router.get(
  "/admin/users",
  setSecurityHeaders,
  ensureAuthenticated,
  ensureAdmin,

  getAllUsers
);
router.get(
  "/admin/users/search",
  setSecurityHeaders,
  ensureAuthenticated,
  ensureAdmin,

  validateSearchInput,
  searchUsers
);
router.get(
  "/admin/users/total",
  setSecurityHeaders,
  ensureAuthenticated,
  ensureAdmin,

  validateMetricsInput,
  getTotalUsers
);
router.get(
  "/admin/users/recent",
  setSecurityHeaders,
  ensureAuthenticated,
  ensureAdmin,

  validateMetricsInput,
  getRecentUsers
);
router.get(
  "/admin/users/:userId",
  setSecurityHeaders,
  ensureAuthenticated,
  ensureAdmin,

  validateUserIdInput,
  getUserDetails
);
router.delete(
  "/admin/users/:userId",
  setSecurityHeaders,
  ensureAuthenticated,
  ensureAdmin,

  validateUserIdInput,
  deleteUser
);
router.patch(
  "/admin/users/:userId/ban",
  setSecurityHeaders,
  ensureAuthenticated,
  ensureAdmin,
  validateUserIdInput,
  toggleUserBan
);

// Error handler
router.use((err, req, res, next) => {
  const traceId = req.headers["x-trace-id"] || Date.now().toString(36);
  logger.error(
    `Route error: ${req.method} ${req.originalUrl} - ${err.message}`,
    { traceId, stack: err.stack }
  );
  const status = err.status || 500;
  const code = err.code || "SERVER_ERROR";
  const message = err.message || "Internal server error";
  return sendError(res, status, code, message, traceId);
});

export default router;
