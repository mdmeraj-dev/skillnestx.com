import express from "express";
import rateLimit from "express-rate-limit";
import { updateProfile, getCurrentUser, deleteAccount, updateAvatar } from "../controllers/userController.js";
import { isAuthenticated } from "../middleware/authMiddleware.js";
import logger from "../utils/logger.js";
import crypto from "crypto";
import validator from "validator";
import sanitizeHtml from "sanitize-html";

const router = express.Router();

const setSecurityHeaders = (req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "default-src 'self'",
  });
  next();
};

const rateLimitConfig = {
  updateProfile: {
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {
      success: false,
      code: "TOO_MANY_UPDATE_ATTEMPTS",
      message: "Too many profile update attempts. Please try again later.",
    },
  },
  deleteAccount: {
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: {
      success: false,
      code: "TOO_MANY_DELETE_ATTEMPTS",
      message: "Too many account deletion attempts. Please try again later.",
    },
  },
  updateAvatar: {
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {
      success: false,
      code: "TOO_MANY_AVATAR_UPDATE_ATTEMPTS",
      message: "Too many avatar update attempts. Please try again later.",
    },
  },
};

const updateProfileLimiter = rateLimit(rateLimitConfig.updateProfile);
const deleteAccountLimiter = rateLimit(rateLimitConfig.deleteAccount);
const updateAvatarLimiter = rateLimit(rateLimitConfig.updateAvatar);

const validateProfileInput = (req, res, next) => {
  const traceId = req.headers["x-trace-id"] || crypto.randomUUID();
  try {
    if (req.body.email) {
      req.body.email = sanitizeHtml(req.body.email.trim().toLowerCase(), { allowedTags: [] });
      if (!validator.isEmail(req.body.email)) {
        logger.warn(`Invalid email format: ${req.body.email}`, { traceId });
        return res.status(400).json({
          success: false,
          code: "INVALID_EMAIL",
          message: "Invalid email format",
          traceId,
        });
      }
    }
    if (req.body.name) {
      req.body.name = sanitizeHtml(req.body.name.trim(), { allowedTags: [] });
      if (req.body.name.length < 2 || req.body.name.length > 50) {
        logger.warn(`Invalid name length: ${req.body.name}`, { traceId });
        return res.status(400).json({
          success: false,
          code: "INVALID_NAME",
          message: "Name must be between 2 and 50 characters",
          traceId,
        });
      }
    }
    if (req.body.password) {
      req.body.password = req.body.password.trim();
      if (req.body.password.length < 8) {
        logger.warn("Password too short", { traceId });
        return res.status(400).json({
          success: false,
          code: "INVALID_PASSWORD",
          message: "Password must be at least 8 characters",
          traceId,
        });
      }
    }
    if (req.body.mobileNumber !== undefined) {
      if (req.body.mobileNumber?.trim()) {
        req.body.mobileNumber = sanitizeHtml(req.body.mobileNumber.trim(), { allowedTags: [] });
        if (!/^\+?[1-9]\d{6,14}$/.test(req.body.mobileNumber)) {
          logger.warn(`Invalid mobile number: ${req.body.mobileNumber}`, { traceId });
          return res.status(400).json({
            success: false,
            code: "INVALID_MOBILE",
            message: "Invalid mobile number format",
            traceId,
          });
        }
      } else {
        req.body.mobileNumber = "";
      }
    }
    if (req.body.profilePicture !== undefined) {
      if (req.body.profilePicture?.trim()) {
        req.body.profilePicture = sanitizeHtml(req.body.profilePicture.trim(), { allowedTags: [] });
        if (
          !validator.isURL(req.body.profilePicture, {
            protocols: ["http", "https"],
            require_protocol: true,
          })
        ) {
          logger.warn(`Invalid profile picture URL: ${req.body.profilePicture}`, { traceId });
          return res.status(400).json({
            success: false,
            code: "INVALID_URL",
            message: "Invalid profile picture URL",
            traceId,
          });
        }
      } else {
        req.body.profilePicture = "";
      }
    }
    if (req.body.bio !== undefined) {
      if (req.body.bio?.trim()) {
        req.body.bio = sanitizeHtml(req.body.bio.trim(), { allowedTags: [] });
        if (req.body.bio.length > 500) {
          logger.warn(`Bio too long: ${req.body.bio.length} characters`, { traceId });
          return res.status(400).json({
            success: false,
            code: "INVALID_BIO",
            message: "Bio cannot exceed 500 characters",
            traceId,
          });
        }
      } else {
        req.body.bio = "";
      }
    }
    if (req.body.keepLoggedIn !== undefined) {
      delete req.body.keepLoggedIn;
    }
    next();
  } catch (error) {
    logger.error(`Input validation error: ${error.message}`, { traceId, stack: error.stack });
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Invalid input data",
      traceId,
    });
  }
};

const validateAvatarInput = (req, res, next) => {
  const traceId = req.headers["x-trace-id"] || crypto.randomUUID();
  try {
    const { profilePicture } = req.body;
    if (!profilePicture?.trim()) {
      logger.warn("Avatar update failed: Profile picture path is required", { traceId });
      return res.status(400).json({
        success: false,
        code: "INVALID_INPUT",
        message: "Profile picture path is required",
        traceId,
      });
    }
    const sanitizedPath = sanitizeHtml(profilePicture.trim(), { allowedTags: [] });
    const avatarPathRegex = /^\/assets\/avatars\/(boy-[1-3]|girl-[1-3])\.svg$/;
    if (!avatarPathRegex.test(sanitizedPath)) {
      logger.warn(`Invalid avatar path: ${sanitizedPath}`, { traceId });
      return res.status(400).json({
        success: false,
        code: "INVALID_AVATAR",
        message: "Invalid avatar path",
        traceId,
      });
    }
    req.body.profilePicture = sanitizedPath;
    next();
  } catch (error) {
    logger.error(`Avatar input validation error: ${error.message}`, { traceId, stack: error.stack });
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Invalid avatar input",
      traceId,
    });
  }
};

router.use(setSecurityHeaders);

router.get("/current", isAuthenticated, (req, res, next) => {
  const traceId = req.headers["x-trace-id"] || crypto.randomUUID();
  logger.info(`Get current user requested for userId: ${req.user.userId}`, { traceId });
  getCurrentUser(req, res, next);
});

router.patch("/update-profile", isAuthenticated, updateProfileLimiter, validateProfileInput, (req, res, next) => {
  const traceId = req.headers["x-trace-id"] || crypto.randomUUID();
  logger.info(`Update profile requested for userId: ${req.user.userId}`, { traceId, updatedFields: Object.keys(req.body) });
  updateProfile(req, res, next);
});

router.delete("/delete-account", isAuthenticated, deleteAccountLimiter, (req, res, next) => {
  const traceId = req.headers["x-trace-id"] || crypto.randomUUID();
  logger.info(`Delete account requested for userId: ${req.user.userId}`, { traceId });
  deleteAccount(req, res, next);
});

router.patch("/update-avatar", isAuthenticated, updateAvatarLimiter, validateAvatarInput, (req, res, next) => {
  const traceId = req.headers["x-trace-id"] || crypto.randomUUID();
  logger.info(`Update avatar requested for userId: ${req.user.userId}`, { traceId });
  updateAvatar(req, res, next);
});

router.use((req, res) => {
  const traceId = req.headers["x-trace-id"] || crypto.randomUUID();
  logger.warn(`Route not found: ${req.method} ${req.originalUrl}`, { traceId });
  res.status(404).json({
    success: false,
    code: "ROUTE_NOT_FOUND",
    message: "Route not found",
    traceId,
  });
});

router.use(( err, req, res, next) => {
  const traceId = req.headers["x-trace-id"] || crypto.randomUUID();
  logger.error(`Route error: ${req.method} ${req.originalUrl} - ${err.message}`, { traceId, stack: err.stack });
  res.status(500).json({
    success: false,
    code: "SERVER_ERROR",
    message: "Internal server error",
    traceId,
  });
});

export default router;