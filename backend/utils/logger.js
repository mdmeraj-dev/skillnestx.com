import winston from "winston";
import winstonDaily from "winston-daily-rotate-file";
import path from "path";
import fs from "fs/promises";

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log colors (for console output)
const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "blue",
};
winston.addColors(colors);

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
  winston.format((info) => {
    // Redact sensitive data (e.g., tokens)
    if (info.message && typeof info.message === "string") {
      info.message = info.message.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+/gi, "Bearer [REDACTED]");
    }
    return info;
  })()
);

// Filter for specific info logs in console
const consoleInfoFilter = winston.format((info) => {
  if (info.level === "info") {
    // Allow only the three specified logs
    if (
      info.message.includes("Successfully loaded .env.development") ||
      info.message.includes("Successfully connected to MongoDB") ||
      info.message.includes("Server running on port 5000")
    ) {
      return info;
    }
    return false; // Suppress other info logs
  }
  return false; // Suppress error, warn, debug, http
});

// Shared transport options
const transportOptions = {
  dirname: path.resolve("logs"),
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxSize: "20m",
  maxFiles: "14d",
  format: logFormat,
};

// Define log transports
const transports = [
  // Console transport
  new winston.transports.Console({
    level: "info", // Allow info, but filter to specific messages
    format: winston.format.combine(
      consoleInfoFilter(), // Apply filter for specific logs
      winston.format.colorize(),
      logFormat,
      winston.format.printf(
        (info) =>
          `${info.timestamp} ${info.level}: ${info.message}${
            info.stack ? `\n${info.stack}` : ""
          }`
      )
    ),
  }),

  // File transport for all logs
  new winstonDaily({
    ...transportOptions,
    level: process.env.NODE_ENV === "production" ? "warn" : "info",
    filename: "application-%DATE%.log",
  }),

  // File transport for error logs
  new winstonDaily({
    ...transportOptions,
    level: "error",
    dirname: path.resolve("logs", "errors"),
    filename: "error-%DATE%.log",
  }),
];

// Create logs directories silently
const ensureLogDirectories = async () => {
  const logDirs = [path.resolve("logs"), path.resolve("logs", "errors")];
  try {
    for (const dir of logDirs) {
      await fs.mkdir(dir, { recursive: true });
      await fs.chmod(dir, 0o750); // Owner: rwx, Group: rx, Others: none
    }
  } catch (error) {
    throw new Error(`Failed to create log directory: ${error.message}`);
  }
};

// Create the logger instance
export const logger = winston.createLogger({
  level: "info", // Process all logs, but console filter limits output
  levels,
  format: logFormat,
  transports,
  exitOnError: false,
  handleExceptions: true,
});

// Initialize log directories
ensureLogDirectories().catch((error) => {
  process.exit(1);
});

// Handle uncaught exceptions and unhandled rejections
process.on("uncaughtException", (error) => {
  const traceId = Date.now().toString(36);
  logger.error(`Uncaught Exception: ${error.message}`, {
    code: "UNCAUGHT_EXCEPTION",
    traceId,
    stack: error.stack,
  });
  if (process.env.NODE_ENV === "production") {
    process.exit(1);
  }
});

process.on("unhandledRejection", (reason, promise) => {
  const traceId = Date.now().toString(36);
  logger.error(`Unhandled Rejection at: ${promise}`, {
    code: "UNHANDLED_REJECTION",
    traceId,
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  if (process.env.NODE_ENV === "production") {
    process.exit(1);
  }
});