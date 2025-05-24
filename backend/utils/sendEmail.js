import nodemailer from "nodemailer";
import { loadEmailTemplate } from "./loadEmailTemplate.js";
import { logger } from "../utils/logger.js";
import validator from "validator";
import { formatDate } from "./dateUtils.js";
import config from "../config.js";

// Define email template types
export const TEMPLATE_TYPES = {
  SIGNUP: "signup-email",
  PASSWORD_RESET: "password-reset",
  WELCOME: "welcome-email",
  SUPPORT: "support-email",
  COURSE_PURCHASE_CONFIRMATION: "course-purchase-confirmation",
  SUBSCRIPTION_CONFIRMATION: "subscription-confirmation",
  SUBSCRIPTION_EXPIRY: "subscription-expiry-reminder",
  PASSWORD_CHANGE_CONFIRMATION: "password-change-confirmation",
  ACCOUNT_DELETION: "account-deletion",
  PROFILE_UPDATE: "profile-update",
  REFUND_PROCESSED: "refund-processed",
  REFUND_COMPLETED: "refund-completed",
};

// Email subjects
const EMAIL_SUBJECTS = {
  [TEMPLATE_TYPES.SIGNUP]: "Verify Your Email Address",
  [TEMPLATE_TYPES.PASSWORD_RESET]: "Password Reset Request",
  [TEMPLATE_TYPES.WELCOME]: "Welcome to SkillNestX",
  [TEMPLATE_TYPES.SUPPORT]: "Your Support Ticket Update",
  [TEMPLATE_TYPES.SUBSCRIPTION_EXPIRY]: "Your Subscription is Expiring Soon",
  [TEMPLATE_TYPES.SUBSCRIPTION_CONFIRMATION]: "Subscription Activation Confirmation",
  [TEMPLATE_TYPES.PASSWORD_CHANGE_CONFIRMATION]: "Your Password Has Been Updated",
  [TEMPLATE_TYPES.COURSE_PURCHASE_CONFIRMATION]: "Course Purchase Confirmation",
  [TEMPLATE_TYPES.ACCOUNT_DELETION]: "Your Account Has Been Deleted",
  [TEMPLATE_TYPES.PROFILE_UPDATE]: "Your Profile Has Been Updated",
  [TEMPLATE_TYPES.REFUND_PROCESSED]: "Your Refund is Being Processed",
  [TEMPLATE_TYPES.REFUND_COMPLETED]: "Your Refund Has Been Completed",
};

/**
 * Send email using SMTP with retry logic
 * @param {Object} options - Email options
 * @param {string} options.email - Recipient email address
 * @param {string} options.name - Recipient name
 * @param {string} [options.otp] - OTP code (for SIGNUP)
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

  const trimmedName = name?.trim() || "User";
  if (!trimmedName) {
    logger.warn(`Name is empty, using default: User`, { traceId });
  }

  if (!Object.values(TEMPLATE_TYPES).includes(templateType)) {
    logger.error(`Email sending failed: Invalid template type: ${templateType}`, { traceId });
    throw Object.assign(new Error(`Invalid template type: ${templateType}`), {
      code: "INVALID_TEMPLATE",
      traceId,
    });
  }

  if (templateType === TEMPLATE_TYPES.SIGNUP && (!otp || otp.toString().trim() === "")) {
    logger.error(`Email sending failed: OTP required for ${templateType}`, { traceId });
    throw Object.assign(new Error(`OTP is required for ${templateType}`), {
      code: "INVALID_OTP",
      traceId,
    });
  }

  // Validate course purchase confirmation template (used for course and cart purchases)
  if (templateType === TEMPLATE_TYPES.COURSE_PURCHASE_CONFIRMATION) {
    const requiredFields = {
      purchase_type: "Purchase type must be 'Course' or 'Cart'",
      purchase_item: "Purchase item is required",
      amount: "Amount is required",
      purchase_date: "Purchase date is required",
      duration: "Duration is required",
      transaction_id: "Transaction ID is required",
    };

    for (const [field, errorMsg] of Object.entries(requiredFields)) {
      if (!templateData[field] || (field === "purchase_item" && templateData[field].trim() === "")) {
        logger.error(`Email sending failed: ${errorMsg}`, { traceId, templateType, field });
        throw Object.assign(new Error(errorMsg), { code: `INVALID_${field.toUpperCase()}`, traceId });
      }
    }

    if (!["Course", "Cart"].includes(templateData.purchase_type)) {
      logger.error(`Email sending failed: Invalid purchase type: ${templateData.purchase_type}`, { traceId, templateType });
      throw Object.assign(new Error("Purchase type must be 'Course' or 'Cart'"), {
        code: "INVALID_PURCHASE_TYPE",
        traceId,
      });
    }
  }

  // Validate subscription confirmation template
  if (templateType === TEMPLATE_TYPES.SUBSCRIPTION_CONFIRMATION) {
    const requiredFields = {
      purchase_type: "Purchase type must be 'Subscription'",
      purchase_item: "Subscription name is required",
      amount: "Amount is required",
      purchase_date: "Purchase date is required",
      duration: "Duration is required",
      transaction_id: "Transaction ID is required",
    };

    for (const [field, errorMsg] of Object.entries(requiredFields)) {
      if (!templateData[field] || (field === "purchase_item" && templateData[field].trim() === "")) {
        logger.error(`Email sending failed: ${errorMsg}`, { traceId, templateType, field });
        throw Object.assign(new Error(errorMsg), { code: `INVALID_${field.toUpperCase()}`, traceId });
      }
    }

    if (templateData.purchase_type !== "Subscription") {
      logger.error(`Email sending failed: Invalid purchase type: ${templateData.purchase_type}`, { traceId, templateType });
      throw Object.assign(new Error("Purchase type must be 'Subscription'"), {
        code: "INVALID_PURCHASE_TYPE",
        traceId,
      });
    }
  }

  // Validate refund-related templates
  if ([TEMPLATE_TYPES.REFUND_PROCESSED, TEMPLATE_TYPES.REFUND_COMPLETED].includes(templateType)) {
    const requiredFields = {
      item_type: "Item type must be 'Course' or 'Subscription'",
      item_name: "Item name is required",
      amount: "Amount is required",
      refund_date: "Refund date is required",
    };

    for (const [field, errorMsg] of Object.entries(requiredFields)) {
      if (!templateData[field] || (field === "item_name" && templateData[field].trim() === "")) {
        logger.error(`Email sending failed: ${errorMsg}`, { traceId, templateType, field });
        throw Object.assign(new Error(errorMsg), { code: `INVALID_${field.toUpperCase()}`, traceId });
      }
    }

    if (!["Course", "Subscription"].includes(templateData.item_type)) {
      logger.error(`Email sending failed: Invalid item type: ${templateData.item_type}`, { traceId, templateType });
      throw Object.assign(new Error("Item type must be 'Course' or 'Subscription'"), {
        code: "INVALID_ITEM_TYPE",
        traceId,
      });
    }
  }

  // Sanitize and prepare template data
  const defaultTemplateData = {
    name: trimmedName,
    user_name: trimmedName,
    otp: templateType === TEMPLATE_TYPES.SIGNUP ? otp.toString().trim() : "",
    current_year: new Date().getFullYear().toString(),
    company_name: config.COMPANY_NAME,
    support_email: config.SUPPORT_EMAIL,
    frontend_url: config.CLIENT_URL,
    login_url: `${config.CLIENT_URL}/login`,
    redirect_url: `${config.CLIENT_URL}/support`,
    reset_url: templateType === TEMPLATE_TYPES.PASSWORD_RESET ? templateData.reset_url || "" : "",
    expiry_time: templateType === TEMPLATE_TYPES.PASSWORD_RESET ? templateData.expiry_time || "" : "",
    deletion_date: templateType === TEMPLATE_TYPES.ACCOUNT_DELETION ? formatDate(new Date()) : "",
    changed_fields: templateType === TEMPLATE_TYPES.PROFILE_UPDATE ? templateData.changed_fields || "" : "",
    email_changed: templateType === TEMPLATE_TYPES.PROFILE_UPDATE ? templateData.email_changed || "" : "",
    has_have: templateType === TEMPLATE_TYPES.PROFILE_UPDATE ? templateData.has_have || "" : "",
    action_date:
      [TEMPLATE_TYPES.ACCOUNT_BANNED, TEMPLATE_TYPES.ACCOUNT_UNBANNED].includes(templateType)
        ? formatDate(new Date(templateData.action_date || Date.now()))
        : "",
    // Use pre-formatted amount for purchase confirmations; format for refund templates
    amount:
      [TEMPLATE_TYPES.COURSE_PURCHASE_CONFIRMATION, TEMPLATE_TYPES.SUBSCRIPTION_CONFIRMATION].includes(templateType)
        ? templateData.amount || ""
        : [TEMPLATE_TYPES.REFUND_PROCESSED, TEMPLATE_TYPES.REFUND_COMPLETED].includes(templateType) && templateData.amount && templateData.currency
        ? `${templateData.currency === "INR" ? "₹" : templateData.currency} ${templateData.amount}`
        : "",
    refund_amount:
      [TEMPLATE_TYPES.REFUND_PROCESSED, TEMPLATE_TYPES.REFUND_COMPLETED].includes(templateType) && templateData.amount && templateData.currency
        ? `${templateData.currency === "INR" ? "₹" : templateData.currency} ${templateData.amount}`
        : "",
    request_date:
      templateType === TEMPLATE_TYPES.REFUND_PROCESSED ? templateData.refund_date || "" : "",
    completion_date:
      templateType === TEMPLATE_TYPES.REFUND_COMPLETED ? templateData.refund_date || "" : "",
  };

  const sanitizedTemplateData = {};
  Object.entries({ ...defaultTemplateData, ...templateData }).forEach(([key, value]) => {
    sanitizedTemplateData[key] =
      typeof value === "string" ? value.trim().replace(/[<>&"']/g, "") : value;
  });

  // Validate URLs in development
  const nodeEnv = process.env.NODE_ENV || "development";
  const validateUrl = (url, field) => {
    let isValid;
    if (nodeEnv !== "production") {
      isValid = /^https?:\/\/(localhost|127\.0\.0\.1|::1)(:\d{1,5})?(\/.*)?$/.test(url);
    } else {
      isValid = validator.isURL(url, { protocols: ["http", "https"], require_protocol: true });
    }
    if (!isValid) {
      logger.warn(`Invalid ${field} in development, using default: ${url}`, { traceId });
      return false;
    }
    return true;
  };

  if (sanitizedTemplateData.login_url && !validateUrl(sanitizedTemplateData.login_url, "login_url")) {
    sanitizedTemplateData.login_url = defaultTemplateData.login_url;
  }

  if (sanitizedTemplateData.redirect_url && !validateUrl(sanitizedTemplateData.redirect_url, "redirect_url")) {
    sanitizedTemplateData.redirect_url = defaultTemplateData.redirect_url;
  }

  if (templateType === TEMPLATE_TYPES.PASSWORD_RESET) {
    if (!sanitizedTemplateData.reset_url) {
      logger.error(`Email sending failed: reset_url required for ${templateType}`, { traceId });
      throw Object.assign(new Error(`reset_url is required for ${templateType}`), {
        code: "INVALID_RESET_URL",
        traceId,
      });
    }
    if (!validateUrl(sanitizedTemplateData.reset_url, "reset_url")) {
      logger.error(`Invalid reset_url: ${sanitizedTemplateData.reset_url}`, { traceId });
      throw Object.assign(new Error(`Invalid reset_url: ${sanitizedTemplateData.reset_url}`), {
        code: "INVALID_RESET_URL",
        traceId,
      });
    }
  }

  logger.info(`Preparing email for ${trimmedEmail}, template: ${templateType}`, { traceId });

  // Load email template
  let template;
  try {
    template = await loadEmailTemplate(templateType, "html", traceId);
    logger.info(`Template loaded: ${templateType}`, { traceId });
  } catch (error) {
    logger.error(`Failed to load template ${templateType}: ${error.message}`, { traceId, stack: error.stack });
    throw Object.assign(new Error(`Failed to load email template: ${error.message}`), {
      code: "TEMPLATE_ERROR",
      traceId,
    });
  }

  // Render template
  let updatedTemplate = template;
  try {
    Object.entries(sanitizedTemplateData).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, "gi");
      updatedTemplate = updatedTemplate.replace(regex, value || "");
    });
    updatedTemplate = updatedTemplate.replace(/{{[^}]+}}/g, "");
    logger.info(`Template rendered successfully: ${templateType}`, { traceId });
  } catch (error) {
    logger.error(`Template rendering error: ${error.message}`, { traceId, stack: error.stack });
    throw Object.assign(new Error(`Template rendering error: ${error.message}`), {
      code: "TEMPLATE_RENDER_ERROR",
      traceId,
    });
  }

  // Configure SMTP transporter
  const transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    auth: {
      user: config.SMTP_USER,
      pass: config.SMTP_PASS,
    },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
  });

  const mailOptions = {
    from: `"${config.COMPANY_NAME}" <${config.SMTP_USER}>`,
    to: trimmedEmail,
    subject: EMAIL_SUBJECTS[templateType] || "SkillNestX Notification",
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
        `Attempt ${attempt}/${maxRetries} failed to send email to ${trimmedEmail}: ${error.message}`,
        {
          traceId,
          templateType,
          errorCode: error.code || "UNKNOWN",
          smtpResponse: error.response || "No response",
          stack: error.stack,
          retryDelay: 1000 * attempt,
        }
      );
      if (attempt === maxRetries) {
        throw Object.assign(
          new Error(`Failed to send email after ${maxRetries} attempts: ${error.message}`),
          { code: "EMAIL_SEND_ERROR", traceId }
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
};