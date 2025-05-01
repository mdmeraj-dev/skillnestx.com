import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";
import logger from "../utils/logger.js";
import crypto from "crypto";
import validator from "validator";
import sanitizeHtml from "sanitize-html";

// Validate Google OAuth environment variables
const requiredGoogleVars = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_CALLBACK_URL"];
const missingGoogleVars = requiredGoogleVars.filter((varName) => !process.env[varName]);
if (missingGoogleVars.length > 0) {
  logger.error(`Missing Google OAuth environment variables: ${missingGoogleVars.join(", ")}`);
  throw new Error("Server configuration error: Missing Google OAuth variables");
}

export const initializePassport = () => {
  const traceId = crypto.randomUUID();
  logger.info("Initializing Google OAuth Strategy", {
    clientID: process.env.GOOGLE_CLIENT_ID ? "set" : "missing",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ? "set" : "missing",
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
    traceId,
  });

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
        scope: ["profile", "email"],
        passReqToCallback: true,
        accessType: "offline",
      },
      async (req, accessToken, refreshToken, profile, done) => {
        const traceId = req.headers["x-trace-id"] || crypto.randomUUID();
        try {
          if (!profile || !profile.id || !profile.emails?.[0]?.value) {
            logger.error("Invalid Google profile data", {
              profileId: profile?.id || "undefined",
              email: profile?.emails?.[0]?.value || "missing",
              traceId,
            });
            const error = new Error("Invalid Google profile data");
            error.code = "INVALID_PROFILE";
            error.userFriendlyMessage = "Google authentication failed. Please try again.";
            return done(error, null);
          }

          const exactEmail = profile.emails[0].value.trim().toLowerCase();
          if (!validator.isEmail(exactEmail)) {
            logger.error(`Invalid email format: ${exactEmail}`, { traceId });
            const error = new Error("Invalid email format");
            error.code = "INVALID_EMAIL";
            error.userFriendlyMessage = "Google authentication failed: Invalid email format.";
            return done(error, null);
          }

          let displayName = sanitizeHtml(profile.displayName?.trim() || "Google User", {
            allowedTags: [],
            allowedAttributes: {},
          });
          if (displayName.length < 2) displayName = "Google User";
          if (displayName.length > 50) displayName = displayName.slice(0, 50);

          logger.info("Google Strategy callback", {
            profileId: profile.id,
            email: exactEmail,
            accessToken: accessToken ? "set" : "missing",
            refreshToken: refreshToken ? "set" : "missing",
            traceId,
          });

          let user = await User.findOne({ googleId: profile.id }).select(
            "_id email name provider googleId isVerified role sessionToken refreshToken"
          );

          let sessionToken = null;
          if (user) {
            if (user.email !== exactEmail) {
              user.email = exactEmail;
              logger.info(`Updated email for userId: ${user._id}`, { email: exactEmail, traceId });
            }
            sessionToken = await user.generateSessionToken();
            user.sessionToken = sessionToken;
            await user.save();
          } else {
            const existingUser = await User.findOne({ email: exactEmail });
            if (existingUser && existingUser.provider !== "google") {
              logger.warn(`Email registered with ${existingUser.provider} provider`, {
                email: exactEmail,
                provider: existingUser.provider,
                traceId,
              });
              const error = new Error("Email registered with another provider");
              error.code = "PROVIDER_MISMATCH";
              error.userFriendlyMessage = `This account is registered with ${existingUser.provider}. Please use ${existingUser.provider} login.`;
              error.provider = existingUser.provider;
              return done(error, null);
            }
          }

          const authUser = {
            id: profile.id,
            email: exactEmail,
            displayName,
            _id: user?._id,
            sessionToken,
          };

          logger.info(`Google user processed`, {
            email: exactEmail,
            userId: user?._id || "new",
            sessionToken: sessionToken ? "set" : "not set",
            traceId,
          });
          return done(null, authUser);
        } catch (error) {
          logger.error(`Google Strategy error: ${error.message}`, {
            stack: error.stack,
            profileId: profile?.id || "undefined",
            email: profile?.emails?.[0]?.value || "missing",
            traceId,
          });
          error.code = error.code || "SERVER_ERROR";
          error.userFriendlyMessage = error.userFriendlyMessage || "Google authentication failed.";
          return done(error, null);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user._id || user.id);
  });

  passport.deserializeUser(async (id, done) => {
    const traceId = crypto.randomUUID();
    try {
      const user = await User.findById(id).select(
        "_id email name provider googleId isVerified role sessionToken refreshToken"
      );
      if (!user) {
        logger.warn(`User not found during deserialization`, { id, traceId });
        return done(null, null);
      }
      done(null, {
        id: user.googleId || user._id.toString(),
        email: user.email,
        displayName: user.name,
        _id: user._id,
        sessionToken: user.sessionToken,
      });
    } catch (error) {
      logger.error(`Deserialization error: ${error.message}`, { stack: error.stack, traceId });
      done(error, null);
    }
  });
};