import express from "express";
import {
  createSubscriptionTemplate,
  updateSubscriptionTemplate,
  deleteSubscriptionTemplate,
  getAllSubscriptionTemplates,
  getTotalSubscribers,
  getRecentSubscribers,
  activateSubscription,
  cancelSubscription,
  getAllUsers,
  searchSubscribers,
} from "../controllers/subscriptionController.js";
import {
  ensureAuthenticated,
  ensureAdmin,
  sendError,
} from "../middleware/authMiddleware.js";
import { logger } from "../utils/logger.js";
import { randomUUID } from "crypto";
import { query, body, param, validationResult } from "express-validator";

const router = express.Router();

// Input validation middleware
const validateQueryParams = (validations) => {
  return [
    ...validations,
    (req, res, next) => {
      const traceId = req.headers["x-trace-id"] || randomUUID();
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const errorMsg = errors
          .array()
          .map((err) => err.msg)
          .join(", ");
        logger.warn(`Validation error: ${errorMsg}`, {
          traceId,
          path: req.originalUrl,
        });
        return sendError(res, 400, "VALIDATION_ERROR", errorMsg, traceId);
      }
      next();
    },
  ];
};

// Handle CORS preflight requests
router.options("*", (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  logger.info("Handling CORS preflight request", {
    traceId,
    method: req.method,
    path: req.originalUrl,
  });
  res.status(204).end();
});

// Create a new subscription template (admin only)
// POST /api/subscriptions/admin/template
// Body: { name, type, newPrice, oldPrice, features, tag, duration }
router.post(
  "/admin/template",
  ensureAuthenticated,
  ensureAdmin,
  body("name")
    .isIn(["Basic Plan", "Pro Plan", "Premium Plan", "Team Plan", "Gift Plan"])
    .withMessage("Invalid subscription name"),
  body("type")
    .isIn(["Personal", "Team", "Gift"])
    .withMessage("Invalid subscription type"),
  body("newPrice")
    .isInt({ min: 0 })
    .withMessage("New price must be a non-negative integer"),
  body("oldPrice")
    .isInt({ min: 0 })
    .withMessage("Old price must be a non-negative integer"),
  body("features")
    .isArray({ min: 1 })
    .withMessage("Features must be a non-empty array"),
  body("features.*")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Each feature must be a non-empty string"),
  body("tag").optional().isString().trim().withMessage("Tag must be a string"),
  body("duration")
    .isIn([30, 180, 365])
    .withMessage("Duration must be 30, 180, or 365 days"),
  validateQueryParams([]),
  createSubscriptionTemplate
);

// Update an existing subscription template (admin only)
// PUT /api/subscriptions/admin/template/:id
// Body: { name, type, newPrice, oldPrice, features, tag, duration }
router.put(
  "/admin/template/:id",
  ensureAuthenticated,
  ensureAdmin,
  param("id").isMongoId().withMessage("Invalid subscription ID"),
  body("name")
    .isIn(["Basic Plan", "Pro Plan", "Premium Plan", "Team Plan", "Gift Plan"])
    .withMessage("Invalid subscription name"),
  body("type")
    .isIn(["Personal", "Team", "Gift"])
    .withMessage("Invalid subscription type"),
  body("newPrice")
    .isInt({ min: 0 })
    .withMessage("New price must be a non-negative integer"),
  body("oldPrice")
    .isInt({ min: 0 })
    .withMessage("Old price must be a non-negative integer"),
  body("features")
    .isArray({ min: 1 })
    .withMessage("Features must be a non-empty array"),
  body("features.*")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Each feature must be a non-empty string"),
  body("tag").optional().isString().trim().withMessage("Tag must be a string"),
  body("duration")
    .isIn([30, 180, 365])
    .withMessage("Duration must be 30, 180, or 365 days"),
  validateQueryParams([]),
  updateSubscriptionTemplate
);

// Delete a subscription template (admin only)
// DELETE /api/subscriptions/admin/template/:id
router.delete(
  "/admin/template/:id",
  ensureAuthenticated,
  ensureAdmin,
  param("id").isMongoId().withMessage("Invalid subscription ID"),
  validateQueryParams([]),
  deleteSubscriptionTemplate
);

// Get all subscription templates (admin or user)
// GET /api/subscriptions/templates
router.get("/templates", getAllSubscriptionTemplates);

// Get total subscribers for a specific year (admin only)
// GET /api/subscriptions/admin/subscribers/year?year=YYYY
router.get(
  "/admin/subscribers/year",
  ensureAuthenticated,
  ensureAdmin,
  query("year")
    .isInt({ min: 2000, max: new Date().getFullYear() })
    .withMessage("Year must be a valid integer between 2000 and current year"),
  validateQueryParams([]),
  getTotalSubscribers
);

// Get recent subscribers for a specific year and month (admin only)
// GET /api/subscriptions/admin/subscribers/month?year=YYYY&month=MM
router.get(
  "/admin/subscribers/month",
  ensureAuthenticated,
  ensureAdmin,
  query("year")
    .isInt({ min: 2000, max: new Date().getFullYear() })
    .withMessage("Year must be a valid integer between 2000 and current year"),
  query("month")
    .isInt({ min: 1, max: 12 })
    .withMessage("Month must be a valid integer between 1 and 12"),
  validateQueryParams([]),
  getRecentSubscribers
);

// Activate or renew a user subscription (admin only)
// POST /api/subscriptions/admin/subscription/activate
// Body: { userId, subscriptionId }
router.post(
  "/admin/subscription/activate",
  ensureAuthenticated,
  ensureAdmin,
  body("userId").isMongoId().withMessage("Invalid user ID"),
  body("subscriptionId").isMongoId().withMessage("Invalid subscription ID"),
  validateQueryParams([]),
  activateSubscription
);

// Cancel a user subscription (admin only)
// POST /api/subscriptions/admin/subscription/cancel
// Body: { userId, subscriptionId }
router.post(
  "/admin/subscription/cancel",
  ensureAuthenticated,
  ensureAdmin,
  body("userId").isMongoId().withMessage("Invalid user ID"),
  body("subscriptionId").isMongoId().withMessage("Invalid subscription ID"),
  validateQueryParams([]),
  cancelSubscription
);

// Get all users with subscription details (admin only)
// GET /api/subscriptions/admin/users
router.get(
  "/admin/users",
  ensureAuthenticated,
  ensureAdmin,
  validateQueryParams([]),
  getAllUsers
);

// Search subscribers by name or email (admin only)
// GET /api/subscriptions/admin/subscribers/search?query=SEARCH_TERM
router.get(
  "/admin/subscribers/search",
  ensureAuthenticated,
  ensureAdmin,
  query("query")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Search query must be a non-empty string"),
  validateQueryParams([]),
  searchSubscribers
);

// Alias for search subscribers to fix frontend typo (admin only)
// GET /api/subscriptions/admin/users/search?query=SEARCH_TERM
router.get(
  "/admin/users/search",
  ensureAuthenticated,
  ensureAdmin,
  query("query")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Search query must be a non-empty string"),
  validateQueryParams([]),
  searchSubscribers
);

// Error handling middleware
router.use((err, req, res, next) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  logger.error(`Error in subscription route: ${err.message}`, {
    traceId,
    method: req.method,
    path: req.originalUrl,
    stack: err.stack,
  });
  return sendError(
    res,
    500,
    "SERVER_ERROR",
    "An unexpected error occurred. Please try again later.",
    traceId
  );
});

export default router;