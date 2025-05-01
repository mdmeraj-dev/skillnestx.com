import nodemailer from "nodemailer";
import { loadEmailTemplate } from "./loadEmailTemplate.js";
import logger from "./logger.js";
import validator from "validator";
import sanitizeHtml from "sanitize-html";
import crypto from "crypto";

export const TEMPLATE_TYPES = {
  SIGNUP: "signup-email",
  PASSWORD_RESET: "password-reset",
  EMAIL_VERIFICATION: "reset-email",
  WELCOME: "welcome-email",
  SUPPORT: "support-email",
  SUBSCRIPTION_EXPIRY: "subscription-expiry-reminder",
  SUBSCRIPTION_CONFIRMATION: "subscription-confirmation-email",
  PASSWORD_CHANGE_CONFIRMATION: "password-change-confirmation",
  COURSE_PURCHASE: "course-purchase-email",
  ACCOUNT_DELETION: "account-deletion",
  PROFILE_UPDATE: "profile-update",
};

// Validate SMTP configuration at startup
const requiredSmtpVars = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"];
const missingSmtpVars = requiredSmtpVars.filter(
  (varName) => !process.env[varName]
);
if (missingSmtpVars.length > 0) {
  logger.error(
    `Missing SMTP environment variables: ${missingSmtpVars.join(", ")}`
  );
  throw new Error("Server configuration error: Missing SMTP variables");
}

/**
 * Get email subject based on template type
 * @param {string} templateType - Type of email template
 * @returns {string} Email subject
 */
const getSubject = (templateType) => {
  const subjects = {
    [TEMPLATE_TYPES.SIGNUP]: "Verify Your Email Address",
    [TEMPLATE_TYPES.PASSWORD_RESET]: "Password Reset Request",
    [TEMPLATE_TYPES.EMAIL_VERIFICATION]: "Verify Your Email Address",
    [TEMPLATE_TYPES.WELCOME]: "Welcome to SkillNestX",
    [TEMPLATE_TYPES.SUPPORT]: "Your Support Ticket Update",
    [TEMPLATE_TYPES.SUBSCRIPTION_EXPIRY]: "Your Subscription is Expiring Soon",
    [TEMPLATE_TYPES.SUBSCRIPTION_CONFIRMATION]: "Subscription Confirmation",
    [TEMPLATE_TYPES.PASSWORD_CHANGE_CONFIRMATION]:
      "Your Password Has Been Updated",
    [TEMPLATE_TYPES.COURSE_PURCHASE]: "Course Purchase Confirmation",
    [TEMPLATE_TYPES.ACCOUNT_DELETION]: "Your Account Has Been Deleted",
    [TEMPLATE_TYPES.PROFILE_UPDATE]: "Your Profile Has Been Updated",
  };
  return subjects[templateType] || "SkillNestX Notification";
};

/**
 * Send email using SMTP with retry logic
 * @param {Object} options - Email options
 * @param {string} options.email - Recipient email address
 * @param {string} options.name - Recipient name
 * @param {string} [options.otp] - OTP code (if required)
 * @param {string} options.templateType - Email template type
 * @param {Object} [options.templateData] - Additional template data
 * @param {string} [options.traceId] - Trace ID for logging
 * @returns {Promise<boolean>} True if email sent successfully
 * @throws {Error} If email sending fails
 */
export const sendEmail = async ({
  email,
  name,
  otp,
  templateType,
  templateData = {},
  traceId = crypto.randomUUID(),
}) => {
  // Input validation
  if (!email?.trim()) {
    logger.error("Email sending failed: Email is required", {
      traceId,
      email,
      name,
    });
    throw new Error("Email is required");
  }

  const trimmedEmail = email.trim().toLowerCase();
  let trimmedName = name?.trim() || "Google User";

  if (!validator.isEmail(trimmedEmail)) {
    logger.error(
      `Email sending failed: Invalid email format: ${trimmedEmail}`,
      { traceId }
    );
    throw new Error("Invalid email format");
  }
  
  if (trimmedName.length < 2) {
    logger.info(`Name too short, using default: Google User`, {
      traceId,
      name: trimmedName,
    });
    trimmedName = "Google User";
  }
  if (trimmedName.length > 50) {
    logger.info(`Name too long, truncating to 50 chars`, {
      traceId,
      name: trimmedName,
    });
    trimmedName = trimmedName.slice(0, 50);
  }

  if (!Object.values(TEMPLATE_TYPES).includes(templateType)) {
    logger.error(
      `Email sending failed: Invalid template type: ${templateType}`,
      { traceId }
    );
    throw new Error(`Invalid template type: ${templateType}`);
  }

  const otpRequiredTemplates = [
    TEMPLATE_TYPES.SIGNUP,
    TEMPLATE_TYPES.PASSWORD_RESET,
    TEMPLATE_TYPES.EMAIL_VERIFICATION,
  ];
  if (
    otpRequiredTemplates.includes(templateType) &&
    (!otp || otp.toString().trim() === "")
  ) {
    logger.error(`Email sending failed: OTP required for ${templateType}`, {
      traceId,
    });
    throw new Error(`OTP is required for ${templateType}`);
  }

  // Sanitize template data
  const sanitizedTemplateData = {};
  Object.entries(templateData).forEach(([key, value]) => {
    sanitizedTemplateData[key] =
      typeof value === "string"
        ? sanitizeHtml(value.trim(), { allowedTags: [] })
        : value;
  });

  // Validate login_url
  if (
    [
      TEMPLATE_TYPES.WELCOME,
      TEMPLATE_TYPES.PASSWORD_CHANGE_CONFIRMATION,
    ].includes(templateType) &&
    sanitizedTemplateData.login_url &&
    !validator.isURL(sanitizedTemplateData.login_url, {
      protocols: ["http", "https"],
      require_protocol: true,
    })
  ) {
    logger.info(`Invalid login_url, using default`, {
      traceId,
      login_url: sanitizedTemplateData.login_url,
    });
    sanitizedTemplateData.login_url =
      process.env.VITE_FRONTEND_URL || "https://skillnestx.com/login";
  }

  // Validate reset_url for PASSWORD_RESET
  if (templateType === TEMPLATE_TYPES.PASSWORD_RESET) {
    if (!sanitizedTemplateData.reset_url) {
      logger.warn("Missing reset_url for PASSWORD_RESET email, using default", {
        traceId,
      });
      sanitizedTemplateData.reset_url = `${process.env.FRONTEND_URL || "https://skillnestx.com"}/reset-password/${sanitizedTemplateData.token || ""}`;
    } else if (
      !validator.isURL(sanitizedTemplateData.reset_url, {
        protocols: ["http", "https"],
        require_protocol: true,
      }) ||
      sanitizedTemplateData.reset_url.includes("localhost")
    ) {
      logger.warn(`Invalid or localhost reset_url, using default`, {
        traceId,
        reset_url: sanitizedTemplateData.reset_url,
      });
      sanitizedTemplateData.reset_url = `${process.env.VITE_FRONTEND_URL || "https://skillnestx.com"}/reset-password/${sanitizedTemplateData.token || ""}`;
    }
  }

  logger.info(`Preparing email`, {
    traceId,
    email: trimmedEmail,
    templateType,
  });

  // Load email template
  let template;
  try {
    template = await loadEmailTemplate(templateType, "html", traceId);
    logger.info(`Template loaded: ${templateType}`, { traceId });
  } catch (error) {
    logger.error(`Failed to load template ${templateType}: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    throw new Error(`Failed to load email template: ${error.message}`);
  }

  // Prepare template data
  const allTemplateData = {
    name: trimmedName,
    user_name: trimmedName,
    otp: otpRequiredTemplates.includes(templateType)
      ? otp?.toString().trim()
      : "",
    year: new Date().getFullYear().toString(),
    company_name: "SkillNestX",
    support_email: "support@skillnestx.com",
    deletion_date:
      templateType === TEMPLATE_TYPES.ACCOUNT_DELETION
        ? new Date().toLocaleString()
        : "",
    changed_fields:
      templateType === TEMPLATE_TYPES.PROFILE_UPDATE
        ? sanitizedTemplateData.changed_fields || ""
        : "",
    email_changed:
      templateType === TEMPLATE_TYPES.PROFILE_UPDATE
        ? sanitizedTemplateData.email_changed || ""
        : "",
    has_have:
      templateType === TEMPLATE_TYPES.PROFILE_UPDATE
        ? sanitizedTemplateData.has_have || ""
        : "",
    login_url: [
      TEMPLATE_TYPES.WELCOME,
      TEMPLATE_TYPES.PASSWORD_CHANGE_CONFIRMATION,
    ].includes(templateType)
      ? sanitizedTemplateData.login_url ||
        `${process.env.VITE_FRONTEND_URL || "https://skillnestx.com"}/login`
      : "",
    reset_url:
      templateType === TEMPLATE_TYPES.PASSWORD_RESET
        ? sanitizedTemplateData.reset_url || ""
        : "",
    ...sanitizedTemplateData,
  };

  logger.debug(`Template data prepared`, {
    traceId,
    templateKeys: Object.keys(allTemplateData),
  });

  // Render template
  let updatedTemplate = template;
  try {
    Object.entries(allTemplateData).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, "gi");
      updatedTemplate = updatedTemplate.replace(regex, value || "");
    });
    updatedTemplate = updatedTemplate.replace(/{{[^}]+}}/g, "");
  } catch (error) {
    logger.error(`Template rendering error: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    throw new Error(`Template rendering error: ${error.message}`);
  }

  // Configure SMTP transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: process.env.SMTP_PORT === "465",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
  });

  const mailOptions = {
    from: `"SkillNestX" <${process.env.SMTP_USER}>`,
    to: trimmedEmail,
    subject: getSubject(templateType),
    html: updatedTemplate,
  };

  // Send email with retry logic
  const maxRetries = 2;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const info = await transporter.sendMail(mailOptions);
      logger.info(`Email sent to ${trimmedEmail}`, {
        traceId,
        templateType,
        messageId: info.messageId,
      });
      return true;
    } catch (error) {
      logger.error(
        `Attempt ${attempt}/${maxRetries} failed to send email to ${trimmedEmail}`,
        {
          traceId,
          templateType,
          error: error.message,
          smtpResponse: error.response || "No response",
          stack: error.stack,
        }
      );
      if (attempt === maxRetries) {
        throw new Error(
          `Failed to send email after ${maxRetries} attempts: ${error.message}`
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
};
