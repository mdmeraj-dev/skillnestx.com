import express from "express";
import {
  revokeUserAccess,
  requestRefund,
  handleWebhook,
  getTotalTransactions,
  getRecentTransactions,
  getAllTransactions,
  searchTransaction,
  filterTransactions,
  getUserTransactions,
  getTransactionDetails,
} from "../controllers/transactionController.js";
import { ensureAuthenticated, ensureAdmin, sendError } from "../middleware/authMiddleware.js";
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
        const errorMsg = errors.array().map((err) => err.msg).join(", ");
        logger.warn(`Validation error: ${errorMsg}`, { traceId, path: req.originalUrl });
        return sendError(res, 400, "VALIDATION_ERROR", errorMsg, traceId);
      }
      next();
    },
  ];
};

// Get all transactions with pagination (admin only)
router.get(
  "/all",
  ensureAuthenticated,
  ensureAdmin,
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),
  validateQueryParams([]),
  getAllTransactions
);

// Get total transactions for a year (admin only)
router.get(
  "/total",
  ensureAuthenticated,
  ensureAdmin,
  query("year").optional().isInt({ min: 2000 }).withMessage("Year must be a valid integer"),
  validateQueryParams([]),
  getTotalTransactions
);

// Get recent transactions for a year and month (admin only)
router.get(
  "/recent",
  ensureAuthenticated,
  ensureAdmin,
  query("year").optional().isInt({ min: 2000 }).withMessage("Year must be a valid integer"),
  query("month").optional().isInt({ min: 1, max: 12 }).withMessage("Month must be between 1 and 12"),
  validateQueryParams([]),
  getRecentTransactions
);

// Search transactions (admin only)
router.get(
  "/search",
  ensureAuthenticated,
  ensureAdmin,
  query("query")
    .notEmpty()
    .isString()
    .trim()
    .isLength({ min: 3 })
    .withMessage("Search query must be at least 3 characters long")
    .matches(/^[a-zA-Z0-9._%+-@]+$/)
    .withMessage("Query must contain only alphanumeric characters, dots, underscores, hyphens, or @"),
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),
  validateQueryParams([]),
  searchTransaction
);

// Filter transactions by status (admin only)
router.get(
  "/filter",
  ensureAuthenticated,
  ensureAdmin,
  query("status")
    .isIn(["successful", "failed", "pending", "refunded"])
    .withMessage("Status must be successful, failed, pending, or refunded"),
  validateQueryParams([]),
  filterTransactions
);

// Get transaction details by paymentId (admin only)
router.get(
  "/details/:paymentId",
  ensureAuthenticated,
  ensureAdmin,
  param("paymentId")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Payment ID is required")
    .matches(/^pay_[A-Za-z0-9]+$/)
    .withMessage("Payment ID must start with 'pay_' followed by alphanumeric characters"),
  validateQueryParams([]),
  getTransactionDetails
);

// Request a refund (admin only)
router.post(
  "/refund/request",
  ensureAuthenticated,
  ensureAdmin,
  body("paymentId").isString().trim().notEmpty().withMessage("Payment ID is required"),
  validateQueryParams([]),
  requestRefund
);

// Handle Razorpay webhook events
router.post(
  "/razorpay-refund-webhook",
  body("event").isString().notEmpty().withMessage("Event is required"),
  body("payload").isObject().withMessage("Payload must be an object"),
  body("payload.refund.entity").optional().isObject().withMessage("Refund entity must be an object"),
  body("payload.refund.entity.payment_id")
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Refund payment ID must be a non-empty string"),
  body("payload.refund.entity.id")
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Refund ID must be a non-empty string"),
  body("payload.refund.entity.status")
    .optional()
    .isString()
    .withMessage("Refund status must be a string"),
  validateQueryParams([]),
  handleWebhook
);

// Revoke user access (admin only)
router.post(
  "/revoke",
  ensureAuthenticated,
  ensureAdmin,
  body("paymentId")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Payment ID is required")
    .matches(/^pay_[A-Za-z0-9]+$/)
    .withMessage("Payment ID must start with 'pay_' followed by alphanumeric characters"),
  validateQueryParams([]),
  revokeUserAccess
);

// Get user transactions (user access)
router.get(
  "/user",
  ensureAuthenticated,
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),
  query("status")
    .optional()
    .isIn(["successful", "failed", "pending", "refunded"])
    .withMessage("Status must be successful, failed, pending, or refunded"),
  validateQueryParams([]),
  getUserTransactions
);

export default router;