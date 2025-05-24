import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import User from "../models/User.js";
import config from "../config.js";
import { logger } from "../utils/logger.js";
import { randomUUID } from "crypto";

// Set secure HTTP headers
export const setSecurityHeaders = (req, res, next) => {
  const traceId = req.headers?.["x-trace-id"] || randomUUID();
  try {
    if (!res || typeof res.set !== "function") {
      logger.error("Invalid response object in setSecurityHeaders", { traceId });
      throw new Error("Invalid response object");
    }
    res.set({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": `default-src 'self'; connect-src 'self' ${config.CLIENT_URL} ${config.VITE_BACKEND_URL}; frame-ancestors 'none'; style-src 'self' 'unsafe-inline'; script-src 'self'`,
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
      "X-XSS-Protection": "1; mode=block",
    });
    logger.info("Security headers set", { traceId });
    next();
  } catch (error) {
    logger.error(`Failed to set security headers: ${error.message}`, { traceId, stack: error.stack });
    next(error);
  }
};

// Standardized error response
export const sendError = (res, status, code, message, traceId, needsRefresh = false) => {
  if (!res || typeof res.status !== "function") {
    logger.error(`Invalid response object in sendError: ${message}`, { traceId });
    throw new Error("Invalid response object");
  }
  return res.status(status).json({
    success: false,
    code,
    message,
    traceId,
    needsRefresh,
  });
};

// Main authentication middleware
export const ensureAuthenticated = asyncHandler(async (req, res, next) => {
  const traceId = req.headers?.["x-trace-id"] || randomUUID();

  // Validate middleware arguments
  if (!req || !res || !next || typeof res.status !== "function" || typeof next !== "function") {
    logger.error("Invalid middleware arguments in ensureAuthenticated", { traceId });
    throw new Error("Invalid middleware arguments");
  }

  // Check headers existence
  if (!req.headers) {
    logger.error("Request headers are undefined", { traceId });
    return sendError(res, 400, "INVALID_REQUEST", "Request headers missing", traceId);
  }

  // Extract access token
  const authHeader = req.headers.authorization;
  const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "").trim() : null;
  if (!accessToken) {
    logger.warn("Authentication failed: Missing access token", { traceId });
    return sendError(res, 401, "MISSING_TOKEN", "Access token required", traceId, true);
  }

  let decoded;
  try {
    decoded = jwt.verify(accessToken, process.env.JWT_SECRET, {
      issuer: "skillnestx",
      audience: "skillnestx-users",
    });
  } catch (error) {
    logger.warn(`Authentication failed: JWT verification error - ${error.message}`, { traceId, stack: error.stack });
    return sendError(
      res,
      401,
      error.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "INVALID_TOKEN",
      error.name === "TokenExpiredError" ? "Access token expired" : "Invalid or malformed access token",
      traceId,
      error.name === "TokenExpiredError"
    );
  }

  // Validate user
  const user = await User.findById(decoded.userId)
    .select("email role isBanned activeSubscription")
    .lean();

  if (!user || user.isBanned) {
    logger.warn(`Authentication failed: ${user ? "User banned" : "User not found"}`, { traceId });
    return sendError(
      res,
      user?.isBanned ? 403 : 401,
      user?.isBanned ? "USER_BANNED" : "USER_NOT_FOUND",
      user?.isBanned ? "Your account is banned. Please contact support" : "User not found",
      traceId
    );
  }

  req.user = {
    userId: user._id,
    email: user.email,
    role: user.role || "user",
    subscriptionStatus: user.activeSubscription?.status || "inactive", // Changed to activeSubscription.status
  };

  logger.info(`Authentication successful for user: ${user.email}`, { traceId, userId: user._id });
  next();
});

// Role-based access control
export const ensureRole = (roles) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  return asyncHandler(async (req, res, next) => {
    const traceId = req.headers?.["x-trace-id"] || randomUUID();

    // Skip execution if middleware arguments are invalid
    if (!req || !res || !next || typeof res.status !== "function" || typeof next !== "function") {
      logger.error("Invalid middleware arguments in ensureRole", { traceId });
      throw new Error("Invalid middleware arguments");
    }

    if (!req.user) {
      logger.warn("Role check failed: No authenticated user", { traceId });
      return sendError(res, 401, "UNAUTHENTICATED", "Authentication required", traceId);
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(`Role check failed for user: ${req.user.userId}, required: ${allowedRoles.join(", ")}`, { traceId });
      return sendError(res, 403, "FORBIDDEN", `Requires role: ${allowedRoles.join(" or ")}`, traceId);
    }

    logger.info(`Role check passed for user: ${req.user.userId}, role: ${req.user.role}`, { traceId });
    next();
  });
};

// Admin-only middleware
export const ensureAdmin = ensureRole("admin");

// Optional authentication
export const optionalAuth = asyncHandler(async (req, res, next) => {
  const traceId = req.headers?.["x-trace-id"] || randomUUID();

  // Skip execution if middleware arguments are invalid
  if (!req || !res || !next || typeof res.status !== "function" || typeof next !== "function") {
    logger.error("Invalid middleware arguments in optionalAuth", { traceId });
    throw new Error("Invalid middleware arguments");
  }

  const authHeader = req.headers?.authorization;
  const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "").trim() : null;

  if (!accessToken) {
    req.user = null;
    logger.info("Optional auth: No token, proceeding as guest", { traceId });
    return next();
  }

  return ensureAuthenticated(req, res, next);
});