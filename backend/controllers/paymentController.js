import crypto from "crypto";
import config from "../config/config.js";
import razorpay from "../utils/razorpay.js"; // Import the singleton Razorpay instance
import logger from "../utils/logger.js"; // Import centralized logger

// Middleware to capture raw body for webhook verification
export const rawBodyMiddleware = (req, res, next) => {
  req.rawBody = "";
  req.on("data", (chunk) => {
    req.rawBody += chunk;
  });
  req.on("end", () => {
    next();
  });
};

// 1. Get all transactions with pagination
export const getAllTransactions = async (req, res) => {
  try {
    let { page = 1, limit = 10 } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);

    // Validate page and limit
    if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid page or limit values. Page must be >= 1, and limit must be between 1 and 100.",
      });
    }

    const skip = (page - 1) * limit;

    // Fetch transactions with pagination and populate user and course data
    const transactions = await Transaction.find({})
      .populate("user", "name email")
      .populate("course", "title")
      .sort({ transactionDate: -1 }) // Sort by latest first
      .skip(skip)
      .limit(limit)
      .lean(); // Use .lean() for faster read-only queries

    // Send response with pagination details
    res.status(200).json({
      success: true,
      total: await Transaction.countDocuments(),
      page,
      limit,
      transactions,
    });
  } catch (error) {
    logger.error(`Error fetching all transactions: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to fetch transactions. Please try again later.",
    });
  }
};

// 2. Process a refund via Razorpay
export const processRefund = async (req, res) => {
  const { transactionId } = req.params;

  try {
    const transaction = await Transaction.findOne({ transactionId });
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found.",
      });
    }

    // Ensure the transaction is eligible for refund
    if (transaction.paymentStatus !== "Success" || transaction.refunded) {
      return res.status(400).json({
        success: false,
        message: "Transaction is not eligible for refund.",
      });
    }

    // Call Razorpay's refund API
    const refund = await razorpay.payments.refund(transaction.paymentId, {
      amount: transaction.amount * 100, // Amount in paise
    });

    // Update transaction status to "Refund Initiated"
    transaction.refundStatus = "Initiated";
    await transaction.save();

    res.status(200).json({
      success: true,
      message: "Refund initiated successfully.",
      refund,
    });
  } catch (error) {
    logger.error(`Error processing refund: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to process refund.",
    });
  }
};

// 3. Create a Razorpay order
export const createRazorpayOrder = async (req, res) => {
  const { amount, currency, receipt, userId, courseId } = req.body;

  try {
    // Validate required fields
    if (!amount || !currency || !receipt || !userId || !courseId) {
      return res.status(400).json({
        success: false,
        message:
          "amount, currency, receipt, userId, and courseId are required.",
      });
    }

    // Validate amount
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be a positive number.",
      });
    }

    const options = {
      amount: amount * 100, // Razorpay expects amount in paise
      currency,
      receipt,
      payment_capture: 1,
      notes: {
        userId,
        courseId,
      },
    };

    const order = await razorpay.orders.create(options);
    res.status(201).json({
      success: true,
      data: order,
    });
  } catch (error) {
    logger.error(`Error creating Razorpay order: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to create Razorpay order.",
    });
  }
};

// 4. Verify Razorpay payment
export const verifyRazorpayPayment = async (req, res) => {
  const {
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_signature,
    userId,
    courseId,
  } = req.body;

  try {
    // Validate required fields
    if (
      !razorpay_payment_id ||
      !razorpay_order_id ||
      !razorpay_signature ||
      !userId ||
      !courseId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "razorpay_payment_id, razorpay_order_id, razorpay_signature, userId, and courseId are required.",
      });
    }

    // Verify the payment signature
    const generatedSignature = crypto
      .createHmac("sha256", config.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature === razorpay_signature) {
      // Fetch order details from Razorpay to get the amount
      const order = await razorpay.orders.fetch(razorpay_order_id);

      // Save transaction details in the database
      const transaction = new Transaction({
        transactionId: razorpay_payment_id,
        orderId: razorpay_order_id,
        paymentStatus: "Success",
        amount: order.amount / 100, // Convert back to INR from paise
        paymentMethod: req.body.paymentMethod || "Razorpay",
        user: userId,
        course: courseId,
      });

      await transaction.save();

      res.status(200).json({
        success: true,
        message: "Payment verified successfully.",
        transaction,
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Invalid signature.",
      });
    }
  } catch (error) {
    logger.error(`Error verifying payment: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to verify payment.",
    });
  }
};

// 5. Razorpay Webhook for payment status updates
export const razorpayWebhook = async (req, res) => {
  const rawBody = req.rawBody; // Use raw body for signature verification
  const signature = req.headers["x-razorpay-signature"];

  try {
    // Verify the webhook signature
    const generatedSignature = crypto
      .createHmac("sha256", config.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

    if (generatedSignature !== signature) {
      return res.status(400).json({
        success: false,
        message: "Invalid webhook signature.",
      });
    }

    const { event, payload } = JSON.parse(rawBody);

    // Handle payment success event
    if (event === "payment.captured") {
      const { payment } = payload;

      // Save transaction details in the database
      const transaction = new Transaction({
        transactionId: payment.entity.id,
        orderId: payment.entity.order_id,
        paymentStatus: "Success",
        amount: payment.entity.amount / 100, // Convert back to INR from paise
        paymentMethod: payment.entity.method,
        user: payment.entity.notes.userId, // Extract userId from notes
        course: payment.entity.notes.courseId, // Extract courseId from notes
      });

      await transaction.save();
    }

    // Handle payment failed event
    if (event === "payment.failed") {
      const { payment } = payload;

      // Save transaction details in the database
      const transaction = new Transaction({
        transactionId: payment.entity.id,
        orderId: payment.entity.order_id,
        paymentStatus: "Failed",
        amount: payment.entity.amount / 100, // Convert back to INR from paise
        paymentMethod: payment.entity.method,
        user: payment.entity.notes.userId, // Extract userId from notes
        course: payment.entity.notes.courseId, // Extract courseId from notes
      });

      await transaction.save();
    }

    // Handle refund processed event
    if (event === "refund.processed") {
      const { refund } = payload;

      // Find the transaction and update its refund status
      const transaction = await Transaction.findOne({
        transactionId: refund.payment_id,
      });
      if (transaction) {
        transaction.refunded = true;
        transaction.refundStatus = "Processed";
        await transaction.save();
      }
    }

    res.status(200).json({
      success: true,
      message: "Webhook processed successfully.",
    });
  } catch (error) {
    logger.error(`Error processing webhook: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to process webhook.",
    });
  }
};