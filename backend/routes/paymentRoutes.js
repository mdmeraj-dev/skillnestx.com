import express from "express";
import asyncHandler from "express-async-handler";
import { ensureAuthenticated } from "../middleware/authMiddleware.js";
import { createOrder, verifyPayment } from "../controllers/paymentController.js";
import mongoose from "mongoose";

// Fallback logger
const logger = console;

const router = express.Router();

// Middleware to log requests
const logRequest = (req, res, next) => {
  const traceId = req.headers?.["x-trace-id"] || require("crypto").randomUUID();
  req.traceId = traceId; // Attach traceId to request
  logger.info(`Incoming request: ${req.method} ${req.path}`, {
    traceId,
    userId: req.user?.userId,
    purchaseType: req.body?.purchaseType,
  });
  next();
};

// Middleware to validate create-order request body
const validateCreateOrder = (req, res, next) => {
  const { amount, currency, purchaseType, courseId, subscriptionId, cartItems } = req.body;
  const traceId = req.traceId;

  if (!amount || !currency || !purchaseType) {
    logger.error("Missing required fields for create-order", { traceId });
    return res.status(400).json({
      success: false,
      code: "INVALID_INPUT",
      message: "Amount, currency, and purchase type are required",
      traceId,
    });
  }

  if (isNaN(Number(amount)) || Number(amount) <= 0) {
    logger.error("Invalid amount for create-order", { traceId, amount });
    return res.status(400).json({
      success: false,
      code: "INVALID_AMOUNT",
      message: "Amount must be positive",
      traceId,
    });
  }

  if (!["INR", "USD"].includes(currency)) {
    logger.error("Invalid currency for create-order", { traceId, currency });
    return res.status(400).json({
      success: false,
      code: "INVALID_CURRENCY",
      message: "Currency must be INR or USD",
      traceId,
    });
  }

  if (!["course", "subscription", "cart"].includes(purchaseType)) {
    logger.error("Invalid purchase type for create-order", { traceId, purchaseType });
    return res.status(400).json({
      success: false,
      code: "INVALID_PURCHASE_TYPE",
      message: "Purchase type must be course, subscription, or cart",
      traceId,
    });
  }

  if (purchaseType === "course" && !courseId) {
    logger.error("Missing courseId for course purchase", { traceId });
    return res.status(400).json({
      success: false,
      code: "MISSING_COURSE_ID",
      message: "Course ID required",
      traceId,
    });
  }

  if (purchaseType === "subscription" && !subscriptionId) {
    logger.error("Missing subscriptionId for subscription purchase", { traceId });
    return res.status(400).json({
      success: false,
      code: "MISSING_SUBSCRIPTION_ID",
      message: "Subscription ID required",
      traceId,
    });
  }

  if (purchaseType === "cart" && (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0)) {
    logger.error("Invalid cart items for cart purchase", { traceId });
    return res.status(400).json({
      success: false,
      code: "INVALID_CART_ITEMS",
      message: "Cart items must be a non-empty array",
      traceId,
    });
  }

  next();
};

// Middleware to validate verify-payment request body
const validateVerifyPayment = (req, res, next) => {
  const {
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_signature,
    purchaseType,
    courseId,
    subscriptionId,
    cartItems,
    amount,
    currency,
    notes,
  } = req.body;
  const traceId = req.traceId;

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    logger.error("Missing payment details for verify-payment", { traceId });
    return res.status(400).json({
      success: false,
      code: "INVALID_REQUEST",
      message: "Missing required payment details",
      traceId,
    });
  }

  if (!purchaseType || !["course", "subscription", "cart"].includes(purchaseType)) {
    logger.error("Invalid purchase type for verify-payment", { traceId, purchaseType });
    return res.status(400).json({
      success: false,
      code: "INVALID_REQUEST",
      message: "Invalid or missing purchase type",
      traceId,
    });
  }

  if (purchaseType === "course" && !courseId) {
    logger.error("Missing courseId for course purchase", { traceId });
    return res.status(400).json({
      success: false,
      code: "INVALID_REQUEST",
      message: "Course ID required",
      traceId,
    });
  }

  if (purchaseType === "subscription" && !subscriptionId) {
    logger.error("Missing subscriptionId for subscription purchase", { traceId });
    return res.status(400).json({
      success: false,
      code: "INVALID_REQUEST",
      message: "Subscription ID required",
      traceId,
    });
  }

  if (purchaseType === "cart") {
    const effectiveCartItems = Array.isArray(cartItems) && cartItems.length > 0 ? cartItems : notes?.cartItems;
    if (!effectiveCartItems || !Array.isArray(effectiveCartItems) || effectiveCartItems.length === 0) {
      logger.error("Invalid cart items for cart purchase", { traceId });
      return res.status(400).json({
        success: false,
        code: "INVALID_REQUEST",
        message: "Cart items must be a non-empty array",
        traceId,
      });
    }

    // Validate each cart item
    for (let i = 0; i < effectiveCartItems.length; i++) {
      const item = effectiveCartItems[i];
      if (!item.id || typeof item.id !== "string" || !mongoose.Types.ObjectId.isValid(item.id)) {
        logger.error(`Invalid cart item ID at index ${i}`, { traceId, item });
        return res.status(400).json({
          success: false,
          code: "INVALID_CART_ITEM",
          message: `Cart item at index ${i} must have a valid ID`,
          traceId,
        });
      }
      if (!item.name || typeof item.name !== "string" || item.name.trim().length === 0) {
        logger.error(`Invalid cart item name at index ${i}`, { traceId, item });
        return res.status(400).json({
          success: false,
          code: "INVALID_CART_ITEM",
          message: `Cart item at index ${i} must have a non-empty name`,
          traceId,
        });
      }
      if (!item.price || isNaN(Number(item.price)) || Number(item.price) <= 0) {
        logger.error(`Invalid cart item price at index ${i}`, { traceId, item });
        return res.status(400).json({
          success: false,
          code: "INVALID_CART_ITEM",
          message: `Cart item at index ${i} must have a positive price`,
          traceId,
        });
      }
    }
  }

  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    logger.error("Invalid amount for verify-payment", { traceId, amount });
    return res.status(400).json({
      success: false,
      code: "INVALID_REQUEST",
      message: "Valid amount required",
      traceId,
    });
  }

  if (!currency || !["INR", "USD"].includes(currency)) {
    logger.error("Invalid currency for verify-payment", { traceId, currency });
    return res.status(400).json({
      success: false,
      code: "INVALID_REQUEST",
      message: "Currency must be INR or USD",
      traceId,
    });
  }

  next();
};

// Apply body size limit
router.use(express.json({ limit: "10kb" }));

/**
 * @route POST /api/payment/create-order
 * @desc Create a Razorpay order for course, subscription, or cart purchase
 * @access Private
 */
router.post(
  "/create-order",
  ensureAuthenticated,
  logRequest,
  validateCreateOrder,
  asyncHandler(createOrder)
);

/**
 * @route POST /api/payment/verify-payment
 * @desc Verify Razorpay payment and store transaction
 * @access Private
 */
router.post(
  "/verify-payment",
  ensureAuthenticated,
  logRequest,
  validateVerifyPayment,
  asyncHandler(verifyPayment)
);

export default router;