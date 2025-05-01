import express from "express";
import rateLimit from "express-rate-limit";
import passport from "passport";
import {
  signup,
  verifyEmail,
  resendVerificationOtp,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  validateResetToken,
  googleAuthCallback,
} from "../controllers/authController.js";
import { isAuthenticated, adminOnly } from "../middleware/authMiddleware.js";
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
  signup: {
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: {
      success: false,
      code: "TOO_MANY_SIGNUP_ATTEMPTS",
      message: "Too many signup attempts. Please try again later.",
    },
  },
  login: {
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {
      success: false,
      code: "TOO_MANY_LOGIN_ATTEMPTS",
      message: "Too many login attempts. Please try again later.",
    },
  },
  verifyEmail: {
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {
      success: false,
      code: "TOO_MANY_VERIFY_ATTEMPTS",
      message: "Too many verification attempts. Please try again later.",
    },
  },
  resendOtp: {
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: {
      success: false,
      code: "TOO_MANY_RESEND_ATTEMPTS",
      message: "Too many OTP resend requests. Please try again later.",
    },
  },
  forgotPassword: {
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: {
      success: false,
      code: "TOO_MANY_RESET_ATTEMPTS",
      message: "Too many password reset requests. Please try again later.",
    },
  },
};

const signupLimiter = rateLimit(rateLimitConfig.signup);
const loginLimiter = rateLimit(rateLimitConfig.login);
const verifyEmailLimiter = rateLimit(rateLimitConfig.verifyEmail);
const resendOtpLimiter = rateLimit(rateLimitConfig.resendOtp);
const forgotPasswordLimiter = rateLimit(rateLimitConfig.forgotPassword);

const validateInput = (req, res, next) => {
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
    if (req.body.otp) {
      req.body.otp = sanitizeHtml(req.body.otp.trim(), { allowedTags: [] });
      if (!/^\d{6}$/.test(req.body.otp)) {
        logger.warn(`Invalid OTP format: ${req.body.otp}`, { traceId });
        return res.status(400).json({
          success: false,
          code: "INVALID_OTP",
          message: "OTP must be a 6-digit number",
          traceId,
        });
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

router.use(setSecurityHeaders);

router.get("/google", (req, res, next) => {
  const traceId = req.headers["x-trace-id"] || crypto.randomUUID();
  const { firstTime } = req.query;

  logger.info(`Initiating Google OAuth`, {
    firstTime: firstTime || "false",
    traceId,
  });

  const state = JSON.stringify({
    keepLoggedIn: false,
  });

  const prompt = firstTime === "true" ? "consent select_account" : "select_account";

  passport.authenticate("google", {
    scope: ["profile", "email"],
    state,
    accessType: "offline",
    session: false,
    prompt,
  })(req, res, next);
});

router.get("/google/callback", (req, res, next) => {
  const traceId = req.headers["x-trace-id"] || crypto.randomUUID();
  passport.authenticate("google", { session: false }, (err, user, info) => {
    if (err || !user) {
      const errorMessage = encodeURIComponent(
        err?.userFriendlyMessage || info?.message || "Google authentication failed"
      );
      logger.warn(`Google OAuth callback failed: ${err?.message || info?.message || "Unknown error"}`, {
        traceId,
        stack: err?.stack,
      });
      return res.redirect(
        `${process.env.VITE_FRONTEND_URL || "https://skillnestx.com"}/login?error=${errorMessage}`
      );
    }
    req.user = user;
    logger.info(`Google OAuth callback successful for userId: ${user.userId}`, { traceId });
    next();
  })(req, res, next);
}, googleAuthCallback);

router.post("/signup", signupLimiter, validateInput, signup);
router.post("/verify-email", verifyEmailLimiter, validateInput, verifyEmail);
router.post("/resend-otp", resendOtpLimiter, validateInput, resendVerificationOtp);
router.post("/login", loginLimiter, validateInput, login);
router.post("/refresh-token", refreshToken);
router.post("/logout", isAuthenticated, logout);
router.post("/forgot-password", forgotPasswordLimiter, validateInput, forgotPassword);
router.post("/reset-password", validateInput, resetPassword);
router.post("/validate-reset-token", validateInput, validateResetToken);

router.get("/admin/dashboard", isAuthenticated, adminOnly, (req, res) => {
  const traceId = req.headers["x-trace-id"] || crypto.randomUUID();
  logger.info(`Admin dashboard accessed by userId: ${req.user.userId}`, { traceId });
  res.json({
    success: true,
    message: "Welcome to the admin dashboard",
    user: {
      userId: req.user.userId,
      email: req.user.email,
      role: req.user.role,
    },
    traceId,
  });
});

export default router;