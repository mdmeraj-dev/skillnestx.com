import { sendEmail, TEMPLATE_TYPES } from "./sendEmail.js";
import { logger } from "../utils/logger.js";
import validator from "validator";

/**
 * Send password reset email
 * @param {Object} options - Email options
 * @param {string} options.email - Recipient email
 * @param {string} options.name - Recipient name
 * @param {string} options.resetUrl - Reset link URL
 * @param {string} [options.expiryTime] - Token expiry time (e.g., "10 minutes")
 * @param {string} [options.traceId] - Trace ID for logging
 * @returns {Promise<boolean>} - True if email sent successfully
 * @throws {Error} If email sending fails
 */
export const sendResetLink = async ({
  email,
  name,
  resetUrl,
  expiryTime = "10 minutes",
  traceId = Date.now().toString(36),
}) => {
  // Input validation
  if (!email?.trim()) {
    logger.error("Email sending failed: Email is required", { traceId });
    throw Object.assign(new Error("Email is required"), { code: "INVALID_EMAIL", traceId });
  }

  const trimmedEmail = email.trim().toLowerCase();
  if (!validator.isEmail(trimmedEmail)) {
    logger.error(`Email sending failed: Invalid email format: ${trimmedEmail}`, { traceId });
    throw Object.assign(new Error("Invalid email format"), { code: "INVALID_EMAIL", traceId });
  }

  const trimmedName = name?.trim().replace(/[<>&"']/g, "") || "User";
  const sanitizedResetUrl = resetUrl?.trim().replace(/[<>&"']/g, "");
  const sanitizedExpiryTime = expiryTime?.trim().replace(/[<>&"']/g, "") || "10 minutes";

  if (!sanitizedResetUrl) {
    logger.error("Email sending failed: Reset URL is required", { traceId });
    throw Object.assign(new Error("Reset URL is required"), { code: "INVALID_URL", traceId });
  }

  if (
    !validator.isURL(sanitizedResetUrl, { protocols: ["http", "https"], require_protocol: true }) ||
    (process.env.NODE_ENV === "production" && sanitizedResetUrl.includes("localhost"))
  ) {
    logger.error(`Invalid reset_url: ${sanitizedResetUrl}`, { traceId });
    throw Object.assign(new Error("Invalid reset URL"), { code: "INVALID_URL", traceId });
  }

  if (!sanitizedExpiryTime) {
    logger.warn(`Invalid expiry_time, using default: 10 minutes`, { traceId });
    throw Object.assign(new Error("Invalid expiry time"), { code: "INVALID_INPUT", traceId });
  }

  logger.info(`Preparing password reset email for ${trimmedEmail}`, { traceId });

  // Send email using sendEmail.js
  try {
    await sendEmail({
      email: trimmedEmail,
      name: trimmedName,
      templateType: TEMPLATE_TYPES.PASSWORD_RESET,
      templateData: {
        reset_url: sanitizedResetUrl,
        expiry_time: sanitizedExpiryTime,
      },
      traceId,
    });
    logger.info(`Password reset email sent to ${trimmedEmail}`, { traceId });
    return true;
  } catch (error) {
    logger.error(`Failed to send password reset email to ${trimmedEmail}: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    throw Object.assign(new Error(`Failed to send password reset email: ${error.message}`), {
      code: error.code || "EMAIL_SEND_ERROR",
      traceId,
    });
  }
};