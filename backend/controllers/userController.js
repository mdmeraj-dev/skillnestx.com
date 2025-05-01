import User from "../models/User.js";
import { sendEmail, TEMPLATE_TYPES } from "../utils/sendEmail.js";
import logger from "../utils/logger.js";
import validator from "validator";
import sanitizeHtml from "sanitize-html";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config(); // Load environment variables

const setSecurityHeaders = (res) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "default-src 'self'",
  });
};

export const getCurrentUser = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || crypto.randomUUID();
  setSecurityHeaders(res);

  try {
    const { userId, sessionToken } = req.user || {};
    if (!userId || !sessionToken) {
      logger.warn(
        "Get current user failed: Unauthorized or missing session token",
        { traceId }
      );
      return res.status(401).json({
        success: false,
        code: "UNAUTHORIZED",
        message: "Authentication and valid session required",
        traceId,
      });
    }

    const user = await User.findOne({ _id: userId, sessionToken }).select(
      "_id name email mobileNumber profilePicture bio isVerified role"
    );
    if (!user) {
      logger.warn(
        `Get current user failed for userId ${userId}: Invalid session or user not found`,
        { traceId }
      );
      return res.status(401).json({
        success: false,
        code: "INVALID_SESSION",
        message: "Invalid or expired session",
        traceId,
      });
    }

    logger.info(`Current user retrieved for userId ${userId}`, { traceId });
    return res.status(200).json({
      success: true,
      message: "User retrieved successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        mobileNumber: user.mobileNumber,
        profilePicture: user.profilePicture,
        bio: user.bio,
        isVerified: user.isVerified,
        role: user.role,
      },
      sessionToken,
      traceId,
    });
  } catch (error) {
    logger.error(
      `Get current user error for userId ${req.user?.userId || "unknown"}: ${error.message}`,
      {
        traceId,
        stack: error.stack,
      }
    );
    return res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: "Internal server error",
      traceId,
    });
  }
};

export const updateProfile = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || crypto.randomUUID();
  setSecurityHeaders(res);

  try {
    const { userId, sessionToken } = req.user || {};
    if (!userId || !sessionToken) {
      logger.warn(
        "Update profile failed: Unauthorized or missing session token",
        { traceId }
      );
      return res.status(401).json({
        success: false,
        code: "UNAUTHORIZED",
        message: "Authentication and valid session required",
        traceId,
      });
    }

    const user = await User.findOne({ _id: userId, sessionToken });
    if (!user) {
      logger.warn(
        `Update profile failed for userId ${userId}: Invalid session or user not found`,
        { traceId }
      );
      return res.status(401).json({
        success: false,
        code: "INVALID_SESSION",
        message: "Invalid or expired session",
        traceId,
      });
    }

    const { name, email, mobileNumber, profilePicture, bio, password } =
      req.body;
    const updates = {};

    if (name?.trim()) {
      const sanitizedName = sanitizeHtml(name.trim(), { allowedTags: [] });
      if (sanitizedName.length < 2 || sanitizedName.length > 50) {
        return res.status(400).json({
          success: false,
          code: "INVALID_NAME",
          message: "Name must be between 2 and 50 characters",
          traceId,
        });
      }
      updates.name = sanitizedName;
    }

    if (email?.trim()) {
      const exactEmail = email.trim().toLowerCase();
      if (!validator.isEmail(exactEmail)) {
        return res.status(400).json({
          success: false,
          code: "INVALID_EMAIL",
          message: "Invalid email format",
          traceId,
        });
      }
      updates.email = exactEmail;
    }

    if (mobileNumber !== undefined) {
      if (mobileNumber?.trim()) {
        const sanitizedMobile = sanitizeHtml(mobileNumber.trim(), {
          allowedTags: [],
        });
        if (!/^\+?[1-9]\d{6,14}$/.test(sanitizedMobile)) {
          return res.status(400).json({
            success: false,
            code: "INVALID_MOBILE",
            message: "Invalid mobile number format",
            traceId,
          });
        }
        updates.mobileNumber = sanitizedMobile;
      } else {
        updates.mobileNumber = "";
      }
    }

    if (profilePicture !== undefined) {
      if (profilePicture?.trim()) {
        const sanitizedUrl = sanitizeHtml(profilePicture.trim(), {
          allowedTags: [],
        });
        if (
          !validator.isURL(sanitizedUrl, {
            protocols: ["http", "https"],
            require_protocol: true,
          })
        ) {
          return res.status(400).json({
            success: false,
            code: "INVALID_URL",
            message: "Invalid profile picture URL",
            traceId,
          });
        }
        updates.profilePicture = sanitizedUrl;
      } else {
        updates.profilePicture = "";
      }
    }

    if (bio !== undefined) {
      if (bio?.trim()) {
        const sanitizedBio = sanitizeHtml(bio.trim(), { allowedTags: [] });
        if (sanitizedBio.length > 500) {
          return res.status(400).json({
            success: false,
            code: "INVALID_BIO",
            message: "Bio cannot exceed 500 characters",
            traceId,
          });
        }
        updates.bio = sanitizedBio;
      } else {
        updates.bio = "";
      }
    }

    if (password?.trim()) {
      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          code: "INVALID_PASSWORD",
          message: "Password must be at least 8 characters",
          traceId,
        });
      }
      updates.password = await bcrypt.hash(password, 10);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        code: "INVALID_INPUT",
        message: "No valid fields provided",
        traceId,
      });
    }

    const originalEmail = user.email;
    Object.assign(user, updates);
    await user.save();

    let emailStatus = { success: true, message: "No email sent" };
    const changedFields = Object.keys(updates);
    if (changedFields.length > 0) {
      try {
        const fieldNames = changedFields.map((field) =>
          field === "mobileNumber"
            ? "mobile number"
            : field === "profilePicture"
              ? "profile picture"
              : field
        );
        const changedFieldsMessage =
          fieldNames.length === 1
            ? fieldNames[0]
            : fieldNames.length === 2
              ? `${fieldNames[0]} and ${fieldNames[1]}`
              : `${fieldNames.slice(0, -1).join(", ")}, and ${fieldNames[fieldNames.length - 1]}`;
        const hasHave = fieldNames.length > 1 ? "have" : "has";
        const emailChanged = changedFields.includes("email")
          ? `You can now use your new email address ${user.email} to log in.`
          : "";
        const emailToNotify = changedFields.includes("email")
          ? originalEmail
          : user.email;

        await sendEmail({
          email: emailToNotify,
          name: user.name,
          templateType: TEMPLATE_TYPES.PROFILE_UPDATE,
          templateData: {
            changed_fields: changedFieldsMessage,
            has_have: hasHave,
            email_changed: emailChanged,
            support_email: "support@skillnestx.com",
            company_name: "SkillNestX",
          },
          traceId,
        });
        emailStatus = {
          success: true,
          message: "Update confirmation email sent",
        };
      } catch (emailError) {
        logger.warn(
          `Profile update email failed for ${user.email}: ${emailError.message}`,
          {
            traceId,
            stack: emailError.stack,
          }
        );
        emailStatus = {
          success: false,
          message: "Failed to send update confirmation email",
        };
      }
    }

    logger.info(`Profile updated for userId ${userId}`, {
      traceId,
      updatedFields: changedFields,
    });
    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        mobileNumber: user.mobileNumber,
        profilePicture: user.profilePicture,
        bio: user.bio,
        isVerified: user.isVerified,
        role: user.role,
      },
      emailStatus,
      traceId,
    });
  } catch (error) {
    logger.error(
      `Update profile error for userId ${req.user?.userId || "unknown"}: ${error.message}`,
      {
        traceId,
        stack: error.stack,
      }
    );
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        code: "EMAIL_EXISTS",
        message: "Email already in use",
        traceId,
      });
    }
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: error.message.includes("validation")
        ? error.message
        : "Invalid input data",
      traceId,
    });
  }
};

export const deleteAccount = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || crypto.randomUUID();
  setSecurityHeaders(res);

  try {
    const { userId, sessionToken } = req.user || {};
    if (!userId || !sessionToken) {
      logger.warn(
        "Delete account failed: Unauthorized or missing session token",
        { traceId }
      );
      return res.status(401).json({
        success: false,
        code: "UNAUTHORIZED",
        message: "Authentication and valid session required",
        traceId,
      });
    }

    const user = await User.findOne({ _id: userId, sessionToken });
    if (!user) {
      logger.warn(
        `Delete account failed for userId ${userId}: Invalid session or user not found`,
        { traceId }
      );
      return res.status(401).json({
        success: false,
        code: "INVALID_SESSION",
        message: "Invalid or expired session",
        traceId,
      });
    }

    const email = user.email;
    const name = user.name;
    await user.deleteOne();

    let emailStatus = { success: true, message: "No email sent" };
    try {
      const now = new Date();

      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, "0");
      const ampm = hours >= 12 ? "pm" : "am";
      hours = hours % 12 || 12;
      const time = `${hours}:${minutes} ${ampm}`;

      const formattedDate = `${now.getDate().toString().padStart(2, "0")}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now.getFullYear()} at ${time}`;

      const templateData = {
        user_name: name,
        deletion_date: formattedDate,
        support_email: "support@skillnestx.com",
        company_name: "SkillNestX",
      };

      await sendEmail({
        email,
        name,
        templateType: TEMPLATE_TYPES.ACCOUNT_DELETION,
        templateData,
        traceId,
      });

      emailStatus = {
        success: true,
        message: "Deletion confirmation email sent",
      };
    } catch (emailError) {
      logger.warn(
        `Delete account email failed for ${email}: ${emailError.message}`,
        {
          traceId,
          stack: emailError.stack,
        }
      );
      emailStatus = {
        success: false,
        message: "Failed to send deletion confirmation email",
      };
    }

    logger.info(`Account deleted for userId ${userId}`, { traceId });
    return res.status(200).json({
      success: true,
      message: "Account deleted successfully",
      emailStatus,
      traceId,
    });
  } catch (error) {
    logger.error(
      `Delete account error for userId ${req.user?.userId || "unknown"}: ${error.message}`,
      {
        traceId,
        stack: error.stack,
      }
    );
    return res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: "Internal server error",
      traceId,
    });
  }
};

export const requestPasswordReset = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || crypto.randomUUID();
  setSecurityHeaders(res);

  try {
    const { email } = req.body;
    if (!email?.trim()) {
      logger.warn("Password reset request failed: Email is required", { traceId });
      return res.status(400).json({
        success: false,
        code: "INVALID_INPUT",
        message: "Email is required",
        traceId,
      });
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!validator.isEmail(trimmedEmail)) {
      logger.warn(`Password reset request failed: Invalid email format: ${trimmedEmail}`, { traceId });
      return res.status(400).json({
        success: false,
        code: "INVALID_EMAIL",
        message: "Invalid email format",
        traceId,
      });
    }

    const user = await User.findOne({ email: trimmedEmail });
    if (!user) {
      logger.info(`Password reset requested for non-existent email: ${trimmedEmail}`, { traceId });
      return res.status(200).json({
        success: true,
        message: "If an account exists, a reset link has been sent",
        traceId,
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = await bcrypt.hash(resetToken, 10);
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour

    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = resetTokenExpiry;
    await user.save();

    const resetUrl = `${process.env.VITE_FRONTEND_URL || "https://skillnestx.com"}/reset-password/${resetToken}`;
    const expiryTime = "1 hour";

    try {
      await sendEmail({
        email: trimmedEmail,
        name: user.name,
        otp: resetToken,
        templateType: TEMPLATE_TYPES.PASSWORD_RESET,
        templateData: {
          reset_url: resetUrl,
          expiry_time: expiryTime,
          user_name: user.name,
          company_name: "SkillNestX",
          support_email: "support@skillnestx.com",
        },
        traceId,
      });

      logger.info(`Password reset email sent to ${trimmedEmail}`, { traceId });
      return res.status(200).json({
        success: true,
        message: "If an account exists, a reset link has been sent",
        traceId,
      });
    } catch (emailError) {
      logger.error(`Failed to send password reset email to ${trimmedEmail}: ${emailError.message}`, {
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
  } catch (error) {
    logger.error(`Password reset request error: ${error.message}`, {
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

export const updateAvatar = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || crypto.randomUUID();
  setSecurityHeaders(res);

  try {
    const { userId, sessionToken } = req.user || {};
    if (!userId || !sessionToken) {
      logger.warn("Update avatar failed: Unauthorized or missing session token", { traceId });
      return res.status(401).json({
        success: false,
        code: "UNAUTHORIZED",
        message: "Authentication and valid session required",
        traceId,
      });
    }

    const user = await User.findOne({ _id: userId, sessionToken });
    if (!user) {
      logger.warn(`Update avatar failed for userId ${userId}: Invalid session or user not found`, { traceId });
      return res.status(401).json({
        success: false,
        code: "INVALID_SESSION",
        message: "Invalid or expired session",
        traceId,
      });
    }

    const { profilePicture } = req.body;
    if (!profilePicture?.trim()) {
      return res.status(400).json({
        success: false,
        code: "INVALID_INPUT",
        message: "Profile picture URL or path is required",
        traceId,
      });
    }

    // Sanitize the profilePicture input
    const sanitizedInput = sanitizeHtml(profilePicture.trim(), { allowedTags: [] });

    // Define allowed avatars
    const allowedAvatars = [
      'boy-1.svg', 'boy-2.svg', 'boy-3.svg',
      'girl-1.svg', 'girl-2.svg', 'girl-3.svg'
    ];

    let finalAvatarPath = '';

    // Handle different input formats
    if (validator.isURL(sanitizedInput, { protocols: ['http', 'https'], require_protocol: true })) {
      // Input is a full URL
      try {
        const url = new URL(sanitizedInput);
        const filename = url.pathname.split('/').pop();
        if (!allowedAvatars.includes(filename)) {
          logger.warn(`Invalid avatar filename in URL: ${filename}`, { traceId });
          return res.status(400).json({
            success: false,
            code: "INVALID_AVATAR",
            message: "Invalid avatar selection",
            traceId,
          });
        }
        finalAvatarPath = `/assets/avatars/${filename}`;
      } catch (error) {
        logger.warn(`Invalid avatar URL: ${sanitizedInput}`, { traceId, error: error.message });
        return res.status(400).json({
          success: false,
          code: "INVALID_URL",
          message: "Invalid avatar URL format",
          traceId,
        });
      }
    } else if (sanitizedInput.startsWith('/assets/avatars/')) {
      // Input is a relative path
      const filename = sanitizedInput.split('/').pop();
      if (!allowedAvatars.includes(filename)) {
        logger.warn(`Invalid avatar filename in path: ${filename}`, { traceId });
        return res.status(400).json({
          success: false,
          code: "INVALID_AVATAR",
          message: "Invalid avatar selection",
          traceId,
        });
      }
      finalAvatarPath = sanitizedInput;
    } else if (allowedAvatars.includes(sanitizedInput)) {
      // Input is just a filename
      finalAvatarPath = `/assets/avatars/${sanitizedInput}`;
    } else {
      logger.warn(`Invalid avatar input: ${sanitizedInput}`, { traceId });
      return res.status(400).json({
        success: false,
        code: "INVALID_AVATAR",
        message: "Invalid avatar selection",
        traceId,
      });
    }

    // Update user's profile picture
    user.profilePicture = finalAvatarPath;
    await user.save();

    let emailStatus = { success: true, message: "No email sent" };
    try {
      await sendEmail({
        email: user.email,
        name: user.name,
        templateType: TEMPLATE_TYPES.PROFILE_UPDATE,
        templateData: {
          changed_fields: "profile picture",
          has_have: "has",
          email_changed: "",
          support_email: "support@skillnestx.com",
          company_name: "SkillNestX",
        },
        traceId,
      });
      emailStatus = {
        success: true,
        message: "Update confirmation email sent",
      };
    } catch (emailError) {
      logger.warn(
        `Avatar update email failed for ${user.email}: ${emailError.message}`,
        { traceId, stack: emailError.stack }
      );
      emailStatus = {
        success: false,
        message: "Failed to send update confirmation email",
      };
    }

    logger.info(`Avatar updated for userId ${userId}`, { traceId });
    return res.status(200).json({
      success: true,
      message: "Avatar updated successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        mobileNumber: user.mobileNumber,
        profilePicture: user.profilePicture,
        bio: user.bio,
        isVerified: user.isVerified,
        role: user.role,
      },
      emailStatus,
      traceId,
    });
  } catch (error) {
    logger.error(
      `Update avatar error for userId ${req.user?.userId || "unknown"}: ${error.message}`,
      { traceId, stack: error.stack }
    );
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: error.message.includes("validation")
        ? error.message
        : "Invalid profile picture URL or path",
      traceId,
    });
  }
};