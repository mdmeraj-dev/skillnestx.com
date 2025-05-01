import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import logger from "./logger.js";
import crypto from "crypto";
import sanitizeHtml from "sanitize-html";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const templateCache = new Map();
const VALID_EXTENSIONS = ["html", "txt"];

/**
 * Loads email template from /emailTemplates directory
 * @param {string} templateName - Template name without extension (e.g., 'account-deletion')
 * @param {string} [ext='html'] - File extension ('html' or 'txt')
 * @param {string} [traceId] - Trace ID for logging
 * @returns {Promise<string>} Raw template content
 * @throws {Error} If template loading fails or inputs are invalid
 */
export const loadEmailTemplate = async (templateName, ext = "html", traceId = crypto.randomUUID()) => {
  // Validate and sanitize inputs
  if (!templateName?.trim()) {
    logger.error("Template loading failed: Template name is required", { traceId });
    throw new Error("Template name is required");
  }

  const sanitizedTemplateName = sanitizeHtml(templateName.trim(), { allowedTags: [] });
  if (!/^[a-zA-Z0-9-_]+$/.test(sanitizedTemplateName)) {
    logger.error(`Template loading failed: Invalid template name: ${sanitizedTemplateName}`, { traceId });
    throw new Error("Invalid template name: Only alphanumeric characters, hyphens, and underscores allowed");
  }

  if (!VALID_EXTENSIONS.includes(ext)) {
    logger.error(`Template loading failed: Invalid extension: ${ext}`, {
      traceId,
      validExtensions: VALID_EXTENSIONS,
    });
    throw new Error(`Invalid template extension: ${ext}. Supported: ${VALID_EXTENSIONS.join(", ")}`);
  }

  const normalizedName = sanitizedTemplateName.replace(/\.(html|txt)$/, "");
  const fileName = `${normalizedName}.${ext}`;
  const cacheKey = `${normalizedName}.${ext}`;
  const templatesDir = path.join(__dirname, "../emailTemplates");
  const templatePath = path.join(templatesDir, fileName);

  // Check cache
  if (templateCache.has(cacheKey)) {
    logger.debug(`Serving template from cache: ${cacheKey}`, { traceId });
    return templateCache.get(cacheKey);
  }

  logger.info(`Loading template: ${fileName}`, { traceId, templatePath });

  // Validate directory access
  try {
    await fs.access(templatesDir, fs.constants.R_OK);
    logger.debug(`Templates directory accessible: ${templatesDir}`, { traceId });
  } catch (error) {
    logger.error(`Template loading failed: Directory not accessible: ${templatesDir}`, {
      traceId,
      stack: error.stack,
    });
    throw new Error(`Email templates directory not accessible: ${templatesDir}`);
  }

  // Validate file access
  try {
    await fs.access(templatePath, fs.constants.R_OK);
    logger.debug(`Template file accessible: ${templatePath}`, { traceId });
  } catch (error) {
    logger.error(`Template loading failed: File not found: ${templatePath}`, {
      traceId,
      stack: error.stack,
    });
    throw new Error(`Template file not found: ${templatePath}`);
  }

  // Read template file
  try {
    const content = await fs.readFile(templatePath, "utf8");
    if (!content.trim()) {
      logger.error(`Template loading failed: Empty template file: ${templatePath}`, { traceId });
      throw new Error(`Template file is empty: ${templatePath}`);
    }

    // Cache non-welcome templates
    if (normalizedName !== "welcome-email") {
      templateCache.set(cacheKey, content);
      logger.debug(`Cached template: ${cacheKey}`, { traceId });
    }

    logger.info(`Loaded ${ext} template: ${normalizedName}`, { traceId, templatePath });
    return content;
  } catch (error) {
    templateCache.delete(cacheKey);
    logger.error(`Failed to load ${ext} template: ${normalizedName}`, {
      traceId,
      error: error.message,
      templatePath,
      stack: error.stack,
    });
    throw new Error(`Failed to load ${ext} template '${normalizedName}': ${error.message}`);
  }
};