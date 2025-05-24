import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import jwt from "jsonwebtoken";
import validator from "validator";
import User from "../models/User.js";
import { logger } from "../utils/logger.js";
import crypto from "crypto";

// Validate Google OAuth environment variables
const requiredVars = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_CALLBACK_URL", "JWT_SECRET"];
const missingVars = requiredVars.filter((varName) => !process.env[varName]);
if (missingVars.length > 0) {
  logger.error(`Missing required environment variables: ${missingVars.join(", ")}`);
  throw new Error("Server configuration error: Missing required environment variables");
}

// Initialize Passport with Google Strategy
export const initializePassport = () => {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
        scope: ["profile", "email"],
        prompt: "select_account consent",
        accessType: "offline",
      },
      async (accessToken, refreshToken, profile, done) => {
        const traceId = crypto.randomUUID();
        try {
          // Validate profile data
          if (!profile?.id || !profile.emails?.[0]?.value) {
            logger.error("Invalid Google profile data", {
              profileId: profile?.id || "undefined",
              email: profile?.emails?.[0]?.value || "missing",
              traceId,
            });
            return done(
              new Error("Invalid Google profile data", {
                cause: { code: "INVALID_PROFILE", userFriendlyMessage: "Google authentication failed" },
              }),
              null
            );
          }

          const email = profile.emails[0].value.trim().toLowerCase();
          if (!validator.isEmail(email)) {
            logger.error(`Invalid email format: ${email}`, { traceId });
            return done(
              new Error("Invalid email format", {
                cause: { code: "INVALID_EMAIL", userFriendlyMessage: "Invalid email format" },
              }),
              null
            );
          }

          // Find or create user
          let user = await User.findOne({ googleId: profile.id }).select("+refreshToken +refreshTokenExpiry +activeSubscription");

          if (user) {
            // Update existing user if email changed
            if (user.email !== email) {
              user.email = email;
              logger.info(`Updated email for userId: ${user._id}`, { email, traceId });
            }
            user.name = profile.displayName?.trim().slice(0, 50) || "Google User";
            user.lastLogin = new Date();
          } else {
            // Check for existing email with different provider
            const existingUser = await User.findOne({ email });
            if (existingUser && existingUser.provider !== "google") {
              logger.warn(`This account is registered with ${existingUser.provider}`, {
                email,
                provider: existingUser.provider,
                traceId,
              });
              return done(null, false, {
                code: "PROVIDER_MISMATCH",
                message: `This account is registered with ${existingUser.provider}. Please use email to log in.`,
              });
            }

            // Create new user
            user = new User({
              googleId: profile.id,
              email,
              name: profile.displayName?.trim().slice(0, 50) || "Google User",
              provider: "google",
              isVerified: true,
              role: "user",
              lastLogin: new Date(),
            });
          }

          // Generate tokens
          const refreshToken = await user.generateRefreshToken();
          await user.save();
          logger.info(`User saved with refreshToken for ${email}`, { userId: user._id, traceId });

          const accessToken = jwt.sign(
            { userId: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "60m", issuer: "skillnestx", audience: "skillnestx-users" }
          );
          logger.info(`Access token generated for ${email}`, { userId: user._id, traceId });

          const authUser = {
            _id: user._id,
            email: user.email,
            name: user.name,
            role: user.role,
            subscriptionStatus: user.activeSubscription?.status || "inactive", // Changed to activeSubscription.status
            accessToken,
            refreshToken,
          };

          logger.info(`Google user authenticated`, {
            email,
            userId: user._id,
            role: user.role,
            traceId,
          });
          return done(null, authUser);
        } catch (error) {
          if (error.code === 11000) {
            logger.error(`Duplicate key error during user creation`, {
              email,
              profileId: profile?.id || "undefined",
              traceId,
              stack: error.stack,
            });
            return done(
              new Error("Email or Google ID already exists", {
                cause: { code: "DUPLICATE_KEY", userFriendlyMessage: "This email is already registered" },
              }),
              null
            );
          }
          logger.error(`Google Strategy error: ${error.message}`, {
            stack: error.stack,
            profileId: profile?.id || "undefined",
            email: profile?.emails?.[0]?.value || "missing",
            traceId,
          });
          return done(
            new Error("Google authentication failed", {
              cause: { code: error.code || "SERVER_ERROR", userFriendlyMessage: "Google authentication failed" },
            }),
            null
          );
        }
      }
    )
  );

  // Disable Passport session serialization
  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user));
};