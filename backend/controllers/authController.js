import User from "../models/User.js";
import TempUser from "../models/TempUser.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { sendEmail, TEMPLATE_TYPES } from "../utils/sendEmail.js";
import { sendResetLink } from "../utils/sendResetLink.js";
import logger from "../utils/logger.js";
import validator from "validator";
import sanitizeHtml from "sanitize-html";
import crypto from "crypto";

// Validate JWT secrets
const requiredJwtVars = ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"];
const missingJwtVars = requiredJwtVars.filter((varName) => !process.env[varName]);
if (missingJwtVars.length > 0) {
  logger.error(`Missing JWT environment variables: ${missingJwtVars.join(", ")}`);
  throw new Error("Server configuration error: Missing JWT variables");
}

export const generateAccessToken = (user, sessionToken) => {
  return jwt.sign(
    { userId: user._id, email: user.email, role: user.role, sessionId: sessionToken },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: "15m" }
  );
};

export const generateRefreshToken = (user, sessionToken) => {
  return jwt.sign(
    { userId: user._id, email: user.email, role: user.role, sessionId: sessionToken },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: user.keepLoggedIn ? "7d" : "1d" }
  );
};

const generateOtp = () => {
  return crypto.randomInt(100000, 999999).toString();
};

const setSecurityHeaders = (res) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "default-src 'self'",
  });
};

export const signup = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || crypto.randomUUID();
  setSecurityHeaders(res);

  try {
    const { name, email, password } = req.body;

    if (!name?.trim() || !email?.trim() || !password?.trim()) {
      return res.status(400).json({
        success: false,
        code: "INVALID_INPUT",
        message: "Name, email, and password are required",
        traceId,
      });
    }

    const sanitizedName = sanitizeHtml(name.trim(), { allowedTags: [], allowedAttributes: {} });
    const exactEmail = email.trim().toLowerCase();

    if (!validator.isEmail(exactEmail)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_EMAIL",
        message: "Invalid email format",
        traceId,
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PASSWORD",
        message: "Password must be at least 8 characters",
        traceId,
      });
    }

    const existingUser = await User.findOne({ email: exactEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        code: existingUser.provider === "google" ? "EMAIL_CONFLICT" : "EMAIL_EXISTS",
        message:
          existingUser.provider === "google"
            ? "Email already registered using Google. Please use Google to login"
            : "Email already registered",
        traceId,
      });
    }

    await TempUser.deleteOne({ email: exactEmail });

    const otp = generateOtp();
    const tempUser = await TempUser.create({
      name: sanitizedName,
      email: exactEmail,
      password,
      provider: "email",
      otp,
      otpExpiry: new Date(Date.now() + 10 * 60 * 1000),
    });

    const savedTempUser = await TempUser.findOne({ email: exactEmail }).select("+password");
    if (!savedTempUser || !savedTempUser.password || !savedTempUser.password.startsWith("$2b$")) {
      logger.error(`Signup failed: Password not saved correctly for ${exactEmail}`, { traceId });
      await TempUser.deleteOne({ _id: tempUser._id });
      return res.status(500).json({
        success: false,
        code: "SERVER_ERROR",
        message: "Failed to process signup. Please try again.",
        traceId,
      });
    }

    try {
      await sendEmail({
        email: exactEmail,
        name: sanitizedName,
        otp,
        templateType: TEMPLATE_TYPES.SIGNUP,
        templateData: {
          otp,
          otp_expiry: "10 minutes",
          support_email: "support@skillnestx.com",
          company_name: "SkillNestX",
        },
        traceId,
      });
    } catch (emailError) {
      await TempUser.deleteOne({ _id: tempUser._id });
      logger.error(`Signup email failed for ${exactEmail}: ${emailError.message}`, {
        traceId,
        stack: emailError.stack,
      });
      return res.status(500).json({
        success: false,
        code: "EMAIL_ERROR",
        message: "Failed to send verification email",
        traceId,
      });
    }

    logger.info(`Signup successful for ${exactEmail}, OTP sent`, { traceId });
    return res.status(201).json({
      success: true,
      message: "Verification OTP sent to email",
      tempUserId: tempUser._id,
      traceId,
    });
  } catch (error) {
    logger.error(`Signup error for ${req.body.email || "unknown"}: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: "Internal server error",
      traceId,
    });
  }
};

export const verifyEmail = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || crypto.randomUUID();
  setSecurityHeaders(res);

  try {
    const { email, otp } = req.body;

    if (!email?.trim() || !otp?.trim()) {
      logger.warn("Verify email failed: Missing email or OTP", { traceId });
      return res.status(400).json({
        success: false,
        code: "INVALID_INPUT",
        message: "Email and OTP are required",
        traceId,
      });
    }

    const exactEmail = email.trim().toLowerCase();
    if (!validator.isEmail(exactEmail)) {
      logger.warn(`Verify email failed: Invalid email format for ${exactEmail}`, { traceId });
      return res.status(400).json({
        success: false,
        code: "INVALID_EMAIL",
        message: "Invalid email format",
        traceId,
      });
    }

    if (!/^\d{6}$/.test(otp)) {
      logger.warn(`Verify email failed: Invalid OTP format for ${exactEmail}`, { traceId });
      return res.status(400).json({
        success: false,
        code: "INVALID_OTP_FORMAT",
        message: "OTP must be a 6-digit number",
        traceId,
      });
    }

    const existingUser = await User.findOne({ email: exactEmail });
    if (existingUser) {
      logger.warn(`Verify email failed: Email already verified for ${exactEmail}`, { traceId });
      return res.status(400).json({
        success: false,
        code: "EMAIL_EXISTS",
        message: "This email is already verified. Please log in.",
        traceId,
      });
    }

    const tempUser = await TempUser.findOne({ email: exactEmail }).select("+otp +otpExpiry +password");
    if (!tempUser) {
      logger.warn(`Verify email failed: No pending verification for ${exactEmail}`, { traceId });
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Signup request not found. Please sign up again.",
        traceId,
      });
    }

    if (tempUser.otp !== otp) {
      logger.warn(`Verify email failed: Invalid OTP for ${exactEmail}`, { traceId });
      return res.status(400).json({
        success: false,
        code: "INVALID_OTP",
        message: "Invalid OTP. Please try again.",
        traceId,
      });
    }

    if (!tempUser.otpExpiry || tempUser.otpExpiry < Date.now()) {
      logger.warn(`Verify email failed: OTP expired for ${exactEmail}`, { traceId });
      return res.status(400).json({
        success: false,
        code: "EXPIRED_OTP",
        message: "OTP has expired. Please request a new one.",
        canRetry: true,
        traceId,
      });
    }

    if (!tempUser.password) {
      logger.error(`Verify email failed: Missing password for ${exactEmail}`, { traceId });
      return res.status(400).json({
        success: false,
        code: "MISSING_PASSWORD",
        message: "Password is missing. Please sign up again.",
        traceId,
      });
    }

    if (!tempUser.password.startsWith("$2b$")) {
      logger.error(`Verify email failed: Invalid password hash for ${exactEmail}`, { traceId });
      return res.status(500).json({
        success: false,
        code: "INVALID_PASSWORD_HASH",
        message: "Internal server error: Invalid password data.",
        traceId,
      });
    }

    const session = await User.startSession();
    let emailStatus = { success: true, message: "No email sent" };

    try {
      await session.withTransaction(async () => {
        const user = await User.create(
          [
            {
              name: tempUser.name,
              email: tempUser.email,
              password: tempUser.password,
              provider: "email",
              isVerified: true,
              role: tempUser.role || "user",
              mobileNumber: tempUser.mobileNumber,
              profilePicture: tempUser.profilePicture,
              bio: tempUser.bio,
              purchasedCourses: tempUser.purchasedCourses,
              transactions: tempUser.transactions,
              keepLoggedIn: tempUser.keepLoggedIn || false,
            },
          ],
          { session }
        );

        const sessionToken = await user[0].generateSessionToken();
        const refreshToken = generateRefreshToken(user[0], sessionToken);
        user[0].refreshToken = refreshToken;
        user[0].sessionToken = sessionToken;
        await user[0].save({ session });

        await TempUser.deleteOne({ _id: tempUser._id }, { session });

        logger.info(`User created for ${exactEmail}`, {
          traceId,
          userId: user[0]._id,
          sessionToken,
          refreshToken: refreshToken.substring(0, 10) + "...",
        });

        try {
          await sendEmail({
            email: user[0].email,
            name: user[0].name,
            templateType: TEMPLATE_TYPES.WELCOME,
            templateData: {
              user_name: user[0].name,
              support_email: "support@skillnestx.com",
              company_name: "SkillNestX",
              login_url: process.env.VITE_FRONTEND_URL || "https://skillnestx.com/login",
            },
            traceId,
          });
          emailStatus = { success: true, message: "Welcome email sent" };
        } catch (emailError) {
          logger.warn(`Welcome email failed for ${exactEmail}: ${emailError.message}`, {
            traceId,
            stack: emailError.stack,
          });
          emailStatus = { success: false, message: "Failed to send welcome email" };
        }

        const accessToken = generateAccessToken(user[0], sessionToken);

        res.cookie("accessToken", accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: 15 * 60 * 1000,
        });

        res.cookie("refreshToken", refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: user[0].keepLoggedIn ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
        });

        res.cookie("sessionToken", sessionToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: user[0].keepLoggedIn ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
        });

        logger.info(`Cookies set for ${exactEmail}`, {
          traceId,
          cookies: ["accessToken", "refreshToken", "sessionToken"],
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
        });

        return res.status(200).json({
          success: true,
          message: "Email verified successfully",
          user: {
            _id: user[0]._id,
            name: user[0].name,
            email: user[0].email,
            isVerified: user[0].isVerified,
            role: user[0].role,
          },
          accessToken,
          sessionToken,
          emailStatus,
          redirectUrl: process.env.VITE_FRONTEND_URL || "https://skillnestx.com",
          traceId,
        });
      });
    } catch (error) {
      logger.error(`Transaction failed for ${exactEmail}: ${error.message}`, {
        traceId,
        stack: error.stack,
      });
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    logger.error(`Verify email error for ${req.body.email || "unknown"}: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: "Internal server error",
      traceId,
    });
  }
};

export const resendVerificationOtp = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || crypto.randomUUID();
  setSecurityHeaders(res);

  try {
    const { email } = req.body;

    if (!email?.trim()) {
      return res.status(400).json({
        success: false,
        code: "INVALID_INPUT",
        message: "Email is required",
        traceId,
      });
    }

    const exactEmail = email.trim().toLowerCase();
    if (!validator.isEmail(exactEmail)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_EMAIL",
        message: "Invalid email format",
        traceId,
      });
    }

    const existingUser = await User.findOne({ email: exactEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        code: "EMAIL_EXISTS",
        message: "Email already verified",
        traceId,
      });
    }

    const tempUser = await TempUser.findOne({ email: exactEmail });
    if (!tempUser) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "No pending verification found for this email",
        traceId,
      });
    }

    const otp = generateOtp();
    tempUser.otp = otp;
    tempUser.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await tempUser.save();

    try {
      await sendEmail({
        email: exactEmail,
        name: tempUser.name,
        otp,
        templateType: TEMPLATE_TYPES.SIGNUP,
        templateData: {
          otp,
          otp_expiry: "10 minutes",
          support_email: "support@skillnestx.com",
          company_name: "SkillNestX",
        },
        traceId,
      });
    } catch (emailError) {
      logger.error(`Resend OTP email failed for ${exactEmail}: ${emailError.message}`, {
        traceId,
        stack: emailError.stack,
      });
      return res.status(500).json({
        success: false,
        code: "EMAIL_ERROR",
        message: "Failed to send verification email",
        traceId,
      });
    }

    return res.status(200).json({
      success: true,
      message: "New OTP sent to email",
      traceId,
    });
  } catch (error) {
    logger.error(`Resend OTP error for ${req.body.email || "unknown"}: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: "Internal server error",
      traceId,
    });
  }
};

export const login = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || crypto.randomUUID();
  setSecurityHeaders(res);

  try {
    const { email, password, keepLoggedIn } = req.body;

    if (!email?.trim() || !password?.trim()) {
      logger.warn(`Login failed: Missing email or password`, { traceId });
      return res.status(400).json({
        success: false,
        code: "INVALID_INPUT",
        message: "Email and password are required",
        traceId,
      });
    }

    const exactEmail = email.trim().toLowerCase();
    if (!validator.isEmail(exactEmail)) {
      logger.warn(`Login failed: Invalid email format for ${exactEmail}`, { traceId });
      return res.status(400).json({
        success: false,
        code: "INVALID_EMAIL",
        message: "Invalid email format",
        traceId,
      });
    }

    const user = await User.findOne({ email: exactEmail }).select("+password +sessionToken +refreshToken");
    if (!user) {
      logger.warn(`Login failed: No account found for ${exactEmail}`, { traceId });
      return res.status(404).json({
        success: false,
        code: "USER_NOT_FOUND",
        message: "No account found",
        traceId,
      });
    }

    if (!user.isVerified) {
      logger.warn(`Login failed: Email not verified for ${exactEmail}`, { traceId });
      return res.status(403).json({
        success: false,
        code: "EMAIL_NOT_VERIFIED",
        message: "Please verify your email",
        traceId,
      });
    }

    if (user.provider === "email") {
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        logger.warn(`Login failed: Invalid credentials for ${exactEmail}`, { traceId });
        return res.status(401).json({
          success: false,
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password",
          traceId,
        });
      }
    } else {
      logger.warn(`Login failed: Provider mismatch for ${exactEmail}`, { traceId });
      return res.status(400).json({
        success: false,
        code: "PROVIDER_MISMATCH",
        message: "This account is registered with Google. Please use Google to login",
        traceId,
      });
    }

    user.lastLogin = new Date();
    user.keepLoggedIn = keepLoggedIn || false;

    let sessionToken;
    try {
      sessionToken = await user.generateSessionToken();
      if (!sessionToken) {
        logger.error(`Login failed: Failed to generate session token for ${exactEmail}`, { traceId });
        return res.status(500).json({
          success: false,
          code: "SESSION_TOKEN_ERROR",
          message: "Failed to generate session token",
          traceId,
        });
      }
      user.sessionToken = sessionToken;
    } catch (error) {
      logger.error(`Login failed: Session token generation error for ${exactEmail}: ${error.message}`, { traceId });
      return res.status(500).json({
        success: false,
        code: "SESSION_TOKEN_ERROR",
        message: "Failed to generate session token",
        traceId,
      });
    }

    let accessToken;
    try {
      accessToken = generateAccessToken(user, sessionToken);
      jwt.verify(accessToken, process.env.JWT_ACCESS_SECRET);
    } catch (jwtError) {
      logger.error(`Login failed: Failed to generate valid access token for ${exactEmail}: ${jwtError.message}`, { traceId });
      return res.status(500).json({
        success: false,
        code: "TOKEN_GENERATION_ERROR",
        message: "Failed to generate authentication token",
        traceId,
      });
    }

    let refreshToken;
    try {
      refreshToken = generateRefreshToken(user, sessionToken);
      user.refreshToken = refreshToken;
    } catch (jwtError) {
      logger.error(`Login failed: Failed to generate refresh token for ${exactEmail}: ${jwtError.message}`, { traceId });
      return res.status(500).json({
        success: false,
        code: "TOKEN_GENERATION_ERROR",
        message: "Failed to generate refresh token",
        traceId,
      });
    }

    try {
      await user.save();
      logger.info(`Tokens saved for ${exactEmail}`, {
        traceId,
        userId: user._id,
        sessionToken: sessionToken.substring(0, 10) + "...",
        refreshToken: refreshToken.substring(0, 10) + "...",
      });
    } catch (dbError) {
      logger.error(`Login failed: Failed to save tokens for ${exactEmail}: ${dbError.message}`, { traceId });
      return res.status(500).json({
        success: false,
        code: "DATABASE_ERROR",
        message: "Failed to save session data",
        traceId,
      });
    }

    try {
      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 15 * 60 * 1000,
      });

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: keepLoggedIn ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
      });

      res.cookie("sessionToken", sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: keepLoggedIn ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
      });

      logger.info(`Cookies set for ${exactEmail}`, {
        traceId,
        cookies: ["accessToken", "refreshToken", "sessionToken"],
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });
    } catch (cookieError) {
      logger.error(`Login failed: Failed to set cookies for ${exactEmail}: ${cookieError.message}`, { traceId });
      return res.status(500).json({
        success: false,
        code: "COOKIE_ERROR",
        message: "Failed to set authentication cookies",
        traceId,
      });
    }

    const redirectPath = user.role === "admin" ? "/admin/AdminDashboard" : "/";
    const redirectUrl = `${process.env.VITE_FRONTEND_URL || "https://skillnestx.com"}${redirectPath}`;

    logger.info(`Login successful for ${exactEmail}`, {
      traceId,
      userId: user._id,
      sessionToken: sessionToken.substring(0, 10) + "...",
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isVerified: user.isVerified,
        role: user.role,
      },
      accessToken,
      sessionToken,
      redirectUrl,
      traceId,
    });
  } catch (error) {
    logger.error(`Login error for ${req.body.email || "unknown"}: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: "Internal server error",
      traceId,
    });
  }
};

export const googleAuthCallback = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || crypto.randomUUID();
  setSecurityHeaders(res);

  try {
    if (!req.user) {
      logger.error(`Google auth failed: No user data`, { traceId });
      return res.redirect(
        `${process.env.VITE_FRONTEND_URL || "https://skillnestx.com"}/login?error=${encodeURIComponent(
          "Google authentication failed"
        )}&traceId=${traceId}`
      );
    }

    const { id, email, displayName } = req.user;
    const exactEmail = email.trim().toLowerCase();
    let name = sanitizeHtml(displayName?.trim() || "Google User", { allowedTags: [], allowedAttributes: {} });

    if (!validator.isEmail(exactEmail)) {
      logger.error(`Google auth failed: Invalid email ${exactEmail}`, { traceId });
      return res.redirect(
        `${process.env.VITE_FRONTEND_URL || "https://skillnestx.com"}/login?error=${encodeURIComponent(
          "Invalid email format"
        )}&traceId=${traceId}`
      );
    }

    if (name.length < 2) name = "Google User";
    if (name.length > 50) name = name.slice(0, 50);

    let user = await User.findOne({ email: exactEmail }).select("+sessionToken +refreshToken");
    let emailStatus = { success: false, message: "No email sent" };
    let isNewUser = false;

    const session = await User.startSession();
    try {
      await session.withTransaction(async () => {
        if (!user) {
          user = await User.create(
            [
              {
                googleId: id,
                email: exactEmail,
                name,
                provider: "google",
                isVerified: true,
                role: "user",
                lastLogin: new Date(),
                keepLoggedIn: false,
              },
            ],
            { session }
          );
          user = user[0];
          isNewUser = true;
        } else if (!user.googleId) {
          user.googleId = id;
          user.provider = "google";
          user.lastLogin = new Date();
          user.keepLoggedIn = false;
          await user.save({ session });
        } else {
          user.lastLogin = new Date();
          user.keepLoggedIn = false;
          await user.save({ session });
        }

        const sessionToken = await user.generateSessionToken();
        user.sessionToken = sessionToken;
        user.refreshToken = generateRefreshToken(user, sessionToken);
        await user.save({ session });
      });
    } finally {
      session.endSession();
    }

    if (isNewUser) {
      try {
        await sendEmail({
          email: exactEmail,
          name,
          templateType: TEMPLATE_TYPES.WELCOME,
          templateData: {
            support_email: "support@skillnestx.com",
            company_name: "SkillNestX",
            login_url: process.env.VITE_FRONTEND_URL || "https://skillnestx.com/login",
          },
          traceId,
        });
        emailStatus = { success: true, message: "Welcome email sent" };
      } catch (emailError) {
        logger.warn(`Google auth welcome email failed for ${exactEmail}: ${emailError.message}`, {
          traceId,
          stack: emailError.stack,
        });
        emailStatus = { success: false, message: "Failed to send welcome email" };
      }
    }

    const accessToken = generateAccessToken(user, user.sessionToken);

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", user.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.cookie("sessionToken", user.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000,
    });

    let redirectPath = user.role === "admin" ? "/admin/AdminDashboard" : "/";
    if (req.query.state) {
      try {
        const state = JSON.parse(decodeURIComponent(req.query.state));
        redirectPath = state.redirectPath && state.redirectPath !== "/login" ? state.redirectPath : "/";
      } catch (err) {
        logger.warn(`Invalid state parameter in Google auth: ${err.message}`, { traceId });
      }
    }

    const redirectUrl = `${
      process.env.VITE_FRONTEND_URL || "https://skillnestx.com"
    }${redirectPath}?accessToken=${encodeURIComponent(accessToken)}&sessionToken=${encodeURIComponent(user.sessionToken)}&success=true&emailStatus=${
      emailStatus.success ? "sent" : isNewUser ? "failed" : "not_sent"
    }`;

    logger.info(`Google auth successful for ${exactEmail}, redirecting to ${redirectUrl}`, { traceId });
    return res.redirect(redirectUrl);
  } catch (error) {
    logger.error(`Google auth error: ${error.message}`, { traceId, stack: error.stack });
    return res.redirect(
      `${process.env.VITE_FRONTEND_URL || "https://skillnestx.com"}/login?error=${encodeURIComponent(
        "Google authentication failed"
      )}&traceId=${traceId}`
    );
  }
};

export const refreshToken = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || crypto.randomUUID();
  setSecurityHeaders(res);

  try {
    const refreshToken = req.cookies.refreshToken;
    const sessionToken = req.cookies.sessionToken;

    if (!refreshToken || !sessionToken) {
      logger.warn(`Refresh token or session token missing`, { traceId });
      return res.status(401).json({
        success: false,
        code: "NO_TOKEN",
        message: "Refresh token and session token required",
        traceId,
      });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findOne({ _id: decoded.userId, refreshToken, sessionToken }).select(
      "+sessionToken +refreshToken"
    );

    if (!user) {
      logger.warn(`Invalid session or user not found for refresh token`, { traceId });
      return res.status(401).json({
        success: false,
        code: "INVALID_TOKEN",
        message: "Invalid session or user not found",
        traceId,
      });
    }

    const newSessionToken = await user.generateSessionToken();
    user.refreshToken = generateRefreshToken(user, newSessionToken);
    await user.save();

    const accessToken = generateAccessToken(user, newSessionToken);

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", user.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: user.keepLoggedIn ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
    });

    res.cookie("sessionToken", newSessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: user.keepLoggedIn ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
    });

    logger.info(`Token refreshed for user ${user.email}`, { traceId });
    return res.status(200).json({
      success: true,
      message: "Token refreshed",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isVerified: user.isVerified,
        role: user.role,
      },
      accessToken,
      sessionToken: newSessionToken,
      traceId,
    });
  } catch (error) {
    logger.error(`Refresh token error: ${error.message}`, { traceId, stack: error.stack });
    return res.status(401).json({
      success: false,
      code: "INVALID_TOKEN",
      message: "Invalid or expired refresh token",
      traceId,
    });
  }
};

export const logout = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || crypto.randomUUID();
  setSecurityHeaders(res);

  try {
    const sessionToken = req.cookies.sessionToken;
    if (sessionToken) {
      const user = await User.findOne({ sessionToken }).select("+sessionToken +refreshToken");
      if (user) {
        user.sessionToken = null;
        user.refreshToken = null;
        await user.save();
      }
    }

    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.clearCookie("sessionToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    logger.info(`User logged out`, { traceId });
    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
      traceId,
    });
  } catch (error) {
    logger.error(`Logout error: ${error.message}`, { traceId, stack: error.stack });
    return res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: "Internal server error",
      traceId,
    });
  }
};

export const forgotPassword = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || crypto.randomUUID();
  setSecurityHeaders(res);

  try {
    const { email } = req.body;

    if (!email?.trim()) {
      return res.status(400).json({
        success: false,
        code: "INVALID_INPUT",
        message: "Email is required",
        traceId,
      });
    }

    const exactEmail = email.trim().toLowerCase();
    if (!validator.isEmail(exactEmail)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_EMAIL",
        message: "Invalid email format",
        traceId,
      });
    }

    const user = await User.findOne({ email: exactEmail });
    if (!user) {
      return res.status(404).json({
        success: false,
        code: "USER_NOT_FOUND",
        message: "No account found",
        traceId,
      });
    }

    if (user.provider === "google") {
      return res.status(400).json({
        success: false,
        code: "PROVIDER_MISMATCH",
        message: "This account is registered with Google. Please use Google to login",
        traceId,
      });
    }

    const resetToken = await user.generatePasswordResetToken();
    const resetUrl = `${
      process.env.VITE_FRONTEND_URL || "https://skillnestx.com"
    }/reset-password?token=${resetToken}`;

    try {
      await sendResetLink({
        email: exactEmail,
        user_name: user.name,
        reset_url: resetUrl,
        support_email: "support@skillnestx.com",
        company_name: "SkillNestX",
        expiry_time: "10 minutes",
        traceId,
      });
    } catch (emailError) {
      await user.clearResetToken();
      logger.error(`Password reset email failed for ${exactEmail}: ${emailError.message}`, {
        traceId,
        stack: emailError.stack,
      });
      return res.status(500).json({
        success: false,
        code: "EMAIL_ERROR",
        message: "Failed to send reset email",
        traceId,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Password reset link sent to email",
      traceId,
    });
  } catch (error) {
    logger.error(`Forgot password error for ${req.body.email || "unknown"}: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    return res.status(error.message.includes("attempts") ? 429 : 500).json({
      success: false,
      code: error.message.includes("attempts") ? "TOO_MANY_ATTEMPTS" : "SERVER_ERROR",
      message: error.message,
      traceId,
    });
  }
};

export const validateResetToken = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || crypto.randomUUID();
  setSecurityHeaders(res);

  try {
    const { token } = req.body;

    if (!token?.trim()) {
      return res.status(400).json({
        success: false,
        code: "INVALID_INPUT",
        message: "Token is required",
        traceId,
      });
    }

    await User.verifyResetToken(token);
    return res.status(200).json({
      success: true,
      message: "Token is valid",
      traceId,
    });
  } catch (error) {
    logger.error(`Validate reset token error: ${error.message}`, { traceId, stack: error.stack });
    return res.status(400).json({
      success: false,
      code: "INVALID_TOKEN",
      message: error.message,
      traceId,
    });
  }
};

export const resetPassword = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || crypto.randomUUID();
  setSecurityHeaders(res);

  try {
    const { token, newPassword } = req.body;

    if (!token?.trim() || !newPassword?.trim()) {
      return res.status(400).json({
        success: false,
        code: "INVALID_INPUT",
        message: "Token and new password are required",
        traceId,
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PASSWORD",
        message: "Password must be at least 8 characters",
        traceId,
      });
    }

    const user = await User.verifyResetToken(token);
    user.password = newPassword;
    user.sessionToken = null;
    user.refreshToken = null;
    await user.clearResetToken();
    await user.save();

    let emailStatus = { success: true, message: "No email sent" };
    try {
      await sendEmail({
        email: user.email,
        name: user.name,
        templateType: TEMPLATE_TYPES.PASSWORD_CHANGE_CONFIRMATION,
        templateData: {
          user_name: user.name,
          support_email: "support@skillnestx.com",
          company_name: "SkillNestX",
          login_url: process.env.VITE_FRONTEND_URL || "https://skillnestx.com/login",
        },
        traceId,
      });
      emailStatus = { success: true, message: "Confirmation email sent" };
    } catch (emailError) {
      logger.warn(`Password reset confirmation email failed for ${user.email}: ${emailError.message}`, {
        traceId,
        stack: emailError.stack,
      });
      emailStatus = { success: false, message: "Failed to send confirmation email" };
    }

    return res.status(200).json({
      success: true,
      message: "Password reset successfully",
      emailStatus,
      traceId,
    });
  } catch (error) {
    logger.error(`Reset password error: ${error.message}`, { traceId, stack: error.stack });
    return res.status(400).json({
      success: false,
      code: error.message.includes("token") ? "INVALID_TOKEN" : "SERVER_ERROR",
      message: error.message,
      traceId,
    });
  }
};