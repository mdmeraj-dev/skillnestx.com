import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import crypto from "crypto";
import User from "../models/User.js";
import Subscription from "../models/Subscription.js";
import Payment from "../models/Payment.js";
import Course from "../models/Course.js";
import logger from "../utils/logger.js";
import { updateUserAfterPayment } from "./userController.js";
import config from "../config/config.js";

// Utility function for error logging
const logError = (error, eventType) => {
  logger.error(`Webhook error [${eventType}]: ${error.message}`);
};

// Verify Razorpay webhook signature
const verifyWebhookSignature = (body, signature, secret) => {
  const computedSignature = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(body))
    .digest("hex");
  return computedSignature === signature;
};

// @desc    Handle Razorpay webhook events
// @route   POST /api/webhooks/razorpay
// @access  Public (Razorpay server)
export const handleRazorpayWebhook = asyncHandler(async (req, res) => {
  const webhookSecret = config.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers["x-razorpay-signature"];
  const event = req.body;

  // Verify webhook signature
  if (!signature || !verifyWebhookSignature(event, signature, webhookSecret)) {
    logger.error("Invalid webhook signature");
    return res.status(400).json({ success: false, message: "Invalid signature" });
  }

  const eventType = event.event;
  const payload = event.payload;
  logger.info(`Webhook received: ${eventType}`);

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    switch (eventType) {
      case "payment.authorized":
        await handlePaymentAuthorized(payload.payment.entity, session);
        break;

      case "subscription.charged":
        await handleSubscriptionCharged(payload.subscription.entity, session);
        break;

      case "subscription.cancelled":
        await handleSubscriptionCancelled(payload.subscription.entity, session);
        break;

      case "payment.failed":
        await handlePaymentFailed(payload.payment.entity, session);
        break;

      default:
        logger.info(`Unhandled webhook event: ${eventType}`);
        break;
    }

    await session.commitTransaction();
    res.status(200).json({ success: true, message: "Webhook processed" });
  } catch (error) {
    await session.abortTransaction();
    logError(error, eventType);
    res.status(500).json({ success: false, message: "Webhook processing failed" });
  } finally {
    session.endSession();
  }
});

// Handle payment.authorized event
async function handlePaymentAuthorized(payment, session) {
  const { order_id, id: payment_id, notes } = payment;
  const paymentRecord = await Payment.findOne({ razorpayOrderId: order_id }).session(session);

  if (!paymentRecord) {
    throw new Error(`Payment not found for order ${order_id}`);
  }

  if (paymentRecord.paymentStatus === "completed") {
    logger.info(`Payment already processed: ${payment_id}`);
    return;
  }

  paymentRecord.razorpayPaymentId = payment_id;
  paymentRecord.paymentStatus = "completed";
  await paymentRecord.save({ session });

  const userId = paymentRecord.userId;
  const courseId = paymentRecord.courseId;
  const subscriptionId = paymentRecord.subscriptionId;

  // Update user and related models
  await updateUserAfterPayment(userId, courseId, subscriptionId, session);

  // Update subscription status if applicable
  if (subscriptionId) {
    const subscription = await Subscription.findById(subscriptionId).session(session);
    if (subscription && subscription.status === "pending") {
      subscription.status = "active";
      subscription.startDate = new Date();
      const durationDays = getSubscriptionDuration(subscription.type);
      subscription.endDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
      await subscription.save({ session });
    }
  }

  logger.info(`Payment authorized processed: ${payment_id}, user: ${userId}`);
}

// Handle subscription.charged event
async function handleSubscriptionCharged(subscription, session) {
  const { id: razorpaySubscriptionId, status, current_start, current_end } = subscription;
  const subscriptionRecord = await Subscription.findOne({ razorpaySubscriptionId }).session(session);

  if (!subscriptionRecord) {
    throw new Error(`Subscription not found for Razorpay ID ${razorpaySubscriptionId}`);
  }

  if (subscriptionRecord.status === status) {
    logger.info(`Subscription already up-to-date: ${razorpaySubscriptionId}`);
    return;
  }

  subscriptionRecord.status = status === "active" ? "active" : status;
  subscriptionRecord.startDate = new Date(current_start * 1000);
  subscriptionRecord.endDate = current_end ? new Date(current_end * 1000) : null;
  await subscriptionRecord.save({ session });

  // Update user subscription
  const user = await User.findById(subscriptionRecord.userId).session(session);
  if (user && !user.subscription?.equals(subscriptionRecord._id)) {
    user.subscription = subscriptionRecord._id;
    await user.save({ session });
  }

  // Create or update payment record
  const payment = await Payment.findOne({
    subscriptionId: subscriptionRecord._id,
    paymentStatus: "pending",
  }).session(session);

  if (payment) {
    payment.paymentStatus = "completed";
    payment.razorpayPaymentId = subscription.last_payment?.id || null;
    await payment.save({ session });
  } else {
    await Payment.create(
      [
        {
          userId: subscriptionRecord.userId,
          subscriptionId: subscriptionRecord._id,
          amount: subscriptionRecord.amount || 0,
          currency: "INR",
          paymentStatus: "completed",
          razorpayOrderId: null,
          razorpayPaymentId: subscription.last_payment?.id || null,
        },
      ],
      { session }
    );
  }

  logger.info(`Subscription charged processed: ${razorpaySubscriptionId}, user: ${subscriptionRecord.userId}`);
}

// Handle subscription.cancelled event
async function handleSubscriptionCancelled(subscription, session) {
  const { id: razorpaySubscriptionId } = subscription;
  const subscriptionRecord = await Subscription.findOne({ razorpaySubscriptionId }).session(session);

  if (!subscriptionRecord) {
    throw new Error(`Subscription not found for Razorpay ID ${razorpaySubscriptionId}`);
  }

  if (subscriptionRecord.status === "cancelled") {
    logger.info(`Subscription already cancelled: ${razorpaySubscriptionId}`);
    return;
  }

  subscriptionRecord.status = "cancelled";
  subscriptionRecord.endDate = new Date();
  await subscriptionRecord.save({ session });

  // Set user to free subscription
  const user = await User.findById(subscriptionRecord.userId).session(session);
  if (user) {
    const freeSubscription = await Subscription.findOne({
      userId: user._id,
      type: "free",
    }).session(session);
    if (freeSubscription) {
      freeSubscription.status = "active";
      await freeSubscription.save({ session });
      user.subscription = freeSubscription._id;
      await user.save({ session });
    } else {
      const newFreeSubscription = await Subscription.create(
        [
          {
            userId: user._id,
            type: "free",
            status: "active",
            startDate: new Date(),
            amount: 0,
            currency: "INR",
          },
        ],
        { session }
      );
      user.subscription = newFreeSubscription[0]._id;
      await user.save({ session });
    }
  }

  logger.info(`Subscription cancelled processed: ${razorpaySubscriptionId}, user: ${subscriptionRecord.userId}`);
}

// Handle payment.failed event
async function handlePaymentFailed(payment, session) {
  const { order_id } = payment;
  const paymentRecord = await Payment.findOne({ razorpayOrderId: order_id }).session(session);

  if (!paymentRecord) {
    throw new Error(`Payment not found for order ${order_id}`);
  }

  if (paymentRecord.paymentStatus === "failed") {
    logger.info(`Payment failure already recorded: ${order_id}`);
    return;
  }

  paymentRecord.paymentStatus = "failed";
  await paymentRecord.save({ session });

  logger.info(`Payment failed processed: ${order_id}, user: ${paymentRecord.userId}`);
}

// Utility to get subscription duration (in days)
function getSubscriptionDuration(type) {
  const durations = {
    free: 0,
    basic: 30,
    pro: 180,
    premium: 365,
    team: 365,
    gift: 30,
  };
  return durations[type] || 30;
}