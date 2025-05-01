import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import passport from "passport";
import connectDB from "./config/connectDB.js";
import { initializePassport } from "./config/passport.js";
import courseListRoutes from "./routes/courseListRoutes.js";
import courseRoutes from "./routes/courseRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import userProgressRoutes from "./routes/userProgressRoutes.js";
import testimonialRoutes from "./routes/testimonialRoutes.js";
import certificateRoutes from "./routes/certificateRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import fs from "fs/promises";
import logger from "./utils/logger.js";
import crypto from "crypto";

// Configure environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, `.env.${process.env.NODE_ENV || "production"}`),
});

// Validate NODE_ENV
if (!["production", "development", "test"].includes(process.env.NODE_ENV)) {
  logger.error(`Invalid NODE_ENV: ${process.env.NODE_ENV}. Must be 'production', 'development', or 'test'`);
  process.exit(1);
}

// Validate required environment variables
const requiredEnvVars = [
  "MONGO_URI",
  "PORT",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "SESSION_TOKEN_SECRET",
  "VITE_FRONTEND_URL",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_CALLBACK_URL",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
];
const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  logger.error(`Missing required environment variables: ${missingEnvVars.join(", ")}`);
  process.exit(1);
}

// Initialize Express app
const app = express();

// Request logging middleware
app.use((req, res, next) => {
  const traceId = req.headers["x-trace-id"] || crypto.randomUUID();
  res.setHeader("X-Trace-Id", traceId);
  req.traceId = traceId; // Attach traceId to req for use in routes
  logger.info(`Request: ${req.method} ${req.originalUrl}`, {
    traceId,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    sessionToken: req.headers["x-session-token"],
  });
  next();
});

// Global rate-limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    success: false,
    code: "TOO_MANY_REQUESTS",
    message: "Too many requests. Please try again later.",
    traceId: null,
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          process.env.VITE_FRONTEND_URL,
          "https://accounts.google.com",
          "https://www.googleapis.com",
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https://*"],
        connectSrc: [
          "'self'",
          process.env.VITE_FRONTEND_URL,
          process.env.VITE_BACKEND_URL || "https://api.skillnestx.com",
          "https://accounts.google.com",
          "https://www.googleapis.com",
        ],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        formAction: ["'self'", "https://accounts.google.com"],
        frameSrc: ["'self'", "https://accounts.google.com"],
        reportUri: "/csp-violation-report",
      },
      reportOnly: process.env.NODE_ENV !== "production",
    },
    crossOriginEmbedderPolicy: { policy: "require-corp" },
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
  })
);

// CSP violation reporting endpoint
app.post("/csp-violation-report", express.json(), (req, res) => {
  const traceId = req.traceId || crypto.randomUUID();
  logger.warn(`CSP violation reported`, { traceId, report: req.body });
  res.status(204).send();
});

// CORS configuration
const allowedOrigins = [
  process.env.VITE_FRONTEND_URL,
  "https://accounts.google.com",
  "https://skillnestx.com",
];
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        const traceId = req.traceId || crypto.randomUUID();
        logger.warn(`CORS blocked for origin: ${origin}`, { traceId });
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "X-Trace-Id",
      "X-Session-Token",
    ],
    maxAge: 86400,
  })
);

// Body parsing and cookies
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser(process.env.SESSION_TOKEN_SECRET, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
}));

// Compression
app.use(
  compression({
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) return false;
      return compression.filter(req, res);
    },
  })
);

// Initialize Passport
initializePassport();
app.use(passport.initialize());

// Static file serving - certificates
const certificatesDir = path.join(__dirname, "public/generated-certificates");
const ensureCertificatesDir = async () => {
  try {
    await fs.access(certificatesDir);
  } catch {
    await fs.mkdir(certificatesDir, { recursive: true });
    logger.info(`Created certificates directory: ${certificatesDir}`);
  }
};
app.use("/generated-certificates", express.static(certificatesDir, { maxAge: "1d" }));

// API routes
const routes = [
  { path: "/api/auth", router: authRoutes },
  { path: "/api/user", router: userRoutes },
  { path: "/api/progress", router: userProgressRoutes },
  { path: "/api/courses", router: courseListRoutes },
  { path: "/api/course", router: courseRoutes },
  { path: "/api/subscriptions", router: subscriptionRoutes },
  { path: "/api/payments", router: paymentRoutes },
  { path: "/api/testimonials", router: testimonialRoutes },
  { path: "/api/certificates", router: certificateRoutes },
];
routes.forEach(({ path, router }) => {
  app.use(path, router);
  logger.info(`Mounted route: ${path}`);
});

// Health check endpoint
app.get("/health", (req, res) => {
  const traceId = req.traceId || crypto.randomUUID();
  const healthcheck = {
    success: true,
    status: dbConnection?.readyState === 1 ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "production",
    database: dbConnection?.readyState === 1 ? "connected" : "disconnected",
    traceId,
  };
  const status = healthcheck.status === "healthy" ? 200 : 503;
  res.status(status).json(healthcheck);
});

// 404 handler for API routes
app.use("/api/*", (req, res) => {
  const traceId = req.traceId || crypto.randomUUID();
  res.status(404).json({
    success: false,
    code: "NOT_FOUND",
    message: "API endpoint not found",
    path: req.originalUrl,
    traceId,
  });
});

// 404 handler for non-API routes
app.use((req, res) => {
  const traceId = req.traceId || crypto.randomUUID();
  res.status(404).json({
    success: false,
    code: "NOT_FOUND",
    message: "Resource not found",
    path: req.originalUrl,
    traceId,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  const traceId = req.traceId || crypto.randomUUID();
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";
  let code = statusCode === 404 ? "NOT_FOUND" : "SERVER_ERROR";

  // Handle specific errors
  if (err.message === "INVALID_GOOGLE_PROFILE" || err.message === "EMAIL_PROVIDER_CONFLICT") {
    logger.warn(`Authentication error: ${err.message}`, { traceId });
    return res.redirect(
      `${process.env.VITE_FRONTEND_URL || "https://skillnestx.com"}/login?error=${encodeURIComponent(
        err.userFriendlyMessage || "Authentication failed"
      )}`
    );
  }

  if (err.name === "ValidationError") {
    statusCode = 400;
    code = "VALIDATION_FAILED";
    message = Object.values(err.errors).map((e) => e.message).join(", ");
  } else if (err.name === "MongoServerError" && err.code === 11000) {
    statusCode = 409;
    code = "DUPLICATE_KEY";
    message = "Duplicate key error";
  } else if (err.message === "Not allowed by CORS") {
    statusCode = 403;
    code = "CORS_ERROR";
    message = "Request from unauthorized origin";
  }

  logger.error(`Error: ${req.method} ${req.originalUrl}`, {
    traceId,
    statusCode,
    code,
    message,
    stack: err.stack,
  });

  res.status(statusCode).json({
    success: false,
    code,
    message: process.env.NODE_ENV === "development" ? message : "Internal server error",
    traceId,
  });
});

// Uncaught exception and unhandled rejection handlers
process.on("uncaughtException", (err) => {
  const traceId = crypto.randomUUID();
  logger.error(`Uncaught Exception: ${err.message}`, { traceId, stack: err.stack });
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  const traceId = crypto.randomUUID();
  logger.error(`Unhandled Rejection at: ${promise}`, {
    traceId,
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

// Start server
const PORT = process.env.PORT || 5000;
let dbConnection;
let server;

/**
 * Start the server and connect to database
 * @returns {Promise<void>}
 */
const startServer = async () => {
  try {
    await ensureCertificatesDir();
    dbConnection = await connectDB();
    server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`, {
        environment: process.env.NODE_ENV || "production",
        traceId: crypto.randomUUID(),
      });
    });
  } catch (err) {
    const traceId = crypto.randomUUID();
    logger.error(`Failed to start server: ${err.message}`, { traceId, stack: err.stack });
    process.exit(1);
  }
};

/**
 * Graceful shutdown handler
 */
const shutdown = async () => {
  const traceId = crypto.randomUUID();
  logger.info("Received shutdown signal. Closing server...", { traceId });
  try {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      if (dbConnection) {
        await dbConnection.close();
      }
      logger.info("Server and database connections closed", { traceId });
    }
    process.exit(0);
  } catch (err) {
    logger.error(`Error during shutdown: ${err.message}`, { traceId, stack: err.stack });
    process.exit(1);
  }
};

// Handle process termination
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

startServer();