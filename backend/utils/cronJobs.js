import cron from "node-cron";
import mongoose from "mongoose";
import Subscription from "../models/Subscription.js";
import User from "../models/User.js";
import config from "../config.js";
import { connectDB } from "../config/connectDB.js";
import { sendEmail, TEMPLATE_TYPES } from "../utils/sendEmail.js";
import crypto from "crypto";
import { formatDate } from "../utils/dateUtils.js";

/**
 * Start cron jobs for subscription expiration checks
 * @returns {void}
 */
export const startCronJobs = async () => {
  try {
    // Ensure MongoDB connection only if not already connected
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }
  } catch (error) {
    process.exit(1);
  }

  // Schedule task to check subscription expirations daily at midnight
  cron.schedule("0 0 * * *", async () => {
    const taskTraceId = crypto.randomUUID();
    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      // Find active subscriptions with expired endDate
      const expiredSubscriptions = await Subscription.find({
        status: "active",
        endDate: { $lt: new Date() },
      }).session(session);

      for (const subscription of expiredSubscriptions) {
        // Validate subscription
        if (!subscription.userId) {
          continue;
        }

        // Update subscription status
        subscription.status = "expired";
        await subscription.save({ session });

        // Find user
        const user = await User.findById(subscription.userId).session(session);
        if (!user) {
          continue;
        }

        // Check or create free subscription
        let freeSubscription = await Subscription.findOne({
          userId: user._id,
          type: "free",
        }).session(session);

        if (!freeSubscription) {
          freeSubscription = await Subscription.create(
            [
              {
                userId: user._id,
                type: "free",
                status: "active",
                amount: 0,
                currency: "INR",
                startDate: new Date(),
              },
            ],
            { session }
          );
          freeSubscription = freeSubscription[0];
        } else if (freeSubscription.status !== "active") {
          freeSubscription.status = "active";
          freeSubscription.startDate = new Date();
          freeSubscription.endDate = null;
          await freeSubscription.save({ session });
        }

        user.subscription = freeSubscription._id;
        await user.save({ session });

        // Send expiration notification email
        try {
          await sendEmail({
            email: user.email,
            name: user.name,
            templateType: TEMPLATE_TYPES.SUBSCRIPTION_EXPIRY,
            templateData: {
              user_name: user.name,
              subscription_type: subscription.type,
              end_date: formatDate(subscription.endDate),
              support_email: config.SUPPORT_EMAIL,
              company_name: config.COMPANY_NAME,
              redirect_url: `${config.VITE_FRONTEND_URL}/support`,
              current_year: new Date().getFullYear().toString(),
            },
            traceId: taskTraceId,
          });
        } catch (emailError) {
          // Silent email error handling
        }
      }

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
    } finally {
      session.endSession();
    }
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata",
  });
};