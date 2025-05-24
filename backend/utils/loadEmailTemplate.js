import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "../utils/logger.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const templateCache = new Map();
const VALID_EXTENSIONS = ["html", "txt"];
const MAX_CACHE_SIZE = 50; // Limit cache to 50 templates
const MAX_FILE_SIZE = 1024 * 1024; // 1MB max file size
const CACHE_EXCLUDED_TEMPLATES = ["welcome-email", "password-reset", "signup-email"];

/**
 * Loads email template from backend/emailTemplates directory
 * @param {string} templateName - Template name without extension (e.g., 'account-deletion')
 * @param {string} [ext='html'] - File extension ('html' or 'txt')
 * @param {string} [traceId] - Trace ID for logging
 * @returns {Promise<string>} Raw template content
 * @throws {Error} If template loading fails or inputs are invalid
 */
export const loadEmailTemplate = async (templateName, ext = "html", traceId = Date.now().toString(36)) => {
  // Validate inputs
  if (!templateName) {
    logger.error("Template loading failed: Template name is required", { traceId });
    throw Object.assign(new Error("Template name is required"), { code: "INVALID_TEMPLATE_NAME", traceId });
  }

  const sanitizedTemplateName = templateName.trim().replace(/[<>&"']/g, "");
  if (!/^[a-z0-9-_]+$/i.test(sanitizedTemplateName)) {
    logger.error(`Template loading failed: Invalid template name: ${sanitizedTemplateName}`, { traceId });
    throw Object.assign(
      new Error("Invalid template name: Only alphanumeric characters, hyphens, and underscores allowed"),
      { code: "INVALID_TEMPLATE_NAME", traceId }
    );
  }

  if (!VALID_EXTENSIONS.includes(ext)) {
    logger.error(`Template loading failed: Invalid extension: ${ext}`, {
      traceId,
      validExtensions: VALID_EXTENSIONS,
    });
    throw Object.assign(
      new Error(`Invalid template extension: ${ext}. Supported: ${VALID_EXTENSIONS.join(", ")}`),
      { code: "INVALID_EXTENSION", traceId }
    );
  }

  const normalizedName = sanitizedTemplateName.replace(/\.(html|txt)$/, "");
  const fileName = `${normalizedName}.${ext}`;
  const cacheKey = `${normalizedName}.${ext}`;
  const templatesDir = path.resolve(__dirname, "../emailTemplates");
  const templatePath = path.resolve(templatesDir, fileName);

  // Check cache
  if (templateCache.has(cacheKey)) {
    templateCache.set(cacheKey, templateCache.get(cacheKey)); // Move to end (LRU)
    logger.debug(`Serving template from cache: ${cacheKey}`, { traceId });
    return templateCache.get(cacheKey);
  }

  logger.info(`Loading template: ${fileName}`, { traceId, templatePath });

  // Validate directory
  try {
    const stats = await fs.stat(templatesDir);
    if (!stats.isDirectory()) {
      logger.error(`Template loading failed: Not a directory: ${templatesDir}`, { traceId });
      throw Object.assign(new Error(`Email templates path is not a directory: ${templatesDir}`), {
        code: "DIR_NOT_FOUND",
        traceId,
      });
    }
  } catch (error) {
    logger.error(`Template loading failed: Directory not found: ${templatesDir}`, {
      traceId,
      stack: error.stack,
    });
    throw Object.assign(new Error(`Email templates directory not found: ${templatesDir}`), {
      code: "DIR_NOT_FOUND",
      traceId,
    });
  }

  // Validate file
  try {
    const stats = await fs.stat(templatePath);
    if (!stats.isFile()) {
      logger.error(`Template loading failed: Not a file: ${templatePath}`, { traceId });
      throw Object.assign(new Error(`Template is not a file: ${templatePath}`), {
        code: "FILE_NOT_FOUND",
        traceId,
      });
    }
    if (stats.size > MAX_FILE_SIZE) {
      logger.error(`Template loading failed: File too large: ${templatePath}`, {
        traceId,
        size: stats.size,
      });
      throw Object.assign(new Error(`Template file too large: ${templatePath}`), {
        code: "FILE_TOO_LARGE",
        traceId,
      });
    }
  } catch (error) {
    logger.error(`Template loading failed: File not found: ${templatePath}`, {
      traceId,
      stack: error.stack,
    });
    throw Object.assign(new Error(`Template file not found: ${templatePath}`), {
      code: "FILE_NOT_FOUND",
      traceId,
    });
  }

  // Read template file
  try {
    const content = await fs.readFile(templatePath, "utf8");
    if (!content.trim()) {
      logger.error(`Template loading failed: Empty template file: ${templatePath}`, { traceId });
      throw Object.assign(new Error(`Template file is empty: ${templatePath}`), {
        code: "EMPTY_TEMPLATE",
        traceId,
      });
    }

    // Cache non-excluded templates
    if (!CACHE_EXCLUDED_TEMPLATES.includes(normalizedName)) {
      if (templateCache.size >= MAX_CACHE_SIZE) {
        const oldestKey = templateCache.keys().next().value;
        templateCache.delete(oldestKey);
        logger.debug(`Evicted oldest template from cache: ${oldestKey}`, { traceId });
      }
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
    throw Object.assign(new Error(`Failed to load ${ext} template '${normalizedName}': ${error.message}`), {
      code: "TEMPLATE_LOAD_ERROR",
      traceId,
    });
  }
};