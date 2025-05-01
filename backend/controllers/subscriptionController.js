import User from "../models/User.js";

// Helper function to validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Helper function to find user by email and exclude sensitive fields
const findUserByEmail = async (email) => {
  return await User.findOne({ email }).select("-password -passwordResetToken -passwordResetExpires");
};

// 1. Get all subscribed users
export const getAllSubscribedUsers = async (req, res) => {
  try {
    const { type } = req.query; // Optional filter by subscription type

    // Build query for active subscriptions
    const query = { "subscription.status": "active" };
    if (type && ["free", "basic", "pro", "premium"].includes(type)) {
      query["subscription.type"] = type;
    }

    // Find users with active subscriptions
    const subscribedUsers = await User.find(query).select(
      "-password -passwordResetToken -passwordResetExpires"
    );

    res.status(200).json({ success: true, data: subscribedUsers });
  } catch (error) {
    console.error("Error fetching subscribed users:", error);
    res.status(500).json({ success: false, message: "Failed to fetch subscribed users", error: error.message });
  }
};

// 2. Activate a subscription for a user
export const activateSubscription = async (req, res) => {
  try {
    const { email } = req.params;
    const { type, planDuration } = req.body;

    // Validate email
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "Invalid email address" });
    }

    // Validate subscription type
    if (!["free", "basic", "pro", "premium"].includes(type)) {
      return res.status(400).json({ success: false, message: "Invalid subscription type" });
    }

    // Validate plan duration for non-free subscriptions
    if (type !== "free" && (!planDuration || typeof planDuration !== "number" || planDuration <= 0)) {
      return res.status(400).json({ success: false, message: "Plan duration must be a positive number" });
    }

    // Calculate end date based on plan duration
    const startDate = new Date();
    const endDate = planDuration
      ? new Date(startDate.getTime() + planDuration * 24 * 60 * 60 * 1000)
      : null;

    // Find user by email and update subscription
    const user = await User.findOneAndUpdate(
      { email },
      {
        subscription: {
          type,
          status: "active",
          startDate,
          endDate,
          planDuration: type === "free" ? null : planDuration, // Set planDuration to null for free subscriptions
        },
      },
      { new: true }
    ).select("-password -passwordResetToken -passwordResetExpires");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({ success: true, message: "Subscription activated successfully", user });
  } catch (error) {
    console.error("Error activating subscription:", error);
    res.status(500).json({ success: false, message: "Failed to activate subscription", error: error.message });
  }
};

// 3. Cancel a subscription for a user
export const cancelSubscription = async (req, res) => {
  try {
    const { email } = req.params;

    // Validate email
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "Invalid email address" });
    }

    // Find user by email and update subscription status to "canceled"
    const user = await User.findOneAndUpdate(
      { email, "subscription.status": "active" }, // Ensure the user has an active subscription
      {
        "subscription.status": "canceled",
      },
      { new: true }
    ).select("-password -passwordResetToken -passwordResetExpires");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found or no active subscription" });
    }

    res.status(200).json({ success: true, message: "Subscription canceled successfully", user });
  } catch (error) {
    console.error("Error canceling subscription:", error);
    res.status(500).json({ success: false, message: "Failed to cancel subscription", error: error.message });
  }
};

// 4. Extend a subscription for a user
export const extendSubscription = async (req, res) => {
  try {
    const { email } = req.params;
    const { additionalDuration } = req.body;

    // Validate email
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "Invalid email address" });
    }

    // Validate additional duration
    if (!additionalDuration || typeof additionalDuration !== "number" || additionalDuration <= 0) {
      return res.status(400).json({ success: false, message: "Additional duration must be a positive number" });
    }

    // Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Ensure the user has an active subscription
    if (user.subscription.status !== "active") {
      return res.status(400).json({ success: false, message: "User does not have an active subscription" });
    }

    // Calculate new end date
    const currentEndDate = user.subscription.endDate || new Date();
    const newEndDate = new Date(currentEndDate.getTime() + additionalDuration * 24 * 60 * 60 * 1000);

    // Update user's subscription
    user.subscription.endDate = newEndDate;
    user.subscription.planDuration += additionalDuration;
    await user.save();

    res.status(200).json({ success: true, message: "Subscription extended successfully", user });
  } catch (error) {
    console.error("Error extending subscription:", error);
    res.status(500).json({ success: false, message: "Failed to extend subscription", error: error.message });
  }
};

// 5. Check subscription status for a user
export const checkSubscriptionStatus = async (req, res) => {
  try {
    const { email } = req.params;

    // Validate email
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "Invalid email address" });
    }

    // Find the user by email
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Return subscription details
    const subscriptionDetails = {
      status: user.subscription.status,
      type: user.subscription.type,
      startDate: user.subscription.startDate,
      endDate: user.subscription.endDate,
      planDuration: user.subscription.planDuration,
    };

    res.status(200).json({ success: true, message: "Subscription status retrieved successfully", subscription: subscriptionDetails });
  } catch (error) {
    console.error("Error checking subscription status:", error);
    res.status(500).json({ success: false, message: "Failed to check subscription status", error: error.message });
  }
};

// 6. Get total subscriber count
export const getTotalSubscriberCount = async (req, res) => {
  try {
    // Count users with active subscriptions
    const totalSubscribers = await User.countDocuments({ "subscription.status": "active" });

    res.status(200).json({ success: true, totalSubscribers });
  } catch (error) {
    console.error("Error fetching total subscriber count:", error);
    res.status(500).json({ success: false, message: "Failed to fetch total subscriber count", error: error.message });
  }
};