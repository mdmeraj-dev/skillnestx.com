import User from "../models/User.js";
import TempUser from "../models/TempUser.js";
import jwt from "jsonwebtoken";
import { sendEmail, TEMPLATE_TYPES } from "../utils/sendEmail.js";
import { logger } from "../utils/logger.js";
import validator from "validator";

// Standardized error response
export const sendError = (res, status, code, message, traceId, needsRefresh = false) => {
  return res.status(status).json({
    success: false,
    code,
    message,
    traceId,
    needsRefresh,
  });
};

// Controller functions
export const signup = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || Date.now().toString(36);
  try {
    const { name, email, password } = req.body;

    if (!name?.trim() || !email?.trim() || !password?.trim()) {
      logger.warn("Signup failed: Missing required fields", { traceId });
      return sendError(res, 400, "INVALID_INPUT", "Name, email, and password are required", traceId);
    }

    const exactEmail = email.trim().toLowerCase();
    if (!validator.isEmail(exactEmail)) {
      logger.warn(`Signup failed: Invalid email format for ${exactEmail}`, { traceId });
      return sendError(res, 400, "INVALID_EMAIL", "Invalid email format", traceId);
    }

    if (password.length < 8) {
      logger.warn(`Signup failed: Password too short for ${exactEmail}`, { traceId });
      return sendError(res, 400, "INVALID_PASSWORD", "Password must be at least 8 characters", traceId);
    }

    const existingUser = await User.findOne({ email: exactEmail });
    if (existingUser) {
      logger.warn(`Signup failed: Email already registered for ${exactEmail}`, { traceId });
      return sendError(
        res,
        400,
        existingUser.provider === "google" ? "EMAIL_CONFLICT" : "EMAIL_EXISTS",
        existingUser.provider === "google"
          ? "Email already registered using Google. Please use Google to login"
          : "Email already registered",
        traceId
      );
    }

    await TempUser.deleteOne({ email: exactEmail });
    const tempUser = new TempUser({ name, email: exactEmail, password });
    const otp = await tempUser.generateOTP();

    try {
      await sendEmail({
        email: exactEmail,
        name,
        otp,
        templateType: TEMPLATE_TYPES.SIGNUP,
        templateData: {
          otp,
          otp_expiry: "10 minutes",
          support_email: process.env.SUPPORT_EMAIL || "support@skillnestx.com",
          company_name: "SkillNestX",
        },
        traceId,
      });
    } catch (emailError) {
      await TempUser.deleteOne({ _id: tempUser._id });
      logger.error(`Signup email failed for ${exactEmail}: ${emailError.message}`, { traceId, stack: emailError.stack });
      return sendError(res, 500, "EMAIL_ERROR", "Failed to send verification email", traceId);
    }

    logger.info(`Signup successful for ${exactEmail}, OTP sent`, { traceId });
    return res.status(201).json({
      success: true,
      message: "Verification OTP sent to email",
      tempUserId: tempUser._id,
      traceId,
    });
  } catch (error) {
    if (error.code === 11000) {
      logger.warn(`Signup failed: Duplicate email for ${req.body.email || "unknown"}`, { traceId });
      return sendError(res, 400, "EMAIL_EXISTS", "Email already registered", traceId);
    }
    logger.error(`Signup error for ${req.body.email || "unknown"}: ${error.message}`, { traceId, stack: error.stack });
    return sendError(res, 500, "SERVER_ERROR", "Internal server error", traceId);
  }
};

export const verifyEmail = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || Date.now().toString(36);
  try {
    const { email, otp } = req.body;

    if (!email?.trim() || !otp?.trim()) {
      logger.warn("Verify email failed: Missing email or OTP", { traceId });
      return sendError(res, 400, "INVALID_INPUT", "Email and OTP are required", traceId);
    }

    const exactEmail = email.trim().toLowerCase();
    if (!validator.isEmail(exactEmail)) {
      logger.warn(`Verify email failed: Invalid email format for ${exactEmail}`, { traceId });
      return sendError(res, 400, "INVALID_EMAIL", "Invalid email format", traceId);
    }

    const tempUser = await TempUser.verifyOTP(exactEmail, otp);
    const existingUser = await User.findOne({ email: exactEmail });
    if (existingUser) {
      await TempUser.deleteOne({ _id: tempUser._id });
      logger.warn(`Verify email failed: Email already verified for ${exactEmail}`, { traceId });
      return sendError(res, 400, "EMAIL_EXISTS", "This email is already verified. Please log in.", traceId);
    }

    const session = await User.startSession();
    let emailStatus = { success: true, message: "No email sent" };

    try {
      await session.withTransaction(async () => {
        // Use native MongoDB insert to bypass Mongoose middleware
        const insertResult = await User.collection.insertOne(
          {
            name: tempUser.name,
            email: tempUser.email,
            password: tempUser.password, // Single-hashed password
            provider: "email",
            isVerified: true,
            role: "user",
            lastLogin: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          { session }
        );

        // Retrieve the inserted document as a Mongoose model
        const user = await User.findById(insertResult.insertedId).session(session);
        if (!user) {
          throw new Error("Failed to retrieve inserted user");
        }

        const refreshToken = await user.generateRefreshToken();
        const accessToken = jwt.sign(
          { userId: user._id, email: user.email, role: user.role },
          process.env.JWT_SECRET,
          { expiresIn: "60m", issuer: "skillnestx", audience: "skillnestx-users" }
        );

        await TempUser.deleteOne({ _id: tempUser._id }, { session });

        logger.info(`User created for ${exactEmail}`, { traceId, userId: user._id });

        try {
          await sendEmail({
            email: user.email,
            name: user.name,
            templateType: TEMPLATE_TYPES.WELCOME,
            templateData: {
              user_name: user.name,
              support_email: process.env.SUPPORT_EMAIL || "support@skillnestx.com",
              company_name: "SkillNestX",
              login_url: `${process.env.VITE_FRONTEND_URL || "http://localhost:5173"}/login`,
            },
            traceId,
          });
          emailStatus = { success: true, message: "Welcome email sent" };
        } catch (emailError) {
          logger.warn(`Welcome email failed for ${exactEmail}: ${emailError.message}`, { traceId, stack: emailError.stack });
          emailStatus = { success: false, message: "Failed to send welcome email" };
        }

        return res.status(200).json({
          success: true,
          message: "Email verified successfully",
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            isVerified: user.isVerified,
            role: user.role,
            subscriptionStatus: user.activeSubscription?.status || "inactive", // Added subscription status
          },
          accessToken,
          refreshToken,
          emailStatus,
          redirectUrl: process.env.VITE_FRONTEND_URL || "http://localhost:5173",
          traceId,
        });
      });
    } finally {
      session.endSession();
    }
  } catch (error) {
    if (error.code === 11000) {
      logger.warn(`Verify email failed: Duplicate email for ${req.body.email || "unknown"}`, { traceId });
      return sendError(res, 400, "EMAIL_EXISTS", "Email already registered", traceId);
    }
    logger.error(`Verify email error for ${req.body.email || "unknown"}: ${error.message}`, { traceId, stack: error.stack });
    return sendError(
      res,
      400,
      error.message.includes("OTP") ? "INVALID_OTP" : "SERVER_ERROR",
      error.message.includes("OTP") ? "Invalid or expired OTP" : "Internal server error",
      traceId
    );
  }
};

export const resendVerificationOtp = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || Date.now().toString(36);
  try {
    const { email } = req.body;

    if (!email?.trim()) {
      logger.warn("Resend OTP failed: Missing email", { traceId });
      return sendError(res, 400, "INVALID_INPUT", "Email is required", traceId);
    }

    const exactEmail = email.trim().toLowerCase();
    if (!validator.isEmail(exactEmail)) {
      logger.warn(`Resend OTP failed: Invalid email format for ${exactEmail}`, { traceId });
      return sendError(res, 400, "INVALID_EMAIL", "Invalid email format", traceId);
    }

    const existingUser = await User.findOne({ email: exactEmail });
    if (existingUser) {
      logger.warn(`Resend OTP failed: Email already verified for ${exactEmail}`, { traceId });
      return sendError(res, 400, "EMAIL_EXISTS", "Email already verified", traceId);
    }

    const tempUser = await TempUser.findOne({ email: exactEmail });
    if (!tempUser) {
      logger.warn(`Resend OTP failed: No pending verification for ${exactEmail}`, { traceId });
      return sendError(res, 404, "NOT_FOUND", "No pending verification found for this email", traceId);
    }

    const otp = await tempUser.generateOTP();

    try {
      await sendEmail({
        email: exactEmail,
        name: tempUser.name,
        otp,
        templateType: TEMPLATE_TYPES.SIGNUP,
        templateData: {
          otp,
          otp_expiry: "10 minutes",
          supportDeletionOtp: process.env.SUPPORT_EMAIL || "support@skillnestx.com",
          company_name: "SkillNestX",
        },
        traceId,
      });
    } catch (emailError) {
      logger.error(`Resend OTP email failed for ${exactEmail}: ${emailError.message}`, { traceId, stack: emailError.stack });
      return sendError(res, 500, "EMAIL_ERROR", "Failed to send verification email", traceId);
    }

    logger.info(`Resend OTP successful for ${exactEmail}`, { traceId });
    return res.status(200).json({
      success: true,
      message: "New OTP sent to email",
      traceId,
    });
  } catch (error) {
    logger.error(`Resend OTP error for ${req.body.email || "unknown"}: ${error.message}`, { traceId, stack: error.stack });
    return sendError(res, 500, "SERVER_ERROR", "Internal server error", traceId);
  }
};

export const login = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || Date.now().toString(36);
  try {
    const { email, password } = req.body;

    if (!email?.trim() || !password?.trim()) {
      logger.warn(`Login failed: Missing email or password`, { traceId });
      return sendError(res, 400, "INVALID_INPUT", "Email and password are required", traceId);
    }

    const exactEmail = email.trim().toLowerCase();
    if (!validator.isEmail(exactEmail)) {
      logger.warn(`Login failed: Invalid email format for ${exactEmail}`, { traceId });
      return sendError(res, 400, "INVALID_EMAIL", "Invalid email format", traceId);
    }

    const user = await User.findOne({ email: exactEmail }).select("+password +refreshToken +isBanned +activeSubscription");
    if (!user) {
      logger.warn(`Login failed: No account found for ${exactEmail}`, { traceId });
      return sendError(res, 404, "USER_NOT_FOUND", "No account found", traceId);
    }

    if (user.isBanned) {
      logger.warn(`Login failed: User is banned for ${exactEmail}`, { traceId });
      return sendError(res, 403, "USER_BANNED", "Your account is banned. Please contact support.", traceId);
    }

    if (!user.isVerified) {
      logger.warn(`Login failed: Email not verified for ${exactEmail}`, { traceId });
      return sendError(res, 403, "EMAIL_NOT_VERIFIED", "Please verify your email", traceId);
    }

    if (user.provider === "email") {
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        logger.warn(`Login failed: Invalid credentials for ${exactEmail}`, { traceId });
        return sendError(res, 401, "INVALID_CREDENTIALS", "Invalid email or password", traceId);
      }
    } else {
      logger.warn(`Login failed: Provider mismatch for ${exactEmail}`, { traceId });
      return sendError(
        res,
        400,
        "PROVIDER_MISMATCH",
        "This email is registered with Google. Please use Google to login",
        traceId
      );
    }

    // Validate subscription status
    if (user.activeSubscription && user.activeSubscription.status === "active") {
      const now = new Date();
      if (user.activeSubscription.endDate && user.activeSubscription.endDate < now) {
        user.activeSubscription.status = "expired";
      }
    } else if (user.activeSubscription && user.activeSubscription.status === "inactive") {
      const now = new Date();
      if (user.activeSubscription.endDate && user.activeSubscription.endDate > now) {
        user.activeSubscription.status = "active";
      }
    }

    user.lastLogin = new Date();
    const refreshToken = await user.generateRefreshToken();
    const accessToken = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "60m", issuer: "skillnestx", audience: "skillnestx-users" }
    );

    const redirectPath = user.role === "admin" ? "/admin/AdminDashboard" : "/";
    const redirectUrl = `${process.env.VITE_FRONTEND_URL || "http://localhost:5173"}${redirectPath}`;

    logger.info(`Login successful for ${exactEmail}`, { traceId, userId: user._id });
    return res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isVerified: user.isVerified,
        role: user.role,
        subscriptionStatus: user.activeSubscription?.status || "inactive", // Added subscription status
      },
      accessToken,
      refreshToken,
      redirectUrl,
      traceId,
    });
  } catch (error) {
    logger.error(`Login error for ${req.body.email || "unknown"}: ${error.message}`, { traceId, stack: error.stack });
    return sendError(res, 500, "SERVER_ERROR", "Internal server error", traceId);
  }
};

export const googleAuthCallback = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || Date.now().toString(36);
  try {
    if (!req.user) {
      logger.error(`Google auth failed: No user data`, { traceId });
      return res.redirect(
        `${process.env.VITE_FRONTEND_URL || "http://localhost:5173"}/login?error=${encodeURIComponent(
          "Google authentication failed"
        )}&traceId=${traceId}`
      );
    }

    logger.info(`Google auth callback received user data`, { traceId, userData: req.user });

    const { _id, email, name, role, accessToken, refreshToken } = req.user;
    if (!email) {
      logger.error(`Google auth failed: No email provided in user data`, { traceId, userData: req.user });
      return res.redirect(
        `${process.env.VITE_FRONTEND_URL || "http://localhost:5173"}/login?error=${encodeURIComponent(
          "No email provided by Google"
        )}&traceId=${traceId}`
      );
    }

    const exactEmail = email.trim().toLowerCase();
    if (!validator.isEmail(exactEmail)) {
      logger.error(`Google auth failed: Invalid email format for ${exactEmail}`, { traceId });
      return res.redirect(
        `${process.env.VITE_FRONTEND_URL || "http://localhost:5173"}/login?error=${encodeURIComponent(
          "Invalid email format"
        )}&traceId=${traceId}`
      );
    }

    // Verify user exists and is not banned
    const user = await User.findById(_id).select("isBanned createdAt name email activeSubscription");
    if (!user || user.isBanned) {
      logger.error(`Google auth failed: ${user ? "User banned" : "User not found"} for ${exactEmail}`, {
        traceId,
        userId: _id,
      });
      return res.redirect(
        `${process.env.VITE_FRONTEND_URL || "http://localhost:5173"}/login?error=${encodeURIComponent(
          user?.isBanned ? "Your account is banned. Please contact support" : "User not found"
        )}&traceId=${traceId}`
      );
    }

    // Validate subscription status
    if (user.activeSubscription && user.activeSubscription.status === "active") {
      const now = new Date();
      if (user.activeSubscription.endDate && user.activeSubscription.endDate < now) {
        user.activeSubscription.status = "expired";
      }
    } else if (user.activeSubscription && user.activeSubscription.status === "inactive") {
      const now = new Date();
      if (user.activeSubscription.endDate && user.activeSubscription.endDate > now) {
        user.activeSubscription.status = "active";
      }
    }

    // Send welcome email for new users
    const now = new Date();
    const isNewUser = user.createdAt && (now - user.createdAt) < 10000; // 10 seconds
    if (isNewUser) {
      try {
        await sendEmail({
          email: user.email,
          name: user.name,
          templateType: TEMPLATE_TYPES.WELCOME,
          templateData: {
            user_name: user.name,
            support_email: process.env.SUPPORT_EMAIL || "support@skillnestx.com",
            company_name: "SkillNestX",
            login_url: `${process.env.VITE_FRONTEND_URL || "http://localhost:5173"}/login`,
          },
          traceId,
        });
        logger.info(`Welcome email sent for new Google user ${exactEmail}`, { traceId, userId: _id });
      } catch (emailError) {
        logger.warn(`Welcome email failed for ${exactEmail}: ${emailError.message}`, { traceId, stack: emailError.stack });
      }
    }

    // Update lastLogin
    user.lastLogin = new Date();
    await user.save();

    let redirectPath = role === "admin" ? "/admin/AdminDashboard" : "/";
    if (req.query.state) {
      logger.info(`Raw state parameter received: ${req.query.state}`, { traceId });
      try {
        let stateStr = decodeURIComponent(req.query.state);
        // Decode Base64 if it looks like a Base64 string
        if (stateStr.startsWith("ey")) {
          stateStr = Buffer.from(stateStr, "base64").toString("utf8");
          logger.info(`Base64-decoded state: ${stateStr}`, { traceId });
        }
        const state = JSON.parse(stateStr);
        redirectPath = state.redirectPath && state.redirectPath !== "/login" ? state.redirectPath : redirectPath;
      } catch (err) {
        logger.warn(`Invalid state parameter in Google auth: ${err.message}`, { traceId, rawState: req.query.state });
      }
    }

    const redirectUrl = `${
      process.env.VITE_FRONTEND_URL || "http://localhost:5173"
    }${redirectPath}?accessToken=${encodeURIComponent(accessToken)}&refreshToken=${encodeURIComponent(
      refreshToken
    )}&user=${encodeURIComponent(
      JSON.stringify({
        _id,
        name,
        email,
        isVerified: true,
        role,
        subscriptionStatus: user.activeSubscription?.status || "inactive", // Added subscription status
      })
    )}`;

    logger.info(`Google auth successful for ${exactEmail}, redirecting to ${redirectPath}`, { traceId, userId: _id });
    return res.redirect(redirectUrl);
  } catch (error) {
    logger.error(`Google auth error for ${req.user?.email || "unknown"}: ${error.message}`, {
      traceId,
      stack: error.stack,
      userData: req.user,
    });
    return res.redirect(
      `${process.env.VITE_FRONTEND_URL || "http://localhost:5173"}/login?error=${encodeURIComponent(
        "Google authentication failed"
      )}&traceId=${traceId}`
    );
  }
};

export const refreshToken = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || Date.now().toString(36);
  try {
    const refreshToken = req.body.refreshToken?.trim();
    if (!refreshToken) {
      logger.warn(`Refresh token missing`, { traceId });
      return sendError(res, 401, "NO_TOKEN", "Refresh token required", traceId, true);
    }

    const user = await User.verifyRefreshToken(refreshToken);
    if (!user || user.isBanned) {
      logger.warn(`Refresh token failed: ${user ? "User banned" : "Invalid token"}`, { traceId });
      return sendError(
        res,
        user?.isBanned ? 403 : 401,
        user?.isBanned ? "USER_BANNED" : "INVALID_TOKEN",
        user?.isBanned ? "Your account is banned" : "Invalid or expired refresh token",
        traceId,
        !user?.isBanned
      );
    }

    const newRefreshToken = await user.generateRefreshToken();
    const accessToken = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "60m", issuer: "skillnestx", audience: "skillnestx-users" }
    );

    logger.info(`Token refreshed for user ${user.email}`, { traceId, userId: user._id });
    return res.status(200).json({
      success: true,
      message: "Token refreshed",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isVerified: user.isVerified,
        role: user.role,
        subscriptionStatus: user.activeSubscription?.status || "inactive", // Added subscription status
      },
      accessToken,
      refreshToken: newRefreshToken,
      traceId,
    });
  } catch (error) {
    logger.error(`Refresh token error: ${error.message}`, { traceId, stack: error.stack });
    return sendError(res, 401, "INVALID_TOKEN", "Invalid or expired refresh token", traceId, true);
  }
};

export const logout = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || Date.now().toString(36);
  try {
    if (req.user) {
      const user = await User.findById(req.user.userId).select("+refreshToken +refreshTokenExpiry");
      if (user) {
        await user.invalidateRefreshToken();
      }
    }

    logger.info(`User logged out`, { traceId, userId: req.user?.userId });
    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
      traceId,
    });
  } catch (error) {
    logger.error(`Logout error: ${error.message}`, { traceId, stack: error.stack });
    return sendError(res, 500, "SERVER_ERROR", "Internal server error", traceId);
  }
};

export const forgotPassword = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || Date.now().toString(36);
  try {
    const { email } = req.body;

    if (!email?.trim()) {
      logger.warn("Forgot password failed: Missing email", { traceId });
      return sendError(res, 400, "INVALID_INPUT", "Email is required", traceId);
    }

    const exactEmail = email.trim().toLowerCase();
    if (!validator.isEmail(exactEmail)) {
      logger.warn(`Forgot password failed: Invalid email format for ${exactEmail}`, { traceId });
      return sendError(res, 400, "INVALID_EMAIL", "Invalid email format", traceId);
    }

    const user = await User.findOne({ email: exactEmail });
    if (!user) {
      logger.warn(`Forgot password failed: No account found for ${exactEmail}`, { traceId });
      return sendError(res, 404, "USER_NOT_FOUND", "No account found", traceId);
    }

    if (user.isBanned) {
      logger.warn(`Forgot password failed: User is banned for ${exactEmail}`, { traceId });
      return sendError(res, 403, "USER_BANNED", "Your account is banned. Please contact support.", traceId);
    }

    if (user.provider === "google") {
      logger.warn(`Forgot password failed: Provider mismatch for ${exactEmail}`, { traceId });
      return sendError(
        res,
        400,
        "PROVIDER_MISMATCH",
        "This email is registered with Google. Please use Google to login",
        traceId
      );
    }

    const resetToken = await user.generatePasswordResetToken();
    const resetUrl = `${process.env.VITE_FRONTEND_URL || "http://localhost:5173"}/reset-password?token=${resetToken}`;

    try {
      await sendEmail({
        email: exactEmail,
        name: user.name,
        templateType: TEMPLATE_TYPES.PASSWORD_RESET,
        templateData: {
          user_name: user.name,
          reset_url: resetUrl,
          support_email: process.env.SUPPORT_EMAIL || "support@skillnestx.com",
          company_name: "SkillNestX",
          expiry_time: "10 minutes",
        },
        traceId,
      });
    } catch (emailError) {
      await user.clearResetToken();
      logger.error(`Password reset email failed for ${exactEmail}: ${emailError.message}`, { traceId, stack: error.stack });
      return sendError(res, 500, "EMAIL_ERROR", "Failed to send reset email", traceId);
    }

    logger.info(`Password reset link sent for ${exactEmail}`, { traceId });
    return res.status(200).json({
      success: true,
      message: "Password reset link sent to email",
      traceId,
    });
  } catch (error) {
    logger.error(`Forgot password error for ${req.body.email || "unknown"}: ${error.message}`, { traceId, stack: error.stack });
    return sendError(
      res,
      error.message.includes("attempts") ? 429 : 500,
      error.message.includes("attempts") ? "TOO_MANY_ATTEMPTS" : "SERVER_ERROR",
      error.message.includes("attempts") ? "Too many attempts" : "Internal server error",
      traceId
    );
  }
};

export const validateResetToken = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || Date.now().toString(36);
  try {
    const { token } = req.body;

    if (!token?.trim()) {
      logger.warn("Validate reset token failed: Missing token", { traceId });
      return sendError(res, 400, "INVALID_INPUT", "Token is required", traceId);
    }

    await User.verifyResetToken(token);
    logger.info(`Reset token validated`, { traceId });
    return res.status(200).json({
      success: true,
      message: "Token is valid",
      traceId,
    });
  } catch (error) {
    logger.error(`Validate reset token error: ${error.message}`, { traceId, stack: error.stack });
    return sendError(res, 400, "INVALID_TOKEN", "Invalid or expired reset token", traceId);
  }
};

export const resetPassword = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || Date.now().toString(36);
  try {
    const { token, newPassword } = req.body;

    if (!token?.trim() || !newPassword?.trim()) {
      logger.warn("Reset password failed: Missing token or new password", { traceId });
      return sendError(res, 400, "INVALID_INPUT", "Token and new password are required", traceId);
    }

    if (newPassword.length < 8) {
      logger.warn("Reset password failed: Password too short", { traceId });
      return sendError(res, 400, "INVALID_PASSWORD", "Password must be at least 8 characters", traceId);
    }

    const user = await User.verifyResetToken(token);
    if (user.isBanned) {
      logger.warn(`Reset password failed: User is banned for ${user.email}`, { traceId });
      return sendError(res, 403, "USER_BANNED", "Your account is banned. Please contact support.", traceId);
    }

    user.password = newPassword;
    await user.invalidateAllTokens(); // Invalidate all tokens for security
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
          support_email: process.env.SUPPORT_EMAIL || "support@skillnestx.com",
          company_name: "SkillNestX",
          login_url: `${process.env.VITE_FRONTEND_URL || "http://localhost:5173"}/login`,
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

    logger.info(`Password reset successful for ${user.email}`, { traceId, userId: user._id });
    return res.status(200).json({
      success: true,
      message: "Password reset successfully",
      emailStatus,
      traceId,
    });
  } catch (error) {
    logger.error(`Reset password error: ${error.message}`, { traceId, stack: error.stack });
    return sendError(
      res,
      400,
      error.message.includes("token") ? "INVALID_TOKEN" : "SERVER_ERROR",
      error.message.includes("token") ? "Invalid or expired reset token" : "Internal server error",
      traceId
    );
  }
};