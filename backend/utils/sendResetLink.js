import nodemailer from "nodemailer";
import { loadEmailTemplate } from "./loadEmailTemplate.js";

/**
 * Send password reset email
 * @param {Object} options - Email options
 * @param {string} options.email - Recipient email
 * @param {string} options.user_name - Recipient name
 * @param {string} options.reset_url - Reset link URL
 * @param {string} options.support_email - Support email address
 * @param {string} options.company_name - Company name
 * @param {string} options.expiry_time - Token expiry time (e.g., "10 minutes")
 * @param {string} options.traceId - Trace ID for logging
 * @returns {Promise<boolean>} - True if email sent successfully
 */
export const sendResetLink = async ({ email, user_name, reset_url, support_email, company_name, expiry_time, traceId }) => {
  try {
    // Input validation
    if (!email || !user_name || !reset_url) {
      throw new Error("Missing required fields: email, user_name, or reset_url");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error("Invalid email format");
    }

    // Load email template
    let template;
    try {
      template = await loadEmailTemplate("reset-password");
    } catch (error) {
      throw new Error(`Failed to load email template: ${error.message}`);
    }

    // Prepare template variables
    const templateData = {
      user_name: user_name.trim(),
      reset_url: reset_url,
      support_email: support_email || "support@skillnestx.com",
      company_name: company_name || "SkillNestX",
      expiry_time: expiry_time || "10 minutes",
      year: new Date().getFullYear().toString(),
    };

    // Replace placeholders in the template
    let updatedTemplate = template;
    Object.entries(templateData).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, "gi");
      updatedTemplate = updatedTemplate.replace(regex, value || "");
    });

    // Remove any unreplaced placeholders
    updatedTemplate = updatedTemplate.replace(/{{[^}]+}}/g, "");

    // Check email configuration
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      throw new Error("Email configuration missing: EMAIL_USER or EMAIL_PASSWORD not set");
    }

    // Configure email transport for Zoho Mail
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.zoho.in",
      port: process.env.SMTP_PORT || 587,
      secure: false, // Use TLS for port 587
      auth: {
        user: process.env.SMTP_USER || process.env.EMAIL_USER,
        pass: process.env.SMTP_PASS || process.env.EMAIL_PASSWORD,
      },
    });

    const mailOptions = {
      from: `"${templateData.company_name}" <${process.env.EMAIL_USER}>`,
      to: email.trim(),
      subject: "Password Reset Request",
      html: updatedTemplate,
    };
    
    // Send email
    const info = await transporter.sendMail(mailOptions);
  
    return true;
  } catch (error) {
    console.error("Send reset link error:", {
      message: error.message,
      stack: error.stack,
      email,
      traceId,
      env: {
        SMTP_HOST: process.env.SMTP_HOST,
        SMTP_PORT: process.env.SMTP_PORT,
        SMTP_USER: !!process.env.SMTP_USER,
        SMTP_PASS: !!process.env.SMTP_PASS,
        EMAIL_USER: !!process.env.EMAIL_USER,
        EMAIL_PASSWORD: !!process.env.EMAIL_PASSWORD,
      },
    });
    throw new Error(`Failed to send reset link: ${error.message}`);
  }
};