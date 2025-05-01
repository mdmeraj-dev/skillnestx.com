import cron from "node-cron";
import mongoose from "mongoose";
import Subscription from "./models/Subscription.js";
import User from "./models/User.js";
import logger from "./utils/logger.js";

// Connect to MongoDB (assumes server.js handles connection, but included for standalone execution)
import config from "./config.js";

async function connectMongo() {
  try {
    await mongoose.connect(config.MONGO_URI);
    logger.info("MongoDB connected for cron jobs");
  } catch (error) {
    logger.error(`MongoDB connection error for cron jobs: ${error.message}`);
    process.exit(1);
  }
}

// Schedule task to check subscription expirations daily at midnight
cron.schedule("0 0 * * *", async () => {
  logger.info("Running subscription expiration check");

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    // Find active subscriptions with expired endDate
    const expiredSubscriptions = await Subscription.find({
      status: "active",
      endDate: { $lt: new Date() },
    }).session(session);

    for (const subscription of expiredSubscriptions) {
      // Update subscription status
      subscription.status = "expired";
      await subscription.save({ session });

      // Update user's subscription to a free plan
      const user = await User.findById(subscription.userId).session(session);
      if (user) {
        // Check if a free subscription exists
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

        logger.info(`Subscription expired: ${subscription._id}, user: ${user._id}, switched to free plan`);
      }
    }

    await session.commitTransaction();
    logger.info(`Subscription expiration check completed, processed ${expiredSubscriptions.length} subscriptions`);
  } catch (error) {
    await session.abortTransaction();
    logger.error(`Subscription expiration check error: ${error.message}`);
  } finally {
    session.endSession();
  }
});

// Initialize MongoDB connection
connectMongo();

export default cron;