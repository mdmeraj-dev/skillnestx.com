import jwt from "jsonwebtoken";
import User from "../models/User.js";
import logger from "../utils/logger.js";
import { generateAccessToken, generateRefreshToken } from "../controllers/authController.js";
import crypto from "crypto";

// Validate JWT environment variables
const requiredJwtVars = ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"];
const missingJwtVars = requiredJwtVars.filter((varName) => !process.env[varName]);
if (missingJwtVars.length > 0) {
  logger.error(`Missing JWT environment variables: ${missingJwtVars.join(", ")}`);
  throw new Error("Server configuration error: Missing JWT variables");
}

const setSecurityHeaders = (res) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "default-src 'self'",
  });
};

export const isAuthenticated = async (req, res, next) => {
  const traceId = req.headers["x-trace-id"] || crypto.randomUUID();
  setSecurityHeaders(res);

  try {
    const accessToken = req.cookies.accessToken || req.headers.authorization?.replace("Bearer ", "")?.trim();
    const sessionToken = req.cookies.sessionToken || req.headers["x-session-token"]?.trim();
    const refreshToken = req.cookies.refreshToken;

    if (!accessToken || !sessionToken) {
      logger.warn("Authentication failed: Missing access or session token", { traceId });
      return res.status(401).json({
        success: false,
        code: "MISSING_TOKEN",
        message: "Authentication and session tokens required",
        traceId,
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(accessToken, process.env.JWT_ACCESS_SECRET);
      if (!decoded?.userId || !decoded?.sessionId || decoded.sessionId !== sessionToken) {
        throw new Error("Invalid token payload or session mismatch");
      }
    } catch (error) {
      if (error.name !== "TokenExpiredError") {
        logger.warn(`Authentication failed: Invalid access token - ${error.message}`, { traceId });
        return res.status(401).json({
          success: false,
          code: "INVALID_TOKEN",
          message: "Invalid or malformed token",
          traceId,
        });
      }

      logger.info(`Access token expired`, { traceId });
      if (!refreshToken) {
        logger.warn("Authentication failed: No refresh token provided", { traceId });
        return res.status(401).json({
          success: false,
          code: "NO_REFRESH_TOKEN",
          message: "Session expired, please log in again",
          needsRefresh: true,
          traceId,
        });
      }

      let refreshDecoded;
      try {
        refreshDecoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        if (!refreshDecoded?.userId || !refreshDecoded?.sessionId || refreshDecoded.sessionId !== sessionToken) {
          throw new Error("Invalid refresh token payload or session mismatch");
        }
      } catch (refreshError) {
        logger.warn(`Authentication failed: Invalid refresh token - ${refreshError.message}`, { traceId });
        return res.status(401).json({
          success: false,
          code: "INVALID_REFRESH_TOKEN",
          message: "Invalid or expired refresh token",
          needsRefresh: true,
          traceId,
        });
      }

      const user = await User.findOne({ _id: refreshDecoded.userId, sessionToken, refreshToken }).select(
        "+sessionToken +refreshToken"
      );
      if (!user) {
        logger.warn(`Authentication failed: User not found or session invalid`, { traceId });
        return res.status(401).json({
          success: false,
          code: "INVALID_SESSION",
          message: "Invalid session or user not found",
          needsRefresh: true,
          traceId,
        });
      }

      const newAccessToken = generateAccessToken(user, sessionToken);
      const newRefreshToken = generateRefreshToken(user, sessionToken);

      user.refreshToken = newRefreshToken;
      await user.save();

      res.cookie("accessToken", newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 15 * 60 * 1000,
      });

      res.cookie("refreshToken", newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: user.provider === "google" ? 24 * 60 * 60 * 1000 : user.keepLoggedIn ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
      });

      res.cookie("sessionToken", sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: user.provider === "google" ? 24 * 60 * 60 * 1000 : user.keepLoggedIn ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
      });

      logger.info(`Tokens refreshed for userId: ${user._id}`, { traceId });
      return res.status(401).json({
        success: false,
        code: "TOKEN_EXPIRED",
        message: "Access token expired, new token provided",
        needsRefresh: true,
        accessToken: newAccessToken,
        sessionToken,
        traceId,
      });
    }

    const user = await User.findOne({ _id: decoded.userId, sessionToken }).select("+sessionToken +refreshToken");
    if (!user || user.sessionToken !== sessionToken) {
      logger.warn(`Authentication failed: User not found or session mismatch`, { traceId });
      return res.status(401).json({
        success: false,
        code: "INVALID_SESSION",
        message: "Invalid session or user not found",
        traceId,
      });
    }

    req.user = {
      userId: user._id,
      email: user.email,
      role: user.role,
      sessionToken,
    };

    logger.info(`Authentication successful for userId: ${user._id}`, { traceId });
    next();
  } catch (error) {
    logger.error(`Authentication error: ${error.message}`, { traceId, stack: error.stack });
    return res.status(500).json({
      success: false,
      code: "AUTH_FAILURE",
      message: "Authentication processing failed",
      traceId,
    });
  }
};

export const checkRole = (roles) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return (req, res, next) => {
    const traceId = req.headers["x-trace-id"] || crypto.randomUUID();
    setSecurityHeaders(res);

    if (!req.user) {
      logger.warn("Role check failed: No authenticated user", { traceId });
      return res.status(401).json({
        success: false,
        code: "UNAUTHENTICATED",
        message: "Authentication required",
        traceId,
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(`Role check failed for userId ${req.user.userId}: Required ${allowedRoles.join(", ")}`, {
        traceId,
      });
      return res.status(403).json({
        success: false,
        code: "FORBIDDEN",
        message: `Requires role: ${allowedRoles.join(" or ")}`,
        traceId,
      });
    }

    logger.info(`Role check passed for userId: ${req.user.userId}`, { traceId });
    next();
  };
};

export const adminOnly = checkRole("admin");

export const optionalAuth = async (req, res, next) => {
  const traceId = req.headers["x-trace-id"] || crypto.randomUUID();
  setSecurityHeaders(res);

  const accessToken = req.cookies.accessToken || req.headers.authorization?.replace("Bearer ", "")?.trim();
  const sessionToken = req.cookies.sessionToken || req.headers["x-session-token"]?.trim();

  if (!accessToken || !sessionToken) {
    req.user = null;
    logger.info("Optional authentication: Missing tokens, proceeding as guest", { traceId });
    return next();
  }

  return isAuthenticated(req, res, next);
};