import winston from "winston";
import winstonDaily from "winston-daily-rotate-file"; // For rotating log files
import path from "path";
import config from "../config/config.js"; // Import centralized config

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
const format = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), // Add timestamp
  winston.format.errors({ stack: true }), // Log full error stack traces
  winston.format.splat(), // Enable string interpolation
  winston.format.json() // Structured JSON logging
);

// Define log transports
const transports = [
  // Console transport (for development)
  new winston.transports.Console({
    level: config.NODE_ENV === "development" ? "debug" : "info", // Log level based on environment
    format: winston.format.combine(
      winston.format.colorize(), // Add colors to console output
      winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: ${info.message}`
      )
    ),
  }),

  // File transport for all logs
  new winstonDaily({
    level: "info",
    dirname: path.join("logs"), // Logs directory
    filename: "application-%DATE%.log", // Log file name
    datePattern: "YYYY-MM-DD", // Rotate logs daily
    zippedArchive: true, // Compress old logs
    maxSize: "20m", // Rotate logs after 20MB
    maxFiles: "30d", // Keep logs for 30 days
    format,
  }),

  // File transport for error logs
  new winstonDaily({
    level: "error",
    dirname: path.join("logs", "errors"), // Error logs directory
    filename: "error-%DATE%.log", // Error log file name
    datePattern: "YYYY-MM-DD", // Rotate logs daily
    zippedArchive: true, // Compress old logs
    maxSize: "20m", // Rotate logs after 20MB
    maxFiles: "30d", // Keep logs for 30 days
    format,
  }),
];

// Create the logger instance
const logger = winston.createLogger({
  level: config.LOG_LEVEL || "info", // Default log level
  levels,
  format,
  transports,
  exitOnError: false, // Do not exit on handled exceptions
});

// Handle uncaught exceptions and unhandled rejections
process.on("uncaughtException", (error) => {
  logger.error(`Uncaught Exception: ${error.message}`, error);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}`, reason);
});

export default logger;