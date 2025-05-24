import { randomUUID } from "crypto";
import mongoose from "mongoose";
import { Transaction } from "../models/Transaction.js";
import User from "../models/User.js";
import Course from "../models/Course.js";
import Subscription from "../models/Subscription.js";
import axios from "axios";
import { sendEmail, TEMPLATE_TYPES } from "../utils/sendEmail.js";
import { formatDate } from "../utils/dateUtils.js";

// Fallback logger
const logger = console;

// Utility to set security headers
const setSecurityHeaders = (res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
};

// Utility for admin check
const ensureAdmin = async (req, res, traceId) => {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({
      success: false,
      code: "UNAUTHORIZED",
      message: "Admin access required",
      traceId,
    });
    return false;
  }
  return true;
};

// Create transaction and grant user access after payment verification
export const createTransactionAndGrantAccess = async (payload, traceId = randomUUID()) => {
  logger.info("Creating transaction", {
    traceId,
    paymentId: payload.paymentId,
    purchaseType: payload.purchaseType,
  });

  try {
    const {
      userId,
      paymentId,
      orderId,
      razorpaySignature,
      amount,
      currency,
      status,
      purchaseType,
      courseId,
      subscriptionId,
      cartItems,
      notes,
    } = payload;

    // Log payload for debugging
    logger.info("Transaction payload", {
      traceId,
      cartItems,
      notesCartItems: notes?.cartItems,
    });

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Verify transaction doesn't exist
    const existingTransaction = await Transaction.findOne({ paymentId });
    if (existingTransaction) {
      throw new Error("Transaction already exists");
    }

    // Normalize notes.cartItems
    const normalizedNotes = {
      ...notes,
      cartItems: purchaseType === "cart" ? notes.cartItems || [] : [],
    };

    // Validate course or subscription and set purchaseItem and duration
    let purchaseItem = "";
    let duration = "Lifetime"; // Default for courses
    if (purchaseType === "course") {
      if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
        throw new Error("Valid course ID is required");
      }
      const course = await Course.findById(courseId);
      if (!course) {
        throw new Error("Course not found");
      }
      if (courseId.toString() !== normalizedNotes.courseId?.toString()) {
        throw new Error("Course ID in notes must match top-level courseId");
      }
      if (course.newPrice * 100 !== amount) {
        throw new Error(
          `Amount mismatch: expected ${course.newPrice * 100}, received ${amount}`
        );
      }
      purchaseItem = course.title || "Unknown Course";
      duration = normalizedNotes.duration || course.duration || "Lifetime";
    } else if (purchaseType === "subscription") {
      if (!subscriptionId || !mongoose.Types.ObjectId.isValid(subscriptionId)) {
        throw new Error("Valid subscription ID is required");
      }
      const subscription = await Subscription.findById(subscriptionId);
      if (!subscription) {
        throw new Error("Subscription not found");
      }
      if (subscriptionId.toString() !== normalizedNotes.subscriptionId?.toString()) {
        throw new Error("Subscription ID in notes must match top-level subscriptionId");
      }
      purchaseItem = subscription.name || "Unknown Subscription";
      duration = subscription.duration || normalizedNotes.duration || "1month";
    } else if (purchaseType === "cart") {
      if (
        !cartItems ||
        !Array.isArray(cartItems) ||
        cartItems.length === 0
      ) {
        throw new Error("Valid cart items array is required");
      }
      // Validate cartItems entries
      const invalidItems = cartItems.filter(
        (item) => !item.id || !mongoose.Types.ObjectId.isValid(item.id) || !item.price
      );
      if (invalidItems.length > 0) {
        logger.error("Invalid cart items", { traceId, invalidItems });
        throw new Error("All cart items must have valid ID and price");
      }
      // Convert string IDs to ObjectId
      const courseIds = cartItems.map((item) => new mongoose.Types.ObjectId(item.id));
      logger.info("Querying courses", { traceId, courseIds: courseIds.map(id => id.toString()) });
      const courses = await Course.find({ _id: { $in: courseIds } });
      // Temporary workaround: Log missing courses but proceed
      if (courses.length !== courseIds.length) {
        const foundIds = courses.map(course => course._id.toString());
        const missingIds = cartItems
          .filter(item => !foundIds.includes(item.id))
          .map(item => item.id);
        logger.warn("Courses not found, proceeding for debugging", { traceId, missingIds });
      }
      // Compare total price (in paise)
      const totalPrice = cartItems.reduce(
        (sum, item) => sum + Number(item.price),
        0
      );
      if (totalPrice !== amount) {
        throw new Error(
          `Amount mismatch: expected ${totalPrice}, received ${amount}`
        );
      }
      // Map course IDs to titles for purchaseItem
      const courseMap = new Map(courses.map(course => [course._id.toString(), course.title || "Unknown Course"]));
      purchaseItem = cartItems
        .map(item => courseMap.get(item.id) || item.name || "Unknown Course")
        .join(", ");
      duration = normalizedNotes.duration || "Lifetime";
    } else {
      throw new Error("Invalid purchase type");
    }

    // Normalize duration format
    let formattedDuration = duration;
    if (typeof duration !== "string") {
      logger.warn("Invalid duration type, falling back to notes.duration or default", {
        traceId,
        duration,
        type: typeof duration,
        notesDuration: normalizedNotes.duration
      });
      duration = normalizedNotes.duration || "1month";
    }
    const normalizedDuration = duration.toLowerCase();
    if (normalizedDuration === "1year") {
      formattedDuration = "1 Year";
    } else if (/^\d+$/.test(duration)) {
      formattedDuration = `${parseInt(duration, 10)} days`;
    } else if (normalizedDuration === "1month") {
      formattedDuration = "1 Month";
    } else if (normalizedDuration === "6months") {
      formattedDuration = "6 Months";
    } else {
      logger.warn("Unrecognized duration, defaulting to notes.duration or '1 Month'", {
        traceId,
        duration,
        normalizedDuration,
        notesDuration: normalizedNotes.duration
      });
      formattedDuration = normalizedNotes.duration || "1 Month";
    }

    // Create transaction
    const transaction = new Transaction({
      userId,
      paymentId,
      orderId,
      razorpaySignature,
      amount: amount / 100, // Store in rupees
      currency: currency || "INR",
      status: status || "successful",
      purchaseType,
      courseId,
      subscriptionId,
      cartItems: purchaseType === "cart" ? cartItems : [], // Use root cartItems
      notes: normalizedNotes,
    });
    await transaction.save();

    // Grant user access
    if (purchaseType === "course") {
      await user.grantUserAccess({
        courseId,
        courseName: normalizedNotes.productName,
        duration: normalizedNotes.duration,
        transactionId: transaction._id,
      });
    } else if (purchaseType === "subscription") {
      await user.grantUserAccess({
        subscriptionId,
        transactionId: transaction._id,
      });
    } else if (purchaseType === "cart") {
      for (const item of cartItems) {
        // Only grant access if course exists
        const course = await Course.findById(item.id);
        if (course) {
          await user.grantUserAccess({
            courseId: course._id,
            courseName: item.name,
            duration: normalizedNotes.duration,
            transactionId: transaction._id,
          });
        } else {
          logger.warn("Skipping access grant for missing course", { traceId, courseId: item.id });
        }
      }
    }

    // Send purchase confirmation email
    if (user.email) {
      try {
        const templateType = purchaseType === "subscription" 
          ? TEMPLATE_TYPES.SUBSCRIPTION_CONFIRMATION 
          : TEMPLATE_TYPES.COURSE_PURCHASE_CONFIRMATION;
        await sendEmail({
          email: user.email,
          name: user.firstName || user.email.split("@")[0],
          templateType,
          templateData: {
            purchase_type: purchaseType === "course" ? "Course" : purchaseType === "subscription" ? "Subscription" : "Cart",
            purchase_item: purchaseItem || "Unknown Item",
            amount: `${currency === "INR" ? "₹" : currency} ${(transaction.amount).toFixed(2)}`,
            purchase_date: formatDate(transaction.createdAt),
            duration: formattedDuration,
            transaction_id: transaction._id.toString(),
          },
          traceId,
        });
        logger.info("Purchase confirmation email sent", { traceId, paymentId, email: user.email });
      } catch (emailError) {
        logger.error("Failed to send purchase confirmation email", {
          traceId,
          error: emailError.message,
          stack: emailError.stack,
        });
      }
    }

    logger.info("Transaction created and access granted", {
      traceId,
      transactionId: transaction._id,
      userId,
      purchaseType,
    });
    return transaction;
  } catch (error) {
    logger.error(`Failed to create transaction: ${error.message}`, {
      traceId,
      paymentId: payload.paymentId,
      stack: error.stack,
    });
    throw new Error(`Failed to create transaction: ${error.message}`);
  }
};

// Revoke user access
export const revokeUserAccess = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  setSecurityHeaders(res);

  try {
    if (!(await ensureAdmin(req, res, traceId))) return;

    const { paymentId } = req.body;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        code: "INVALID_INPUT",
        message: "Payment ID is required",
        traceId,
      });
    }

    const transaction = await Transaction.findOne({ paymentId });
    if (!transaction) {
      return res.status(404).json({
        success: false,
        code: "TRANSACTION_NOT_FOUND",
        message: "Transaction not found",
        traceId,
      });
    }

    const user = await User.findById(transaction.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        code: "USER_NOT_FOUND",
        message: "User not found",
        traceId,
      });
    }

    if (transaction.purchaseType === "course") {
      user.purchasedCourses = user.purchasedCourses.filter(
        (course) => course.courseId.toString() !== transaction.courseId.toString()
      );
    } else if (transaction.purchaseType === "subscription") {
      user.activeSubscription = null;
    } else if (transaction.purchaseType === "cart") {
      const courseIds = transaction.notes.cartItems.map((item) => item.id.toString());
      user.purchasedCourses = user.purchasedCourses.filter(
        (course) => !courseIds.includes(course.courseId.toString())
      );
    }
    await user.save();

    logger.info("Access revoked", { traceId, paymentId, userId: transaction.userId });
    return res.status(200).json({
      success: true,
      message: "Access revoked successfully",
      traceId,
    });
  } catch (error) {
    logger.error(`Failed to revoke access: ${error.message}`, { traceId, stack: error.stack });
    return res.status(500).json({
      success: false,
      code: "DATABASE_ERROR",
      message: "Failed to revoke access",
      traceId,
    });
  }
};

// Process Razorpay refund
const processRefund = async (paymentId, amount, traceId) => {
  try {
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    if (!key_id || !key_secret) {
      logger.error("Razorpay keys missing", { traceId });
      throw new Error("Razorpay configuration missing");
    }

    // Verify payment status
    const paymentResponse = await axios.get(
      `https://api.razorpay.com/v1/payments/${paymentId}`,
      {
        auth: {
          username: key_id,
          password: key_secret,
        },
      }
    );

    const payment = paymentResponse.data;
    if (payment.status !== "captured") {
      logger.warn("Payment not in refundable state", {
        traceId,
        paymentId,
        paymentStatus: payment.status,
      });
      throw new Error(`Payment not refundable: status is ${payment.status}`);
    }

    if (payment.amount < amount) {
      logger.warn("Refund amount exceeds payment amount", {
        traceId,
        paymentId,
        paymentAmount: payment.amount,
        refundAmount: amount,
      });
      throw new Error(
        `Refund amount ${amount} exceeds payment amount ${payment.amount}`
      );
    }

    const response = await axios.post(
      `https://api.razorpay.com/v1/payments/${paymentId}/refund`,
      { amount }, // Amount in paise
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

    const { id, status } = response.data;
    let refundStatus;
    switch (status) {
      case "created":
      case "processed":
        refundStatus = "processed";
        break;
      case "failed":
        refundStatus = "failed";
        break;
      default:
        logger.warn("Unknown Razorpay refund status", { traceId, status });
        refundStatus = "processed"; // Default to processed for pending refunds
    }

    logger.info("Razorpay refund initiated", { traceId, paymentId, refundStatus, refundId: id });
    return { id, status: refundStatus };
  } catch (error) {
    const errorDetails = error.response?.data?.error || {
      code: "UNKNOWN",
      description: error.message,
    };
    logger.error("Razorpay refund failed", {
      traceId,
      paymentId,
      status: error.response?.status,
      errorCode: errorDetails.code,
      errorDescription: errorDetails.description,
      stack: error.stack,
    });
    throw new Error(
      `Razorpay refund failed: ${errorDetails.description} (Code: ${errorDetails.code})`
    );
  }
};

// Request a refund
export const requestRefund = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  setSecurityHeaders(res);

  try {
    if (!(await ensureAdmin(req, res, traceId))) return;

    const { paymentId } = req.body;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        code: "INVALID_INPUT",
        message: "Payment ID is required",
        traceId,
      });
    }

    const transaction = await Transaction.findOne({ paymentId })
      .populate("courseId", "title")
      .populate("subscriptionId", "name");
    if (!transaction) {
      return res.status(404).json({
        success: false,
        code: "TRANSACTION_NOT_FOUND",
        message: "Transaction not found",
        traceId,
      });
    }

    if (transaction.status !== "successful") {
      return res.status(400).json({
        success: false,
        code: "INVALID_STATUS",
        message: "Cannot refund non-successful transaction",
        traceId,
      });
    }

    if (transaction.refundStatus !== null) {
      return res.status(400).json({
        success: false,
        code: "REFUND_ALREADY_PROCESSED",
        message: `Refund already ${transaction.refundStatus}`,
        traceId,
      });
    }

    // Revoke user access
    const user = await User.findById(transaction.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        code: "USER_NOT_FOUND",
        message: "User not found",
        traceId,
      });
    }

    if (transaction.purchaseType === "course") {
      logger.info("Revoking course access", { traceId, paymentId, courseId: transaction.courseId });
      await user.revokeUserAccess({
        courseId: transaction.courseId,
        transactionId: transaction._id,
      });
    } else if (transaction.purchaseType === "subscription") {
      logger.info("Revoking subscription access", {
        traceId,
        paymentId,
        subscriptionId: transaction.subscriptionId,
        userActiveSubscription: user.activeSubscription,
      });
      await user.revokeUserAccess({
        subscriptionId: transaction.subscriptionId,
        transactionId: transaction._id,
      });
    } else if (transaction.purchaseType === "cart") {
      const courseIds = transaction.notes.cartItems.map((item) => item.id.toString());
      logger.info("Revoking cart access", { traceId, paymentId, courseIds });
      for (const courseId of courseIds) {
        await user.revokeUserAccess({
          courseId,
          transactionId: transaction._id,
        });
      }
    }

    // Initiate refund with Razorpay
    const refundResponse = await processRefund(paymentId, transaction.amount * 100, traceId);

    // Update transaction
    transaction.refundStatus = "processed";
    transaction.refundId = refundResponse.id;
    await transaction.save();

    // Send refund-processed email
    if (user.email) {
      let itemType = transaction.purchaseType === "course" ? "Course" : "Subscription";
      let itemName = transaction.courseId?.title || transaction.subscriptionId?.name || "N/A";
      if (transaction.purchaseType === "cart") {
        itemType = "Course";
        const courses = await Course.find({ _id: { $in: transaction.notes.cartItems.map(item => item.id) } });
        itemName = courses.map(course => course.title || course._id).join(", ");
      }
      try {
        await sendEmail({
          email: user.email,
          name: user.firstName || user.email.split("@")[0],
          templateType: TEMPLATE_TYPES.REFUND_PROCESSED,
          templateData: {
            item_type: itemType,
            item_name: itemName,
            amount: transaction.amount.toFixed(2),
            currency: transaction.currency,
            refund_date: formatDate(new Date()),
            transaction_id: transaction._id.toString(),
            refund_id: refundResponse.id,
          },
          traceId,
        });
        logger.info("Refund processed email sent", { traceId, paymentId, email: user.email });
      } catch (emailError) {
        logger.error("Failed to send refund processed email", {
          traceId,
          error: emailError.message,
          stack: emailError.stack,
        });
      }
    }

    logger.info("Refund initiated", {
      traceId,
      paymentId,
      refundStatus: "processed",
      refundId: refundResponse.id,
      userId: transaction.userId,
    });
    return res.status(200).json({
      success: true,
      message: "Refund initiated successfully",
      data: { refundStatus: "processed", refundId: refundResponse.id },
      traceId,
    });
  } catch (error) {
    logger.error(`Failed to initiate refund: ${error.message}`, {
      traceId,
      paymentId: req.body.paymentId || 'unknown',
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      code: "REFUND_ERROR",
      message: `Failed to initiate refund: ${error.message}`,
      traceId,
    });
  }
};

// Handle Razorpay webhook events
export const handleWebhook = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  setSecurityHeaders(res);

  try {
    const event = req.body.event;
    const payload = req.body.payload;
    logger.info("Webhook received", { traceId, event });

    if (!event || !payload) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PAYLOAD",
        message: "Invalid webhook payload",
        traceId,
      });
    }

    if (event.startsWith("refund.")) {
      const refund = payload.refund?.entity;
      const paymentId = refund?.payment_id;
      const refundStatus = refund?.status;
      const refundId = refund?.id;

      if (!paymentId || !refundId) {
        logger.warn("Invalid refund webhook data", { traceId, event });
        return res.status(400).json({
          success: false,
          code: "INVALID_DATA",
          message: "Missing payment ID or refund ID",
          traceId,
        });
      }

      const transaction = await Transaction.findOne({ paymentId })
        .populate("courseId", "title")
        .populate("subscriptionId", "name");
      if (!transaction) {
        logger.warn("Transaction not found for webhook", { traceId, paymentId });
        return res.status(404).json({
          success: false,
          code: "TRANSACTION_NOT_FOUND",
          message: "Transaction not found",
          traceId,
        });
      }

      let newStatus;
      switch (event) {
        case "refund.created":
        case "refund.processed":
          newStatus = "processed";
          break;
        case "refund.completed":
          newStatus = "refunded";
          break;
        case "refund.failed":
          newStatus = "failed";
          break;
        default:
          logger.warn("Unhandled refund event", { traceId, event });
          return res.status(200).json({ success: true, traceId });
      }

      if (transaction.refundStatus !== newStatus) {
        transaction.refundStatus = newStatus;
        if (newStatus === "refunded") {
          transaction.status = "refunded";
        }
        await transaction.save();

        // Send refund completed email
        if (newStatus === "refunded") {
          const user = await User.findById(transaction.userId);
          if (user && user.email) {
            let itemType = transaction.purchaseType === "course" ? "Course" : "Subscription";
            let itemName = transaction.courseId?.title || transaction.subscriptionId?.name || "N/A";
            if (transaction.purchaseType === "cart") {
              itemType = "Course";
              const courses = await Course.find({ _id: { $in: transaction.notes.cartItems.map(item => item.id) } });
              itemName = courses.map(course => course.title || course._id).join(", ");
            }
            try {
              await sendEmail({
                email: user.email,
                name: user.firstName || user.email.split("@")[0],
                templateType: TEMPLATE_TYPES.REFUND_COMPLETED,
                templateData: {
                  item_type: itemType,
                  item_name: itemName,
                  amount: transaction.amount.toFixed(2),
                  currency: transaction.currency,
                  refund_date: formatDate(new Date()),
                  transaction_id: transaction._id.toString(),
                  refund_id: refundId,
                },
                traceId,
              });
              logger.info("Refund completed email sent", { traceId, paymentId, email: user.email });
            } catch (emailError) {
              logger.error("Failed to send refund completed email", {
                traceId,
                error: emailError.message,
                stack: emailError.stack,
              });
            }
          }
        }
      }

      logger.info("Webhook processed", { traceId, event, paymentId, refundStatus: newStatus });
    }

    return res.status(200).json({ success: true, traceId });
  } catch (error) {
    logger.error(`Webhook processing failed: ${error.message}`, { traceId, stack: error.stack });
    return res.status(500).json({
      success: false,
      code: "WEBHOOK_ERROR",
      message: "Failed to process webhook",
      traceId,
    });
  }
};

// Get total transactions with monthly breakdown for a specific year
export const getTotalTransactions = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  setSecurityHeaders(res);

  try {
    if (!(await ensureAdmin(req, res, traceId))) return;

    const { year = new Date().getFullYear() } = req.query;
    const yearNumber = parseInt(year, 10);

    if (isNaN(yearNumber) || yearNumber < 2000 || yearNumber > new Date().getFullYear() + 1) {
      return res.status(400).json({
        success: false,
        code: "INVALID_INPUT",
        message: "Valid year (2000 or later) is required",
        traceId,
      });
    }

    const startOfYear = new Date(Date.UTC(yearNumber, 0, 1, 0, 0, 0, 0));
    const endOfYear = new Date(Date.UTC(yearNumber, 11, 31, 23, 59, 59, 999));

    const [total, monthlyData] = await Promise.all([
      Transaction.countDocuments({
        createdAt: { $gte: startOfYear, $lte: endOfYear },
      }),
      Transaction.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfYear, $lte: endOfYear },
          },
        },
        {
          $group: {
            _id: { $month: "$createdAt" },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]),
    ]);

    const history = Array(12).fill(0);
    monthlyData.forEach((month) => {
      history[month._id - 1] = month.count;
    });

    logger.info("Total transactions retrieved", { traceId, year: yearNumber });
    return res.status(200).json({
      success: true,
      message: "Total transactions retrieved successfully",
      data: { total, history },
      traceId,
    });
  } catch (error) {
    logger.error(`Failed to fetch total transactions: ${error.message}`, { traceId, stack: error.stack });
    return res.status(500).json({
      success: false,
      code: "DATABASE_ERROR",
      message: "Failed to fetch total transactions",
      traceId,
    });
  }
};

// Get recent transactions with daily breakdown for a specific year and month
export const getRecentTransactions = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  setSecurityHeaders(res);

  try {
    if (!(await ensureAdmin(req, res, traceId))) return;

    const { year = new Date().getFullYear(), month = new Date().getMonth() + 1 } = req.query;
    const yearNumber = parseInt(year, 10);
    const monthNumber = parseInt(month, 10);

    if (
      isNaN(yearNumber) ||
      yearNumber < 2000 ||
      yearNumber > new Date().getFullYear() + 1 ||
      isNaN(monthNumber) ||
      monthNumber < 1 ||
      monthNumber > 12
    ) {
      return res.status(400).json({
        success: false,
        code: "INVALID_INPUT",
        message: "Valid year (2000 or later) and month (1-12) are required",
        traceId,
      });
    }

    const startDate = new Date(yearNumber, monthNumber - 1, 1, 0, 0, 0, 0);
    const endDate = new Date(yearNumber, monthNumber, 0, 23, 59, 59, 999);
    const daysInMonth = endDate.getDate();

    logger.info("Querying recent transactions", {
      traceId,
      year: yearNumber,
      month: monthNumber,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    const transactions = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { $dayOfMonth: "$createdAt" },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    const daily = Array(daysInMonth).fill(0);
    transactions.forEach((day) => {
      daily[day._id - 1] = day.count;
    });

    const total = daily.reduce((sum, count) => sum + count, 0);

    logger.info("Recent transactions retrieved", {
      traceId,
      year: yearNumber,
      month: monthNumber,
      total,
      transactionCount: transactions.length,
    });

    return res.status(200).json({
      success: true,
      message: "Recent transactions retrieved successfully",
      data: { total, daily },
      traceId,
    });
  } catch (error) {
    logger.error(`Failed to fetch recent transactions: ${error.message}`, { traceId, stack: error.stack });
    return res.status(500).json({
      success: false,
      code: "DATABASE_ERROR",
      message: "Failed to fetch recent transactions",
      traceId,
    });
  }
};

// Get all transactions with pagination
export const getAllTransactions = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  setSecurityHeaders(res);

  try {
    if (!(await ensureAdmin(req, res, traceId))) return;

    const { page = 1, limit = 10 } = req.query;
    const pageNumber = parseInt(page, 10);
    const limitNumber = Math.min(parseInt(limit, 10), 100);

    if (isNaN(pageNumber) || pageNumber < 1 || isNaN(limitNumber) || limitNumber < 1) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PAGINATION",
        message: "Invalid pagination parameters",
        traceId,
      });
    }

    const skip = (pageNumber - 1) * limitNumber;

    const [transactions, totalTransactions] = await Promise.all([
      Transaction.find({})
        .populate("userId", "email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber)
        .lean(),
      Transaction.countDocuments(),
    ]);

    logger.info("All transactions retrieved", { traceId, page: pageNumber, limit: limitNumber });
    return res.status(200).json({
      success: true,
      message: "Transactions retrieved successfully",
      data: transactions,
      pagination: {
        total: totalTransactions,
        pages: Math.ceil(totalTransactions / limitNumber),
        page: pageNumber,
        limit: limitNumber,
      },
      traceId,
    });
  } catch (error) {
    logger.error(`Failed to fetch transactions: ${error.message}`, { traceId, stack: error.stack });
    return res.status(500).json({
      success: false,
      code: "DATABASE_ERROR",
      message: "Failed to fetch transactions",
      traceId,
    });
  }
};

export const searchTransaction = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  setSecurityHeaders(res);

  try {
    if (!(await ensureAdmin(req, res, traceId))) return;

    const { query } = req.query;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        code: "INVALID_INPUT",
        message: "A valid search query is required",
        traceId,
      });
    }

    const trimmedQuery = query.trim();
    const conditions = [];

    // Search by Transaction ID (exact match for valid ObjectId)
    if (mongoose.Types.ObjectId.isValid(trimmedQuery)) {
      conditions.push({ _id: new mongoose.Types.ObjectId(trimmedQuery) });
    }
   
    // Search by Payment ID (partial match, case-insensitive)
    conditions.push({ paymentId: { $regex: trimmedQuery, $options: "i" } });

    // Search by User Email or Username (partial match, case-insensitive)
    const emailRegex = { $regex: trimmedQuery, $options: "i" };
    const usernameRegex = { $regex: `^${trimmedQuery}`, $options: "i" };

    const users = await User.find({
      $or: [
        { email: emailRegex },
        { email: usernameRegex },
      ],
    }).select("_id");

    const userIds = users.map((user) => user._id);
    if (userIds.length > 0) {
      conditions.push({ userId: { $in: userIds } });
    }

    const transactions = await Transaction.find({ $or: conditions })
      .populate("userId", "email")
      .populate("courseId", "title")
      .populate("subscriptionId", "name")
      .sort({ createdAt: -1 })
      .lean();

    if (transactions.length === 0) {
      return res.status(404).json({
        success: false,
        code: "TRANSACTION_NOT_FOUND",
        message: "No transactions found for the given query",
        traceId,
      });
    }

    logger.info("Transactions retrieved", {
      traceId,
      query: trimmedQuery,
      resultCount: transactions.length,
    });

    return res.status(200).json({
      success: true,
      message: "Transactions retrieved successfully",
      data: transactions,
      traceId,
    });
  } catch (error) {
    logger.error(`Failed to search transactions: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      code: "DATABASE_ERROR",
      message: "Failed to search transactions",
      traceId,
    });
  }
};

// Filter transactions by status
export const filterTransactions = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  setSecurityHeaders(res);

  try {
    if (!(await ensureAdmin(req, res, traceId))) return;

    const { status } = req.query;

    if (!status || !["successful", "failed", "pending", "refunded"].includes(status)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_INPUT",
        message: "Valid status (successful, file, pending, refunded) is required",
        traceId,
      });
    }

    const transactions = await Transaction.find({ status })
      .populate("userId", "email")
      .sort({ createdAt: -1 })
      .lean();

    logger.info("Transactions filtered", { traceId, status });
    return res.status(200).json({
      success: true,
      message: "Transactions retrieved successfully",
      data: transactions,
      traceId,
    });
  } catch (error) {
    logger.error(`Failed to filter transactions: ${error.message}`, { traceId, stack: error.stack });
    return res.status(500).json({
      success: false,
      code: "DATABASE_ERROR",
      message: "Failed to filter transactions",
      traceId,
    });
  }
};

// Get transactions for the authenticated user
export const getUserTransactions = async (req, res) => {
  const traceId = req.headers?.["x-trace-id"] || randomUUID();

  try {
    if (!req.user?.userId) {
      logger.warn("Unauthorized access attempt", { traceId });
      return res.status(401).json({
        success: false,
        code: "UNAUTHORIZED",
        message: "User authentication required",
        traceId,
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const status = req.query.status;
    const query = {
      userId: new mongoose.Types.ObjectId(req.user.userId),
    };
    if (status && ["successful", "failed", "pending", "refunded"].includes(status)) {
      query.status = status;
    }

    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .select("paymentId orderId amount currency status purchaseType notes createdAt")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(),
      Transaction.countDocuments(query),
    ]);

    logger.info("User transactions fetched", {
      traceId,
      userId: req.user.userId,
      page,
      limit,
      total,
    });

    return res.status(200).json({
      success: true,
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      traceId,
    });
  } catch (error) {
    logger.error(`Failed to fetch user transactions: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      code: "DATABASE_ERROR",
      message: "Failed to fetch user transactions",
      traceId,
    });
  }
};

// Get transaction details by paymentId
export const getTransactionDetails = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  setSecurityHeaders(res);

  try {
    if (!(await ensureAdmin(req, res, traceId))) return;

    const { paymentId } = req.params;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        code: "INVALID_INPUT",
        message: "Payment ID is required",
        traceId,
      });
    }

    const transaction = await Transaction.findOne({ paymentId })
      .populate("userId", "email firstName lastName")
      .populate("courseId", "title newPrice")
      .populate("subscriptionId", "name")
      .lean();

    if (!transaction) {
      return res.status(404).json({
        success: false,
        code: "TRANSACTION_NOT_FOUND",
        message: "Transaction not found",
        traceId,
      });
    }

    const transactionDetails = {
      transactionId: transaction._id,
      user: {
        userId: transaction.userId._id || "Unknown",
        email: transaction.userId?.email || "Unknown",
        firstName: transaction.userId?.firstName || "N/A",
        lastName: transaction.userId?.lastName || "N/A",
      },
      orderId: transaction.orderId || "N/A",
      paymentId: transaction.paymentId,
      course: transaction.courseId
        ? {
            courseId: transaction.courseId._id,
            title: transaction.courseId.title,
            price: transaction.courseId.newPrice,
          }
        : null,
      subscription: transaction.subscriptionId
        ? {
            subscriptionId: transaction.subscriptionId._id,
            name: transaction.subscriptionId.name,
          }
        : null,
      currency: transaction.currency || "INR",
      amount: transaction.amount,
      status: transaction.status,
      purchaseType: transaction.purchaseType,
      notes: transaction.notes || {},
      refundStatus: transaction.refundStatus || "None",
      cartItems: transaction.notes.cartItems || [],
      createdAt: transaction.createdAt,
      version: transaction.__v,
    };

    logger.info("Transaction details retrieved", { traceId, paymentId });

    return res.status(200).json({
      success: true,
      message: "Transaction details retrieved successfully",
      data: transactionDetails,
      traceId,
    });
  } catch (error) {
    logger.error(`Failed to fetch transaction details: ${error.message}`, { traceId, stack: error.stack });
    return res.status(500).json({
      success: false,
      code: "DATABASE_ERROR",
      message: "Failed to fetch transaction details",
      traceId,
    });
  }
};