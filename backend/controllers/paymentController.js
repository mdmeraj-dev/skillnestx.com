import axios from "axios";
import asyncHandler from "express-async-handler";
import { randomUUID } from "crypto";
import crypto from "crypto";
import mongoose from "mongoose";
import { createTransactionAndGrantAccess } from "./transactionController.js";

// Fallback logger
const logger = console;

// Helper to send error responses
const sendError = (res, status, code, message, traceId) => {
  return res.status(status).json({
    success: false,
    code,
    message,
    traceId,
  });
};

// Initialize Razorpay (validate keys only)
const initializeRazorpay = () => {
  const traceId = randomUUID();
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    logger.error("Razorpay keys missing", { traceId });
    throw new Error("RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is missing");
  }

  return { key_id, key_secret };
};

// Create payment order
export const createOrder = asyncHandler(async (req, res) => {
  const traceId = req.headers?.["x-trace-id"] || randomUUID();
  const { amount, currency, purchaseType, courseId, subscriptionId, cartItems } = req.body;

  try {
    // Validate user
    if (!req.user?.userId) {
      return sendError(res, 401, "UNAUTHORIZED", "User authentication required", traceId);
    }

    // Validate inputs
    if (!amount || !currency || !purchaseType) {
      return sendError(res, 400, "INVALID_INPUT", "Amount, currency, and purchase type are required", traceId);
    }

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0 || !Number.isInteger(parsedAmount)) {
      return sendError(res, 400, "INVALID_AMOUNT", "Amount must be a positive integer in smallest currency unit (e.g., paise for INR)", traceId);
    }

    // Razorpay requires minimum 100 paise (1 INR) for INR
    if (currency === "INR" && parsedAmount < 100) {
      return sendError(res, 400, "INVALID_AMOUNT", "Amount must be at least 100 paise for INR", traceId);
    }

    if (!["INR", "USD"].includes(currency)) {
      return sendError(res, 400, "INVALID_CURRENCY", "Currency must be INR or USD", traceId);
    }

    if (!["course", "subscription", "cart"].includes(purchaseType)) {
      return sendError(res, 400, "INVALID_PURCHASE_TYPE", "Purchase type must be course, subscription, or cart", traceId);
    }

    if (purchaseType === "course" && (!courseId || !mongoose.Types.ObjectId.isValid(courseId))) {
      return sendError(res, 400, "MISSING_COURSE_ID", "Valid course ID required", traceId);
    }

    if (purchaseType === "subscription" && (!subscriptionId || !mongoose.Types.ObjectId.isValid(subscriptionId))) {
      return sendError(res, 400, "MISSING_SUBSCRIPTION_ID", "Valid subscription ID required", traceId);
    }

    if (purchaseType === "cart" && (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0)) {
      return sendError(res, 400, "INVALID_CART_ITEMS", "Cart items must be a non-empty array", traceId);
    }

    if (purchaseType === "cart") {
      const invalidItems = cartItems.some(
        (item) => !item.id || !mongoose.Types.ObjectId.isValid(item.id) || !item.price || isNaN(Number(item.price)) || !Number.isInteger(Number(item.price))
      );
      if (invalidItems) {
        return sendError(res, 400, "INVALID_CART_ITEMS", "All cart items must have valid IDs and integer prices in smallest currency unit", traceId);
      }
      // Verify total amount matches sum of cart item prices
      const cartTotal = cartItems.reduce((sum, item) => sum + Number(item.price), 0);
      if (cartTotal !== parsedAmount) {
        return sendError(res, 400, "AMOUNT_MISMATCH", `Cart total (${cartTotal}) does not match provided amount (${parsedAmount})`, traceId);
      }
    }

    // Get Razorpay keys
    const { key_id, key_secret } = initializeRazorpay();

    // Shorten receipt to 40 characters
    const receipt = `rcpt_${traceId.replace(/-/g, "").slice(0, 35)}`;

    const orderOptions = {
      amount: parsedAmount, // Amount in smallest unit (paise for INR)
      currency,
      receipt,
      notes: { userId: req.user.userId, purchaseType, courseId, subscriptionId, cartItems },
    };

    logger.info(`Creating Razorpay order: amount=${parsedAmount}, currency=${currency}`, { traceId, purchaseType });

    const response = await axios.post(
      "https://api.razorpay.com/v1/orders",
      orderOptions,
      {
        auth: {
          username: key_id,
          password: key_secret,
        },
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    const order = response.data;

    if (!order?.id) {
      logger.error("Invalid Razorpay response", { traceId });
      return sendError(res, 500, "ORDER_CREATION_FAILED", "Invalid Razorpay response", traceId);
    }

    logger.info(`Order created: ${order.id}`, { traceId, userId: req.user.userId, purchaseType, amount: order.amount });
    return res.status(200).json({
      success: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      traceId,
    });
  } catch (error) {
    const errorMessage = error.response?.data?.error?.description || error.message || "Unknown error";
    logger.error(`Failed to create order: ${errorMessage}`, { traceId, stack: error.stack });
    return sendError(res, 500, "ORDER_CREATION_FAILED", `Failed to create payment order: ${errorMessage}`, traceId);
  }
});

// Verify payment
export const verifyPayment = asyncHandler(async (req, res) => {
  const traceId = req.headers?.["x-trace-id"] || randomUUID();
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

  try {
    // Log incoming request body for debugging
    logger.info("Verify payment request body", {
      traceId,
      paymentId: razorpay_payment_id,
      purchaseType,
      cartItems,
      notesCartItems: notes?.cartItems,
    });

    // Validate inputs
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return sendError(res, 400, "INVALID_REQUEST", "Missing required payment details", traceId);
    }

    if (!purchaseType || !["course", "subscription", "cart"].includes(purchaseType)) {
      return sendError(res, 400, "INVALID_REQUEST", "Invalid or missing purchase type", traceId);
    }

    if (purchaseType === "course" && (!courseId || !mongoose.Types.ObjectId.isValid(courseId))) {
      return sendError(res, 400, "INVALID_REQUEST", "Valid course ID required", traceId);
    }

    if (purchaseType === "subscription" && (!subscriptionId || !mongoose.Types.ObjectId.isValid(subscriptionId))) {
      return sendError(res, 400, "INVALID_REQUEST", "Valid subscription ID required", traceId);
    }

    if (purchaseType === "cart") {
      // Use root-level cartItems if available; otherwise, fall back to notes.cartItems
      const effectiveCartItems = Array.isArray(cartItems) && cartItems.length > 0 ? cartItems : notes?.cartItems;
      if (!Array.isArray(effectiveCartItems) || effectiveCartItems.length === 0) {
        return sendError(res, 400, "INVALID_REQUEST", "Cart items must be a non-empty array", traceId);
      }
      const invalidItems = effectiveCartItems.some(
        (item) => !item.id || !mongoose.Types.ObjectId.isValid(item.id) || !item.price || isNaN(Number(item.price)) || !Number.isInteger(Number(item.price))
      );
      if (invalidItems) {
        return sendError(res, 400, "INVALID_REQUEST", "All cart items must have valid IDs and integer prices in smallest currency unit", traceId);
      }
    }

    const parsedAmount = Number(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0 || !Number.isInteger(parsedAmount)) {
      return sendError(res, 400, "INVALID_REQUEST", "Valid integer amount required in smallest currency unit", traceId);
    }

    if (!currency || !["INR", "USD"].includes(currency)) {
      return sendError(res, 400, "INVALID_REQUEST", "Currency must be INR or USD", traceId);
    }

    if (!req.user?.userId) {
      return sendError(res, 401, "UNAUTHORIZED", "User authentication required", traceId);
    }

    // Verify signature
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      logger.error("Invalid payment signature", { traceId, paymentId: razorpay_payment_id });
      return sendError(res, 400, "INVALID_SIGNATURE", "Invalid payment signature", traceId);
    }

    // Fetch order details from Razorpay to validate amount
    const { key_id, key_secret } = initializeRazorpay();
    let orderDetails;
    try {
      const response = await axios.get(
        `https://api.razorpay.com/v1/orders/${razorpay_order_id}`,
        {
          auth: {
            username: key_id,
            password: key_secret,
          },
        }
      );
      orderDetails = response.data;
    } catch (error) {
      logger.error(`Failed to fetch order details: ${error.message}`, { traceId, orderId: razorpay_order_id });
      return sendError(res, 500, "ORDER_VALIDATION_FAILED", "Failed to validate order details", traceId);
    }

    // Validate amount and currency
    if (orderDetails.amount !== parsedAmount) {
      logger.error(`Amount mismatch: expected ${orderDetails.amount}, received ${parsedAmount}`, {
        traceId,
        paymentId: razorpay_payment_id,
      });
      return sendError(res, 400, "AMOUNT_MISMATCH", `Amount mismatch: expected ${orderDetails.amount}, received ${parsedAmount}`, traceId);
    }

    if (orderDetails.currency !== currency) {
      logger.error(`Currency mismatch: expected ${orderDetails.currency}, received ${currency}`, {
        traceId,
        paymentId: razorpay_payment_id,
      });
      return sendError(res, 400, "CURRENCY_MISMATCH", `Currency mismatch: expected ${orderDetails.currency}, received ${currency}`, traceId);
    }

    // Validate cart items total (if applicable)
    if (purchaseType === "cart") {
      const effectiveCartItems = Array.isArray(cartItems) && cartItems.length > 0 ? cartItems : notes?.cartItems;
      const cartTotal = effectiveCartItems.reduce((sum, item) => sum + Number(item.price), 0);
      if (cartTotal !== parsedAmount) {
        logger.error(`Cart amount mismatch: cart total ${cartTotal}, received ${parsedAmount}`, {
          traceId,
          paymentId: razorpay_payment_id,
        });
        return sendError(res, 400, "AMOUNT_MISMATCH", `Cart amount mismatch: cart total ${cartTotal}, received ${parsedAmount}`, traceId);
      }
    }

    // Construct transaction payload
    const effectiveCartItems = purchaseType === "cart" ? (Array.isArray(cartItems) && cartItems.length > 0 ? cartItems : notes?.cartItems) : undefined;
    const transactionPayload = {
      userId: req.user.userId,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      razorpaySignature: razorpay_signature,
      amount: parsedAmount, // Amount is already in smallest unit
      currency,
      status: "successful",
      purchaseType,
      courseId: purchaseType === "course" ? courseId : undefined,
      subscriptionId: purchaseType === "subscription" ? subscriptionId : undefined,
      cartItems: effectiveCartItems, // Add root-level cartItems
      notes: {
        courseId: purchaseType === "course" ? courseId : undefined,
        subscriptionId: purchaseType === "subscription" ? subscriptionId : undefined,
        cartItems: effectiveCartItems, // Keep notes.cartItems for consistency
        userId: req.user.userId,
        email: notes?.email,
        phone: notes?.phone,
        duration: notes?.duration,
        courseNames: notes?.courseNames,
        originalPrice: notes?.originalPrice,
        amount: parsedAmount,
        currency,
      },
    };

    // Log transaction payload for debugging
    logger.info("Transaction payload", {
      traceId,
      paymentId: razorpay_payment_id,
      purchaseType,
      cartItems: transactionPayload.cartItems,
      notesCartItems: transactionPayload.notes.cartItems,
    });

    // Create transaction and grant access
    const transaction = await createTransactionAndGrantAccess(transactionPayload, traceId);

    logger.info(`Payment verified and transaction created: ${transaction._id}`, {
      traceId,
      userId: req.user.userId,
      purchaseType,
      amount: parsedAmount,
    });

    return res.status(200).json({
      success: true,
      message: "Transaction created and access granted",
      data: { transactionId: transaction._id },
      traceId,
    });
  } catch (error) {
    logger.error(`Payment verification failed: ${error.message}`, {
      traceId,
      paymentId: razorpay_payment_id,
      purchaseType,
      stack: error.stack,
    });
    return sendError(res, 500, "PAYMENT_VERIFICATION_FAILED", `Payment verification failed: ${error.message}`, traceId);
  }
});