import mongoose from "mongoose";
import Subscription from "../models/Subscription.js";
import User from "../models/User.js";
import { sendError } from "../middleware/authMiddleware.js";
import { logger } from "../utils/logger.js";
import sanitize from "mongo-sanitize";
import { randomUUID } from "crypto";

// Create a new subscription template (admin only)
export const createSubscriptionTemplate = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  try {
    const {
      name,
      type,
      oldPrice,
      newPrice,
      features,
      tag = "",
      duration,
    } = req.body;

    // Sanitize inputs
    const sanitizedData = {
      name: sanitize(name),
      type: sanitize(type),
      oldPrice: oldPrice ? Math.round(Number(sanitize(oldPrice))) : null, // Ensure integer if not null
      newPrice: Math.round(Number(sanitize(newPrice))), // Ensure integer
      features: Array.isArray(sanitize(features))
        ? sanitize(features).map((f) => f.trim())
        : [],
      tag: sanitize(tag),
      duration: Number(sanitize(duration)),
    };

    // Validate required fields
    const requiredFields = [
      "name",
      "type",
      "oldPrice",
      "newPrice",
      "features",
      "duration",
    ];
    const missingFields = requiredFields.filter(
      (field) =>
        sanitizedData[field] == null ||
        sanitizedData[field] === "" ||
        Number.isNaN(sanitizedData[field])
    );
    if (missingFields.length > 0) {
      logger.warn(`Missing required fields: ${missingFields.join(", ")}`, {
        traceId,
      });
      return sendError(
        res,
        400,
        "MISSING_FIELDS",
        `Missing required fields: ${missingFields.join(", ")}`,
        traceId
      );
    }

    // Validate name
    const validNames = [
      "Basic Plan",
      "Pro Plan",
      "Premium Plan",
      "Gift Plan",
      "Team Plan",
    ];
    if (!validNames.includes(sanitizedData.name)) {
      logger.warn(`Invalid name: ${sanitizedData.name}`, { traceId });
      return sendError(
        res,
        400,
        "INVALID_NAME",
        `Name must be one of: ${validNames.join(", ")}`,
        traceId
      );
    }

    // Validate type
    const validTypes = ["Personal", "Team", "Gift"];
    if (!validTypes.includes(sanitizedData.type)) {
      logger.warn(`Invalid type: ${sanitizedData.type}`, { traceId });
      return sendError(
        res,
        400,
        "INVALID_TYPE",
        `Type must be one of: ${validTypes.join(", ")}`,
        traceId
      );
    }

    // Validate prices
    if (
      !Number.isInteger(sanitizedData.newPrice) ||
      sanitizedData.newPrice < 0
    ) {
      logger.warn(
        `Invalid newPrice: ${sanitizedData.newPrice} (must be a non-negative integer)`,
        { traceId }
      );
      return sendError(
        res,
        400,
        "INVALID_NEW_PRICE",
        "New price must be a non-negative integer",
        traceId
      );
    }
    if (
      sanitizedData.oldPrice !== null &&
      (!Number.isInteger(sanitizedData.oldPrice) || sanitizedData.oldPrice < 0)
    ) {
      logger.warn(
        `Invalid oldPrice: ${sanitizedData.oldPrice} (must be a non-negative integer or null)`,
        { traceId }
      );
      return sendError(
        res,
        400,
        "INVALID_OLD_PRICE",
        "Old price must be a non-negative integer or null",
        traceId
      );
    }

    // Validate features
    if (
      !Array.isArray(sanitizedData.features) ||
      sanitizedData.features.length === 0 ||
      !sanitizedData.features.every(
        (f) => typeof f === "string" && f.trim().length > 0
      )
    ) {
      logger.warn("Invalid features array", { traceId });
      return sendError(
        res,
        400,
        "INVALID_FEATURES",
        "Features must be a non-empty array of non-empty strings",
        traceId
      );
    }

    // Validate duration
    const validDurations = [30, 180, 365];
    if (!validDurations.includes(sanitizedData.duration)) {
      logger.warn(`Invalid duration: ${sanitizedData.duration}`, { traceId });
      return sendError(
        res,
        400,
        "INVALID_DURATION",
        `Duration must be one of: ${validDurations.join(", ")} days`,
        traceId
      );
    }

    // Log sanitized data for debugging
    logger.debug(
      `Creating subscription with data: ${JSON.stringify(sanitizedData)}`,
      { traceId }
    );

    // Create subscription template
    const subscription =
      await Subscription.createOrUpdateSubscriptionTemplate(sanitizedData);
    logger.info(
      `Subscription template created: ${subscription._id} by user: ${req.user.userId}`,
      { traceId }
    );

    res.status(201).json({
      success: true,
      data: {
        subscriptionId: subscription._id.toString(),
        name: subscription.name,
        type: subscription.type,
        oldPrice: subscription.oldPrice,
        newPrice: subscription.newPrice,
        features: subscription.features,
        tag: subscription.tag,
        duration: subscription.duration,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt,
      },
      traceId,
    });
  } catch (error) {
    logger.error(`Error creating subscription template: ${error.message}`, {
      traceId,
      error,
    });
    return sendError(
      res,
      500,
      "CREATE_TEMPLATE_FAILED",
      error.message || "Failed to create subscription template",
      traceId
    );
  }
};

// Update an existing subscription template (admin only)
export const updateSubscriptionTemplate = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      logger.warn(`Invalid subscription ID: ${id}`, { traceId });
      return sendError(
        res,
        400,
        "INVALID_ID",
        "Invalid subscription ID",
        traceId
      );
    }

    const { name, type, oldPrice, newPrice, features, tag, duration } =
      req.body;

    // Sanitize inputs
    const sanitizedData = {
      id,
      name: sanitize(name),
      type: sanitize(type),
      oldPrice: oldPrice ? Math.round(Number(sanitize(oldPrice))) : null, // Ensure integer if not null
      newPrice: Math.round(Number(sanitize(newPrice))), // Ensure integer
      features: Array.isArray(sanitize(features))
        ? sanitize(features).map((f) => f.trim())
        : [],
      tag: sanitize(tag),
      duration: Number(sanitize(duration)),
    };

    // Validate required fields
    const requiredFields = ["name", "type", "newPrice", "features", "duration"];
    const missingFields = requiredFields.filter(
      (field) =>
        sanitizedData[field] == null ||
        sanitizedData[field] === "" ||
        Number.isNaN(sanitizedData[field])
    );
    if (missingFields.length > 0) {
      logger.warn(`Missing required fields: ${missingFields.join(", ")}`, {
        traceId,
      });
      return sendError(
        res,
        400,
        "MISSING_FIELDS",
        `Missing required fields: ${missingFields.join(", ")}`,
        traceId
      );
    }

    // Validate name
    const validNames = [
      "Basic Plan",
      "Pro Plan",
      "Premium Plan",
      "Gift Plan",
      "Team Plan",
    ];
    if (!validNames.includes(sanitizedData.name)) {
      logger.warn(`Invalid name: ${sanitizedData.name}`, { traceId });
      return sendError(
        res,
        400,
        "INVALID_NAME",
        `Name must be one of: ${validNames.join(", ")}`,
        traceId
      );
    }

    // Validate type
    const validTypes = ["Personal", "Team", "Gift"];
    if (!validTypes.includes(sanitizedData.type)) {
      logger.warn(`Invalid type: ${sanitizedData.type}`, { traceId });
      return sendError(
        res,
        400,
        "INVALID_TYPE",
        `Type must be one of: ${validTypes.join(", ")}`,
        traceId
      );
    }

    // Validate prices
    if (
      !Number.isInteger(sanitizedData.newPrice) ||
      sanitizedData.newPrice < 0
    ) {
      logger.warn(
        `Invalid newPrice: ${sanitizedData.newPrice} (must be a non-negative integer)`,
        { traceId }
      );
      return sendError(
        res,
        400,
        "INVALID_NEW_PRICE",
        "New price must be a non-negative integer",
        traceId
      );
    }
    if (
      sanitizedData.oldPrice !== null &&
      (!Number.isInteger(sanitizedData.oldPrice) || sanitizedData.oldPrice < 0)
    ) {
      logger.warn(
        `Invalid oldPrice: ${sanitizedData.oldPrice} (must be a non-negative integer or null)`,
        { traceId }
      );
      return sendError(
        res,
        400,
        "INVALID_OLD_PRICE",
        "Old price must be a non-negative integer or null",
        traceId
      );
    }

    // Validate features
    if (
      !Array.isArray(sanitizedData.features) ||
      sanitizedData.features.length === 0 ||
      !sanitizedData.features.every(
        (f) => typeof f === "string" && f.trim().length > 0
      )
    ) {
      logger.warn("Invalid features array", { traceId });
      return sendError(
        res,
        400,
        "INVALID_FEATURES",
        "Features must be a non-empty array of non-empty strings",
        traceId
      );
    }

    // Validate duration
    const validDurations = [30, 180, 365];
    if (!validDurations.includes(sanitizedData.duration)) {
      logger.warn(`Invalid duration: ${sanitizedData.duration}`, { traceId });
      return sendError(
        res,
        400,
        "INVALID_DURATION",
        `Duration must be one of: ${validDurations.join(", ")} days`,
        traceId
      );
    }

    // Log sanitized data for debugging
    logger.debug(
      `Updating subscription ${id} with data: ${JSON.stringify(sanitizedData)}`,
      { traceId }
    );

    // Update subscription template
    const subscription =
      await Subscription.createOrUpdateSubscriptionTemplate(sanitizedData);
    if (!subscription) {
      logger.warn(`Subscription not found: ${id}`, { traceId });
      return sendError(
        res,
        404,
        "SUBSCRIPTION_NOT_FOUND",
        "Subscription not found",
        traceId
      );
    }

    logger.info(
      `Subscription template updated: ${id} by user: ${req.user.userId}`,
      { traceId }
    );

    res.status(200).json({
      success: true,
      data: {
        subscriptionId: subscription._id.toString(),
        name: subscription.name,
        type: subscription.type,
        oldPrice: subscription.oldPrice,
        newPrice: subscription.newPrice,
        features: subscription.features,
        tag: subscription.tag,
        duration: subscription.duration,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt,
      },
      traceId,
    });
  } catch (error) {
    logger.error(`Error updating subscription template: ${error.message}`, {
      traceId,
      error,
    });
    return sendError(
      res,
      500,
      "UPDATE_TEMPLATE_FAILED",
      error.message || "Failed to update subscription template",
      traceId
    );
  }
};

// Delete a subscription template (admin only)
export const deleteSubscriptionTemplate = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      logger.warn(`Invalid subscription ID: ${id}`, { traceId });
      return sendError(
        res,
        400,
        "INVALID_ID",
        "Invalid subscription ID",
        traceId
      );
    }

    await Subscription.deleteSubscriptionTemplate(id);
    logger.info(
      `Subscription template deleted: ${id} by user: ${req.user.userId}`,
      { traceId }
    );

    res.status(200).json({
      success: true,
      data: {
        subscriptionId: id,
        message: "Subscription template deleted successfully",
      },
      traceId,
    });
  } catch (error) {
    logger.error(`Error deleting subscription template: ${error.message}`, {
      traceId,
    });
    return sendError(
      res,
      error.message.includes("not found") ? 404 : 500,
      "DELETE_TEMPLATE_FAILED",
      error.message || "Failed to delete subscription template",
      traceId
    );
  }
};

// Get all subscription templates (admin or user)
export const getAllSubscriptionTemplates = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  try {
    const templates = await Subscription.getAllSubscriptionTemplates();
    logger.info(`Fetched ${templates.length} subscription templates`, {
      traceId,
    });

    res.status(200).json({
      success: true,
      data: templates,
      traceId,
    });
  } catch (error) {
    logger.error(`Error fetching subscription templates: ${error.message}`, {
      traceId,
    });
    return sendError(
      res,
      500,
      "FETCH_TEMPLATES_FAILED",
      error.message || "Failed to fetch subscription templates",
      traceId
    );
  }
};

// Get total subscribers for a specific year (admin only), month-wise
export const getTotalSubscribers = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  try {
    if (req.user.role !== "admin") {
      logger.warn(
        `Unauthorized access to getTotalSubscribers by userId ${req.user.userId}`,
        { traceId }
      );
      return sendError(res, 403, "FORBIDDEN", "Admin access required", traceId);
    }

    const { year } = req.query;
    const sanitizedYear = Number(sanitize(year)) || new Date().getFullYear();

    if (sanitizedYear < 2000 || sanitizedYear > new Date().getFullYear() + 1) {
      logger.warn(`Invalid year parameter: ${sanitizedYear}`, { traceId });
      return sendError(
        res,
        400,
        "INVALID_INPUT",
        "Valid year is required",
        traceId
      );
    }

    const startDate = new Date(Date.UTC(sanitizedYear, 0, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(sanitizedYear, 11, 31, 23, 59, 59));

    const subscribers = await User.aggregate([
      {
        $match: {
          "activeSubscription.status": "active",
          "activeSubscription.startDate": {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      {
        $group: {
          _id: { $month: "$activeSubscription.startDate" },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    const totalSubscribers = subscribers.reduce(
      (sum, month) => sum + month.count,
      0
    );
    const history = Array(12).fill(0);
    subscribers.forEach((month) => {
      history[month._id - 1] = month.count;
    });

    logger.info(
      `Total subscribers retrieved for year ${sanitizedYear}: ${totalSubscribers}`,
      { traceId }
    );
    return res.status(200).json({
      success: true,
      message: "Total subscribers retrieved successfully",
      total: totalSubscribers,
      history,
      traceId,
    });
  } catch (error) {
    logger.error(`Error fetching total subscribers: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    return sendError(
      res,
      500,
      "FETCH_SUBSCRIBERS_FAILED",
      "Failed to fetch total subscribers",
      traceId
    );
  }
};

// Get recent subscribers for a specific year and month (admin only), week-wise
export const getRecentSubscribers = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  try {
    if (req.user.role !== "admin") {
      logger.warn(
        `Unauthorized access to getRecentSubscribers by userId ${req.user.userId}`,
        { traceId }
      );
      return sendError(res, 403, "FORBIDDEN", "Admin access required", traceId);
    }

    const { year, month } = req.query;
    const sanitizedYear = Number(sanitize(year)) || new Date().getFullYear();
    const sanitizedMonth = Number(sanitize(month)) || new Date().getMonth() + 1;

    if (sanitizedYear < 2000 || sanitizedYear > new Date().getFullYear() + 1) {
      logger.warn(`Invalid year parameter: ${sanitizedYear}`, { traceId });
      return sendError(
        res,
        400,
        "INVALID_INPUT",
        "Valid year is required",
        traceId
      );
    }

    if (sanitizedMonth < 1 || sanitizedMonth > 12) {
      logger.warn(`Invalid month parameter: ${sanitizedMonth}`, { traceId });
      return sendError(
        res,
        400,
        "INVALID_INPUT",
        "Valid month (1-12) is required",
        traceId
      );
    }

    const daysInMonth = new Date(sanitizedYear, sanitizedMonth, 0).getDate();
    const startDate = new Date(
      Date.UTC(sanitizedYear, sanitizedMonth - 1, 1, 0, 0, 0)
    );
    const endDate = new Date(
      Date.UTC(sanitizedYear, sanitizedMonth - 1, daysInMonth, 23, 59, 59)
    );

    const subscribers = await User.aggregate([
      {
        $match: {
          "activeSubscription.status": "active",
          "activeSubscription.startDate": {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      {
        $group: {
          _id: {
            $cond: [
              {
                $lte: [{ $dayOfMonth: "$activeSubscription.startDate" }, 7],
              },
              1,
              {
                $cond: [
                  {
                    $lte: [
                      { $dayOfMonth: "$activeSubscription.startDate" },
                      15,
                    ],
                  },
                  2,
                  {
                    $cond: [
                      {
                        $lte: [
                          { $dayOfMonth: "$activeSubscription.startDate" },
                          22,
                        ],
                      },
                      3,
                      4,
                    ],
                  },
                ],
              },
            ],
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    const recentSubscribers = subscribers.reduce(
      (sum, week) => sum + week.count,
      0
    );
    const weekly = Array(4).fill(0);
    subscribers.forEach((week) => {
      weekly[week._id - 1] = week.count;
    });

    logger.info(
      `Recent subscribers retrieved for ${sanitizedYear}-${sanitizedMonth}: ${recentSubscribers}`,
      { traceId }
    );
    return res.status(200).json({
      success: true,
      message: "Recent subscribers retrieved successfully",
      recent: recentSubscribers,
      weekly,
      traceId,
    });
  } catch (error) {
    logger.error(`Error fetching recent subscribers: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    return sendError(
      res,
      500,
      "FETCH_RECENT_SUBSCRIBERS_FAILED",
      "Failed to fetch recent subscribers",
      traceId
    );
  }
};

// Activate or renew a user subscription (admin only)
export const activateSubscription = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  try {
    const { userId, subscriptionId } = req.body;
    const sanitizedUserId = sanitize(userId);
    const sanitizedSubscriptionId = sanitize(subscriptionId);

    // Validate inputs
    if (!mongoose.Types.ObjectId.isValid(sanitizedUserId)) {
      logger.warn(`Invalid user ID: ${sanitizedUserId}`, { traceId });
      return sendError(res, 400, "INVALID_USER_ID", "Invalid user ID", traceId);
    }

    if (!mongoose.Types.ObjectId.isValid(sanitizedSubscriptionId)) {
      logger.warn(`Invalid subscription ID: ${sanitizedSubscriptionId}`, {
        traceId,
      });
      return sendError(
        res,
        400,
        "INVALID_SUBSCRIPTION_ID",
        "Invalid subscription ID",
        traceId
      );
    }

    // Fetch subscription and user
    const subscription = await Subscription.findById(sanitizedSubscriptionId);
    if (!subscription) {
      logger.warn(`Subscription not found: ${sanitizedSubscriptionId}`, {
        traceId,
      });
      return sendError(
        res,
        404,
        "SUBSCRIPTION_NOT_FOUND",
        "Subscription not found",
        traceId
      );
    }

    // Validate subscription name
    const validNames = [
      "Basic Plan",
      "Pro Plan",
      "Premium Plan",
      "Gift Plan",
      "Team Plan",
    ];
    if (!subscription.name || !validNames.includes(subscription.name)) {
      logger.error(`Invalid subscription name: ${subscription.name}`, {
        traceId,
        subscription,
      });
      return sendError(
        res,
        400,
        "INVALID_SUBSCRIPTION_NAME",
        `Subscription name must be one of ${validNames.join(", ")}`,
        traceId
      );
    }

    // Log subscription details for debugging
    logger.debug(`Subscription details: ${JSON.stringify(subscription)}`, {
      traceId,
    });

    const user = await User.findById(sanitizedUserId);
    if (!user) {
      logger.warn(`User not found: ${sanitizedUserId}`, { traceId });
      return sendError(res, 404, "USER_NOT_FOUND", "User not found", traceId);
    }

    // Calculate subscription dates
    const startDate = new Date();
    const endDate = new Date(
      startDate.getTime() + subscription.duration * 24 * 60 * 60 * 1000
    );

    // Update user's activeSubscription
    user.activeSubscription = {
      subscriptionId: subscription._id,
      subscriptionName: subscription.name,
      subscriptionType: subscription.type,
      status: "active",
      startDate: startDate,
      endDate: endDate,
      duration: subscription.duration,
    };

    // Save user with validation
    try {
      await user.save({ validateBeforeSave: true });
    } catch (validationError) {
      logger.error(`Validation error saving user: ${validationError.message}`, {
        traceId,
        error: validationError,
      });
      return sendError(
        res,
        400,
        "VALIDATION_ERROR",
        `Failed to save user: ${validationError.message}`,
        traceId
      );
    }

    logger.info(
      `Subscription activated/renewed for user ${sanitizedUserId}: ${sanitizedSubscriptionId}`,
      { traceId }
    );

    res.status(200).json({
      success: true,
      data: {
        userId: user._id.toString(),
        subscriptionId: user.activeSubscription.subscriptionId.toString(),
        name: user.activeSubscription.subscriptionName,
        subscriptionType: user.activeSubscription.subscriptionType,
        status: user.activeSubscription.status,
        startDate: user.activeSubscription.startDate,
        endDate: user.activeSubscription.endDate,
        duration: user.activeSubscription.duration,
      },
      traceId,
    });
  } catch (error) {
    logger.error(`Error activating subscription: ${error.message}`, {
      traceId,
      error,
    });
    return sendError(
      res,
      500,
      "ACTIVATE_SUBSCRIPTION_FAILED",
      error.message || "Failed to activate subscription",
      traceId
    );
  }
};

// Cancel a user subscription (admin only)
export const cancelSubscription = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  try {
    const { userId, subscriptionId } = req.body;
    const sanitizedUserId = sanitize(userId);
    const sanitizedSubscriptionId = sanitize(subscriptionId);

    // Validate inputs
    if (!mongoose.Types.ObjectId.isValid(sanitizedUserId)) {
      logger.warn(`Invalid user ID: ${sanitizedUserId}`, { traceId });
      return sendError(res, 400, "INVALID_USER_ID", "Invalid user ID", traceId);
    }

    if (!mongoose.Types.ObjectId.isValid(sanitizedSubscriptionId)) {
      logger.warn(`Invalid subscription ID: ${sanitizedSubscriptionId}`, {
        traceId,
      });
      return sendError(
        res,
        400,
        "INVALID_SUBSCRIPTION_ID",
        "Invalid subscription ID",
        traceId
      );
    }

    // Fetch user
    const user = await User.findById(sanitizedUserId);
    if (!user) {
      logger.warn(`User not found: ${sanitizedUserId}`, { traceId });
      return sendError(res, 404, "USER_NOT_FOUND", "User not found", traceId);
    }

    // Log activeSubscription state for debugging
    logger.debug(
      `User activeSubscription: ${JSON.stringify(user.activeSubscription)}`,
      { traceId }
    );

    // Check if user has an activeSubscription
    if (!user.activeSubscription || !user.activeSubscription.subscriptionId) {
      logger.warn(`No active subscription found for user: ${sanitizedUserId}`, {
        traceId,
      });
      return sendError(
        res,
        400,
        "NO_SUBSCRIPTION",
        "User has no active subscription",
        traceId
      );
    }

    // Check if subscription is active
    if (user.activeSubscription.status !== "active") {
      logger.warn(`Subscription is not active for user: ${sanitizedUserId}`, {
        traceId,
      });
      return sendError(
        res,
        400,
        "SUBSCRIPTION_NOT_ACTIVE",
        "Subscription is not active",
        traceId
      );
    }

    // Verify subscriptionId
    const userSubscriptionId =
      user.activeSubscription.subscriptionId.toString();
    if (userSubscriptionId !== sanitizedSubscriptionId) {
      logger.warn(
        `Subscription ID mismatch for user: ${sanitizedUserId}, expected: ${sanitizedSubscriptionId}, found: ${userSubscriptionId}`,
        { traceId }
      );
      return sendError(
        res,
        400,
        "SUBSCRIPTION_MISMATCH",
        "Subscription ID does not match user's active subscription",
        traceId
      );
    }

    // Update subscription to cancelled
    user.activeSubscription.status = "cancelled";
    user.activeSubscription.endDate = new Date();

    // Save user with validation
    try {
      await user.save({ validateBeforeSave: true });
    } catch (validationError) {
      logger.error(`Validation error saving user: ${validationError.message}`, {
        traceId,
        error: validationError,
      });
      return sendError(
        res,
        400,
        "VALIDATION_ERROR",
        `Failed to save user: ${validationError.message}`,
        traceId
      );
    }

    logger.info(
      `Subscription cancelled for user ${sanitizedUserId}: ${sanitizedSubscriptionId}`,
      { traceId }
    );

    res.status(200).json({
      success: true,
      data: {
        userId: user._id.toString(),
        subscriptionId: userSubscriptionId,
        name: user.activeSubscription.subscriptionName,
        subscriptionType: user.activeSubscription.subscriptionType,
        status: user.activeSubscription.status,
        endDate: user.activeSubscription.endDate,
      },
      traceId,
    });
  } catch (error) {
    logger.error(`Error cancelling subscription: ${error.message}`, {
      traceId,
      error,
    });
    return sendError(
      res,
      500,
      "CANCEL_SUBSCRIPTION_FAILED",
      error.message || "Failed to cancel subscription",
      traceId
    );
  }
};

// Get all users with subscription details (admin only)
export const getAllUsers = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  try {
    // Fetch all users and populate subscription details
    const users = await User.find({})
      .select("name email activeSubscription")
      .populate({
        path: "activeSubscription.subscriptionId",
        select: "name type duration",
        model: Subscription,
      })
      .lean();

    const allUsers = users.map((user) => {
      // Handle users with no subscription
      if (!user.activeSubscription || !user.activeSubscription.subscriptionId) {
        return {
          userId: user._id.toString(),
          name: user.name || "N/A",
          email: user.email || "N/A",
          subscriptionId: null,
          subscriptionName: user.activeSubscription?.subscriptionName || "No Plan",
          subscriptionType: user.activeSubscription?.subscriptionType || "None",
          subscriptionStatus: user.activeSubscription?.status || "inactive",
          duration: user.activeSubscription?.duration || null,
          startDate: user.activeSubscription?.startDate || null,
          endDate: user.activeSubscription?.endDate || null,
        };
      }

      // Handle users with a subscription
      return {
        userId: user._id.toString(),
        name: user.name || "N/A",
        email: user.email || "N/A",
        subscriptionId:
          user.activeSubscription.subscriptionId?._id.toString() || null,
        subscriptionName:
          user.activeSubscription.subscriptionName ||
          user.activeSubscription.subscriptionId.name ||
          "No Plan",
        subscriptionType:
          user.activeSubscription.subscriptionType ||
          user.activeSubscription.subscriptionId.type ||
          "None",
        subscriptionStatus: user.activeSubscription.status || "inactive",
        duration:
          user.activeSubscription.duration ||
          user.activeSubscription.subscriptionId.duration ||
          null,
        startDate: user.activeSubscription.startDate || null,
        endDate: user.activeSubscription.endDate || null,
      };
    });

    logger.info(`Fetched ${allUsers.length} users`, { traceId });

    res.status(200).json({
      success: true,
      data: allUsers,
      traceId,
    });
  } catch (error) {
    logger.error(`Error fetching users: ${error.message}`, { traceId });
    return sendError(
      res,
      500,
      "FETCH_USERS_FAILED",
      error.message || "Failed to fetch users",
      traceId
    );
  }
};

// Search subscribers by name or email (admin only)
export const searchSubscribers = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  try {
    const { query } = req.query;
    const sanitizedQuery = sanitize(query)?.trim();

    // Validate query
    if (
      !sanitizedQuery ||
      typeof sanitizedQuery !== "string" ||
      sanitizedQuery.length === 0
    ) {
      logger.warn("Invalid or empty search query", { traceId });
      return sendError(
        res,
        400,
        "INVALID_QUERY",
        "Search query must be a non-empty string",
        traceId
      );
    }

    // Escape special regex characters to prevent regex injection
    const escapedQuery = sanitizedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Search users by name or email
    const users = await User.find({
      $or: [
        { name: { $regex: escapedQuery, $options: "i" } },
        { email: { $regex: escapedQuery, $options: "i" } },
      ],
    })
      .select("name email activeSubscription")
      .populate({
        path: "activeSubscription.subscriptionId",
        select: "name type duration",
        model: Subscription,
      })
      .lean();

    const subscribers = users.map((user) => ({
      userId: user._id.toString(),
      name: user.name || "N/A",
      email: user.email || "N/A",
      subscriptionId:
        user.activeSubscription?.subscriptionId?._id.toString() || null,
      subscriptionName: user.activeSubscription?.name || "No Plan",
      subscriptionType: user.activeSubscription?.type || "None",
      subscriptionStatus: user.activeSubscription?.status || "inactive",
      duration: user.activeSubscription?.duration || null,
      startDate: user.activeSubscription?.startDate || null,
      endDate: user.activeSubscription?.endDate || null,
    }));

    logger.info(
      `Found ${subscribers.length} users matching query: ${sanitizedQuery}`,
      { traceId }
    );

    res.status(200).json({
      success: true,
      data: subscribers,
      traceId,
    });
  } catch (error) {
    logger.error(`Error searching subscribers: ${error.message}`, { traceId });
    return sendError(
      res,
      500,
      "SEARCH_SUBSCRIBERS_FAILED",
      error.message || "Failed to search subscribers",
      traceId
    );
  }
};
