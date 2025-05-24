import express from "express";
import rateLimit from "express-rate-limit";
import passport from "passport";
import { ensureAuthenticated, setSecurityHeaders, sendError } from "../middleware/authMiddleware.js";
import {
  signup,
  verifyEmail,
  resendVerificationOtp,
  login,
  googleAuthCallback,
  refreshToken,
  logout,
  forgotPassword,
  validateResetToken,
  resetPassword,
} from "../controllers/authController.js";
import { logger } from "../utils/logger.js";

const router = express.Router();

// Rate limit configurations
const rateLimitConfig = {
  signup: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 32,
    handler: (req, res) => {
      const traceId = req.headers["x-trace-id"] || Date.now().toString(36);
      sendError(res, 429, "TOO_MANY_SIGNUP_ATTEMPTS", "Too many signup attempts. Please try again later.", traceId);
    },
  }),
  login: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 32,
    handler: (req, res) => {
      const traceId = req.headers["x-trace-id"] || Date.now().toString(36);
      sendError(res, 429, "TOO_MANY_LOGIN_ATTEMPTS", "Too many login attempts. Please try again later.", traceId);
    },
  }),
  verifyEmail: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 16,
    handler: (req, res) => {
      const traceId = req.headers["x-trace-id"] || Date.now().toString(36);
      sendError(res, 429, "TOO_MANY_VERIFY_ATTEMPTS", "Too many verification attempts. Please try again later.", traceId);
    },
  }),
  resendOtp: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 16,
    handler: (req, res) => {
      const traceId = req.headers["x-trace-id"] || Date.now().toString(36);
      sendError(res, 429, "TOO_MANY_RESEND_ATTEMPTS", "Too many OTP resend requests. Please try again later.", traceId);
    },
  }),
  forgotPassword: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 16,
    handler: (req, res) => {
      const traceId = req.headers["x-trace-id"] || Date.now().toString(36);
      sendError(res, 429, "TOO_MANY_RESET_ATTEMPTS", "Too many password reset requests. Please try again later.", traceId);
    },
  }),
};

// Middleware to log route entry
const logRouteEntry = (routeName) => (req, res, next) => {
  const traceId = req.headers["x-trace-id"] || Date.now().toString(36);
  logger.info(`Entering route: ${routeName}`, { traceId, method: req.method, path: req.originalUrl });
  next();
};

// Google OAuth initiation
router.get("/google", setSecurityHeaders, logRouteEntry("auth/google"), (req, res, next) => {
  const traceId = req.headers["x-trace-id"] || Date.now().toString(36);
  logger.info(`Initiating Google OAuth`, { traceId });

  const stateData = { redirectPath: req.query.redirectPath || "/" };
  const state = Buffer.from(JSON.stringify(stateData)).toString("base64");

  passport.authenticate("google", {
    scope: ["profile", "email"],
    state,
    session: false,
    prompt: "select_account",
  })(req, res, next);
});

// Google OAuth callback
router.get(
  "/google/callback",
  setSecurityHeaders,
  logRouteEntry("auth/google/callback"),
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${process.env.VITE_FRONTEND_URL || "http://localhost:5173"}/login?error=Google%20authentication%20failed`,
  }),
  googleAuthCallback
);

// Authentication routes
router.post("/signup", setSecurityHeaders, rateLimitConfig.signup, logRouteEntry("auth/signup"), signup);
router.post("/verify-email", setSecurityHeaders, rateLimitConfig.verifyEmail, logRouteEntry("auth/verify-email"), verifyEmail);
router.post("/resend-otp", setSecurityHeaders, rateLimitConfig.resendOtp, logRouteEntry("auth/resend-otp"), resendVerificationOtp);
router.post("/login", setSecurityHeaders, rateLimitConfig.login, logRouteEntry("auth/login"), login);
router.post("/refresh-token", setSecurityHeaders, logRouteEntry("auth/refresh-token"), refreshToken);
router.post("/logout", setSecurityHeaders, ensureAuthenticated, logRouteEntry("auth/logout"), logout);
router.post("/forgot-password", setSecurityHeaders, rateLimitConfig.forgotPassword, logRouteEntry("auth/forgot-password"), forgotPassword);
router.post("/reset-password", setSecurityHeaders, logRouteEntry("auth/reset-password"), resetPassword);
router.post("/validate-reset-token", setSecurityHeaders, logRouteEntry("auth/validate-reset-token"), validateResetToken);

export default router;