import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import validator from "validator";
import { logger } from "./utils/logger.js";

// Get the current directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine environment
const nodeEnv = process.env.NODE_ENV || "development";

// Load .env file only in development
if (nodeEnv !== "production") {
  const envFile = ".env.development";
  const paths = [
    path.resolve(__dirname, "..", envFile), // Project root: skillnestx/
    path.resolve(__dirname, envFile), // Backend directory: skillnestx/backend/
  ];

  let loaded = false;
  for (const envPath of paths) {
    if (fs.existsSync(envPath)) {
      const envConfig = dotenv.config({ path: envPath });
      if (!envConfig.error) {
        logger.info("Successfully loaded .env.development");
        loaded = true;
        break;
      }
    }
  }

  if (!loaded) {
    throw Object.assign(
      new Error(`Could not load ${envFile}. Ensure the file exists and is readable.`),
      { code: "ENV_FILE_NOT_FOUND" }
    );
  }
} else {
  logger.info("Production environment detected. Skipping .env file loading, assuming environment variables are set externally (e.g., Render dashboard).");
}

// Define environment variables
const envVars = {
  required: [
    "PORT",
    "MONGO_URI",
    "JWT_SECRET",
    "JWT_REFRESH_SECRET",
    "VITE_BACKEND_URL",
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASS",
  ],
  optional: new Map([
    ["CLIENT_URL", ""], // Will be mapped from VITE_FRONTEND_URL
    ["SUPPORT_EMAIL", "support@skillnestx.com"],
    ["COMPANY_NAME", "SkillNestX"],
    ["LOG_LEVEL", "info"],
  ]),
};

// Validate required environment variables
const missingEnvVars = envVars.required.filter((envVar) => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  throw Object.assign(
    new Error(`Missing required environment variables: ${missingEnvVars.join(", ")}`),
    { code: "MISSING_ENV_VAR" }
  );
}

// Map VITE_FRONTEND_URL to CLIENT_URL if CLIENT_URL is not set
const clientUrl = process.env.CLIENT_URL || process.env.VITE_FRONTEND_URL;
if (!clientUrl) {
  throw Object.assign(
    new Error("Missing CLIENT_URL or VITE_FRONTEND_URL"),
    { code: "MISSING_ENV_VAR" }
  );
}

// Validate variable formats
const validations = [
  {
    key: "PORT",
    value: process.env.PORT,
    test: (val) => validator.isPort(val),
    error: (val) => `Invalid PORT: ${val}`,
  },
  {
    key: "MONGO_URI",
    value: process.env.MONGO_URI,
    test: (val) => /^mongodb(\+srv)?:\/\/[^\s]+/.test(val),
    error: (val) => `Invalid MONGO_URI: ${val}`,
  },
  {
    key: "JWT_SECRET",
    value: process.env.JWT_SECRET,
    test: (val) => val.length >= 32,
    error: (val) => `JWT_SECRET must be at least 32 characters long`,
  },
  {
    key: "JWT_REFRESH_SECRET",
    value: process.env.JWT_REFRESH_SECRET,
    test: (val) => val.length >= 32,
    error: (val) => `JWT_REFRESH_SECRET must be at least 32 characters long`,
  },
  {
    key: "CLIENT_URL",
    value: clientUrl,
    test: (val) => {
      let isValidUrl;
      if (nodeEnv !== "production") {
        isValidUrl = /^https?:\/\/(localhost|127\.0\.0\.1|::1)(:\d{1,5})?(\/.*)?$/.test(val);
      } else {
        isValidUrl = validator.isURL(val, { protocols: ["http", "https"], require_protocol: true, allow_underscores: true });
      }
      const isLocalhostAllowed = nodeEnv !== "production" ? true : !val.includes("localhost");
      return isValidUrl && isLocalhostAllowed;
    },
    error: (val) => `Invalid CLIENT_URL${nodeEnv === "production" && val.includes("localhost") ? " (localhost not allowed in production)" : ""}: ${val}`,
  },
  {
    key: "VITE_BACKEND_URL",
    value: process.env.VITE_BACKEND_URL,
    test: (val) => {
      let isValidUrl;
      if (nodeEnv !== "production") {
        isValidUrl = /^https?:\/\/(localhost|127\.0\.0\.1|::1)(:\d{1,5})?(\/.*)?$/.test(val);
      } else {
        isValidUrl = validator.isURL(val, { protocols: ["http", "https"], require_protocol: true, allow_underscores: true });
      }
      const isLocalhostAllowed = nodeEnv !== "production" ? true : !val.includes("localhost");
      return isValidUrl && isLocalhostAllowed;
    },
    error: (val) => `Invalid VITE_BACKEND_URL${nodeEnv === "production" && val.includes("localhost") ? " (localhost not allowed in production)" : ""}: ${val}`,
  },
  {
    key: "RAZORPAY_KEY_SECRET",
    value: process.env.RAZORPAY_KEY_SECRET,
    test: (val) => val.length >= 20,
    error: (val) => `Invalid RAZORPAY_KEY_SECRET: ${val}`,
  },
  {
    key: "SMTP_PORT",
    value: process.env.SMTP_PORT,
    test: (val) => validator.isPort(val),
    error: (val) => `Invalid SMTP_PORT: ${val}`,
  },
  {
    key: "SMTP_USER",
    value: process.env.SMTP_USER,
    test: (val) => validator.isEmail(val),
    error: (val) => `Invalid SMTP_USER: ${val}`,
  },
  {
    key: "SUPPORT_EMAIL",
    value: process.env.SUPPORT_EMAIL || envVars.optional.get("SUPPORT_EMAIL"),
    test: (val) => validator.isEmail(val),
    error: (val) => `Invalid SUPPORT_EMAIL: ${val}`,
  },
  {
    key: "COMPANY_NAME",
    value: process.env.COMPANY_NAME || envVars.optional.get("COMPANY_NAME"),
    test: (val) => val.trim() && val.length <= 100,
    error: (val) => `Invalid COMPANY_NAME: ${val}`,
  },
  {
    key: "LOG_LEVEL",
    value: process.env.LOG_LEVEL || envVars.optional.get("LOG_LEVEL"),
    test: (val) => ["error", "warn", "info", "http", "debug"].includes(val),
    error: (val) => `Invalid LOG_LEVEL: ${val}`,
  },
];

for (const { key, value, test, error } of validations) {
  if (value && !test(value)) {
    if (nodeEnv !== "production" && ["CLIENT_URL", "VITE_BACKEND_URL"].includes(key)) {
      // Proceed in development with invalid URLs
    } else {
      throw Object.assign(new Error(error(value)), { code: "INVALID_ENV_VAR" });
    }
  }
}

// Export configuration object
export default {
  PORT: parseInt(process.env.PORT, 10) || 5000,
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  CLIENT_URL: clientUrl,
  VITE_BACKEND_URL: process.env.VITE_BACKEND_URL,
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: parseInt(process.env.SMTP_PORT, 10),
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || envVars.optional.get("SUPPORT_EMAIL"),
  COMPANY_NAME: process.env.COMPANY_NAME || envVars.optional.get("COMPANY_NAME"),
  LOG_LEVEL: process.env.LOG_LEVEL || envVars.optional.get("LOG_LEVEL"),
};