import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import passport from "passport";
import mongoose from "mongoose";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import config from "./config.js";
import { logger } from "./utils/logger.js";
import { connectDB } from "./config/connectDB.js";
import { startCronJobs } from "./utils/cronJobs.js";
import { initializePassport } from "./config/passport.js";
import courseListRoutes from "./routes/courseListRoutes.js";
import courseRoutes from "./routes/courseRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import userProgressRoutes from "./routes/userProgressRoutes.js";
import testimonialRoutes from "./routes/testimonialRoutes.js";
import certificateRoutes from "./routes/certificateRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import transactionRoutes from "./routes/transactionRoutes.js";
import savedCoursesRoutes from "./routes/savedCoursesRoutes.js"; // Added import

// Initialize Express app
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Enable trust proxy for production (e.g., behind AWS ELB, Nginx)
if (config.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Request logging middleware
app.use((req, res, next) => {
  const traceId = req.headers["x-trace-id"] || Date.now().toString(36);
  res.setHeader("X-Trace-Id", traceId);
  req.traceId = traceId;
  next();
});

// Validate environment variables
if (!config.VITE_FRONTEND_URL && config.NODE_ENV === "production") {
  const traceId = Date.now().toString(36);
  logger.error("VITE_FRONTEND_URL is not defined in production", { traceId });
  process.exit(1);
}

// CORS configuration
app.use((req, res, next) => {
  const allowedOrigins = [
    config.VITE_FRONTEND_URL,
    "http://localhost:5173",
    "http://localhost:3000",
    "https://skillnestx.com",
    "https://*.razorpay.com",
  ].filter(Boolean);

  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        logger.debug(`CORS allowed for origin: ${origin || "none"}`, {
          traceId: req.traceId,
        });
        callback(null, true);
      } else {
        logger.error(`CORS blocked for origin: ${origin}`, {
          traceId: req.traceId,
          allowedOrigins,
        });
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
      "x-refresh-token",
      "X-Razorpay-Signature",
    ],
    maxAge: 86400,
  })(req, res, next);
});

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          config.VITE_FRONTEND_URL,
          "https://accounts.google.com",
          "https://www.googleapis.com",
          "https://checkout.razorpay.com",
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        formAction: ["'self'", "https://accounts.google.com"],
        frameSrc: [
          "'self'",
          "https://accounts.google.com",
          "https://checkout.razorpay.com",
        ],
        reportUri: "/csp-violation-report",
      },
      reportOnly: config.NODE_ENV !== "production",
    },
    crossOriginEmbedderPolicy: { policy: "require-corp" },
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    xContentTypeOptions: true,
  })
);

// CSP violation reporting endpoint
app.post("/csp-violation-report", express.json(), (req, res) => {
  const traceId = req.traceId || Date.now().toString(36);
  logger.warn("CSP violation reported", { traceId, body: req.body });
  res.status(204).send();
});

// Body parsing - General
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// Body parsing - Webhook-specific (larger limit and raw body)
app.use(
  "/api/razorpay-refund-webhook",
  express.raw({ type: "application/json", limit: "1mb" }),
  (req, res, next) => {
    if (req.body instanceof Buffer) {
      try {
        req.body = JSON.parse(req.body.toString());
      } catch (err) {
        const traceId = req.traceId || Date.now().toString(36);
        logger.error("Invalid webhook payload", {
          traceId,
          error: err.message,
        });
        return res.status(400).json({
          success: false,
          code: "INVALID_PAYLOAD",
          message: "Invalid webhook payload",
          traceId,
        });
      }
    }
    next();
  }
);

// Compression (exclude /health and /api/razorpay-refund-webhook)
app.use(
  compression({
    threshold: 1024,
    filter: (req, res) => {
      if (
        req.path === "/health" ||
        req.path === "/api/razorpay-refund-webhook" ||
        req.headers["x-no-compression"]
      )
        return false;
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
  const traceId = Date.now().toString(36);
  try {
    await fs.access(certificatesDir);
  } catch {
    await fs.mkdir(certificatesDir, { recursive: true });
   
  }
};
app.use(
  "/generated-certificates",
  express.static(certificatesDir, { maxAge: "1d" })
);

// API routes
const routes = [
  { path: "/api/auth", router: authRoutes },
  { path: "/api/users", router: userRoutes },
  { path: "/api/progress", router: userProgressRoutes },
  { path: "/api/courses", router: courseListRoutes },
  { path: "/api/admin/courses", router: courseRoutes },
  { path: "/api/subscriptions", router: subscriptionRoutes },
  { path: "/api/testimonials", router: testimonialRoutes },
  { path: "/api/certificates", router: certificateRoutes },
  { path: "/api/admin/dashboard", router: dashboardRoutes },
  { path: "/api/payment", router: paymentRoutes },
  { path: "/api/transactions", router: transactionRoutes },
  { path: "/api/saved-courses", router: savedCoursesRoutes }, // Added savedCoursesRoutes
];

// Validate and mount routes
const mountedPaths = new Set();
routes.forEach(({ path, router }) => {
  const traceId = Date.now().toString(36);
  try {
    if (mountedPaths.has(path)) {
      throw new Error(`Route path ${path} is already mounted`);
    }
    app.use(path, router);
    mountedPaths.add(path);
  } catch (err) {
    logger.error(`Failed to mount route: ${path}`, {
      traceId,
      error: err.message,
      stack: err.stack,
    });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  const traceId = req.traceId || Date.now().toString(36);
  const healthcheck = {
    success: true,
    status: mongoose.connection.readyState === 1 ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    database:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    traceId,
  };
  const status = healthcheck.status === "healthy" ? 200 : 503;
  res.status(status).json(healthcheck);
});

// Handle invalid methods (405)
app.use((req, res, next) => {
  const traceId = req.traceId || Date.now().toString(36);
  if (
    ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"].includes(req.method)
  ) {
    next();
  } else {
    res.status(405).json({
      success: false,
      code: "METHOD_NOT_ALLOWED",
      message: `Method ${req.method} not allowed`,
      traceId,
    });
  }
});

// Comprehensive 404 handler
app.use((req, res) => {
  const traceId = req.traceId || Date.now().toString(36);
  res.status(404).json({
    success: false,
    code: "NOT_FOUND",
    message: `Route ${req.method} ${req.originalUrl} not found`,
    traceId,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  const traceId = req.traceId || Date.now().toString(36);
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";
  let code = err.code || (statusCode === 404 ? "NOT_FOUND" : "SERVER_ERROR");
  let needsRefresh = false;

  // Handle specific errors
  if (
    err.message === "INVALID_GOOGLE_PROFILE" ||
    err.message === "EMAIL_PROVIDER_CONFLICT"
  ) {
    return res.redirect(
      `${config.VITE_FRONTEND_URL}/login?error=${encodeURIComponent(
        err.userFriendlyMessage || "Authentication failed"
      )}`
    );
  }

  if (err.name === "ValidationError") {
    statusCode = 400;
    code = "INVALID_INPUT";
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
  } else if (err.name === "MongoServerError" && err.code === 11000) {
    statusCode = 409;
    code = "DUPLICATE_KEY";
    const field = Object.keys(err.keyValue || {})[0] || "unknown";
    message = `Duplicate value for ${field}`;
  } else if (err.message === "Not allowed by CORS") {
    statusCode = 403;
    code = "CORS_ERROR";
    message = "Request from unauthorized origin";
  } else if (err.name === "CastError") {
    statusCode = 400;
    code = "INVALID_ID";
    message = "Invalid ID format";
  } else if (
    err.name === "JsonWebTokenError" ||
    err.name === "TokenExpiredError"
  ) {
    statusCode = 401;
    code = "UNAUTHORIZED";
    message =
      err.name === "TokenExpiredError" ? "Token expired" : "Invalid token";
    needsRefresh = true;
  }

  logger.error(`Error: ${message}`, {
    traceId,
    code,
    statusCode,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
  });

  res.status(statusCode).json({
    success: false,
    code,
    message:
      config.NODE_ENV === "development" ? message : "Internal server error",
    traceId,
    needsRefresh,
  });
});

// Start server
let server;

/**
 * Start the server, connect to database, and initialize cron jobs
 * @returns {Promise<void>}
 */
export const startServer = async () => {
  const traceId = Date.now().toString(36);
  try {
    await ensureCertificatesDir();
    await connectDB();
    await startCronJobs();
    server = app.listen(config.PORT, () => {
      logger.info(`Server running on port ${config.PORT}`, { traceId });
    });
    // Set server timeouts
    server.keepAliveTimeout = 60000; // 60 seconds
    server.headersTimeout = 65000; // 65 seconds
  } catch (err) {
    logger.error(`Failed to start server: ${err.message}`, {
      traceId,
      stack: err.stack,
    });
    process.exit(1);
  }
};

/**
 * Graceful shutdown handler
 * @returns {Promise<void>}
 */
export const shutdown = async () => {
  const traceId = Date.now().toString(36);
  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      if (mongoose.connection) {
        await mongoose.connection.close();
        logger.info("MongoDB connection closed", { traceId });
      }
    }
    logger.info("Server shut down gracefully", { traceId });
    process.exit(0);
  } catch (err) {
    logger.error(`Error during shutdown: ${err.message}`, {
      traceId,
      stack: err.stack,
    });
    process.exit(1);
  }
};

// Handle process termination
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Uncaught exception and unhandled rejection handlers
process.on("uncaughtException", (err) => {
  const traceId = Date.now().toString(36);
  logger.error(`Uncaught Exception: ${err.message}`, {
    traceId,
    stack: err.stack,
  });
  shutdown();
});

process.on("unhandledRejection", (reason, promise) => {
  const traceId = Date.now().toString(36);
  logger.error(`Unhandled Rejection at: ${promise}`, {
    traceId,
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  shutdown();
});

startServer();