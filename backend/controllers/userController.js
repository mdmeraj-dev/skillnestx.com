import User from "../models/User.js";
import Course from "../models/Course.js"; // Course model
import Subscription from "../models/Subscription.js"; // Subscription model
import { sendEmail, TEMPLATE_TYPES } from "../utils/sendEmail.js";
import { logger } from "../utils/logger.js";
import validator from "validator";
import { sendError } from "../middleware/authMiddleware.js";

// Utility to format date for email templates
const formatDate = (date) => {
  const now = new Date(date);
  let hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "pm" : "am";
  hours = hours % 12 || 12;
  const time = `${hours}:${minutes} ${ampm}`;
  return `${now.getDate().toString().padStart(2, "0")}-${(now.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${now.getFullYear()} at ${time}`;
};

// Helper to send emails with error handling
const sendNotificationEmail = async ({
  email,
  name,
  templateType,
  templateData,
  traceId,
}) => {
  try {
    await sendEmail({
      email,
      name,
      templateType,
      templateData: {
        ...templateData,
        support_email: process.env.SUPPORT_EMAIL || "support@skillnestx.com",
        company_name: "SkillNestX",
        frontend_url: process.env.VITE_FRONTEND_URL || "http://localhost:5173",
      },
      traceId,
    });
    return {
      success: true,
      message: `${templateType.split("_").join(" ")} email sent`,
    };
  } catch (emailError) {
    logger.warn(
      `${templateType} email failed for ${email}: ${emailError.message}`,
      {
        traceId,
        stack: emailError.stack,
      }
    );
    return {
      success: false,
      message: `Failed to send ${templateType.split("_").join(" ").toLowerCase()} email`,
    };
  }
};

// Get current user details
export const getCurrentUser = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  try {
    const { userId } = req.user;
    const user = await User.findById(userId)
      .select("-password -refreshToken -__v")
      .populate({
        path: "purchasedCourses.courseId",
        select: "title image",
        model: Course,
      })
      .populate({
        path: "activeSubscription.subscriptionId",
        select: "name newPrice",
        model: Subscription,
      })
      .lean();

    if (!user) {
      logger.warn(`Get current user failed for userId ${userId}: User not found`, { traceId });
      return sendError(res, 404, "NOT_FOUND", "User not found", traceId);
    }

    // Log user data for debugging
    logger.debug(`User data: ${JSON.stringify(user)}`, { traceId });

    // Transform purchasedCourses for frontend
    const formattedPurchasedCourses = user.purchasedCourses?.map((course) => ({
      courseId: course.courseId?._id || course.courseId || null,
      title: course.courseId?.title || course.courseName || "Untitled Course",
      purchasedAt: course.startDate || null,
      endDate: course.endDate || null,
      duration: course.duration || null,
    })) || [];

    // Transform activeSubscription for frontend
    const formattedActiveSubscription = {
      subscriptionId: user.activeSubscription?.subscriptionId?._id || user.activeSubscription?.subscriptionId || null,
      subscriptionName: user.activeSubscription?.subscriptionName || user.activeSubscription?.subscriptionId?.name || "No Plan",
      subscriptionType: user.activeSubscription?.subscriptionType || "None",
      status: user.activeSubscription?.status || "inactive",
      startDate: user.activeSubscription?.startDate || null,
      endDate: user.activeSubscription?.endDate || null,
      duration: user.activeSubscription?.duration || null,
      price: user.activeSubscription?.subscriptionId?.newPrice || 0,
    };

    // Construct formatted user object
    const formattedUser = {
      _id: user._id,
      name: user.name || "",
      email: user.email || "",
      googleId: user.googleId || null,
      provider: user.provider || "unknown",
      role: user.role || "user",
      isBanned: user.isBanned || false,
      transactions: user.transactions || [],
      profilePicture: user.profilePicture || "/assets/avatars/default.svg",
      bio: user.bio || "",
      isVerified: user.isVerified || false,
      lastLogin: user.lastLogin || null,
      lastActive: user.lastActive || null,
      refreshTokenExpiry: user.refreshTokenExpiry || null,
      createdAt: user.createdAt || null,
      updatedAt: user.updatedAt || null,
      purchasedCourses: formattedPurchasedCourses,
      activeSubscription: formattedActiveSubscription,
    };

    logger.info(`Current user retrieved for userId ${userId}`, { traceId });
    return res.status(200).json({
      success: true,
      message: "User retrieved successfully",
      user: formattedUser,
      tokens: res.locals.newTokens || null,
      traceId,
    });
  } catch (error) {
    logger.error(
      `Get current user error for userId ${req.user?.userId || "unknown"}: ${error.message}`,
      { traceId, stack: error.stack }
    );
    return sendError(
      res,
      500,
      "SERVER_ERROR",
      "Internal server error",
      traceId
    );
  }
};

export const updateProfile = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || Date.now().toString(36);
  try {
    const { userId } = req.user;
    const user = await User.findById(userId);
    if (!user) {
      logger.warn(
        `Update profile failed for userId ${userId}: User not found`,
        { traceId }
      );
      return sendError(res, 404, "NOT_FOUND", "User not found", traceId);
    }

    const { name, email, mobileNumber, profilePicture, bio, password } =
      req.body;
    const updates = {};

    if (name?.trim()) updates.name = name.trim();
    if (email?.trim()) {
      if (user.provider === "google") {
        return sendError(
          res,
          400,
          "PROVIDER_MISMATCH",
          "This email is managed by Google. So update email via Google",
          traceId
        );
      }
      const exactEmail = email.trim().toLowerCase();
      if (!validator.isEmail(exactEmail)) {
        logger.warn(
          `Update profile failed: Invalid email format for ${exactEmail}`,
          { traceId }
        );
        return sendError(
          res,
          400,
          "INVALID_EMAIL",
          "Invalid email format",
          traceId
        );
      }
      if (exactEmail !== user.email) {
        const existingUser = await User.findOne({ email: exactEmail });
        if (existingUser && existingUser._id.toString() !== userId) {
          return sendError(
            res,
            400,
            "EMAIL_EXISTS",
            "Email already in use",
            traceId
          );
        }
        updates.email = exactEmail;
      }
    }
    if (mobileNumber !== undefined) {
      const trimmedMobile = mobileNumber?.trim() || "";
      if (trimmedMobile && !validator.isMobilePhone(trimmedMobile, "any")) {
        logger.warn(
          `Update profile failed: Invalid mobile number for ${trimmedMobile}`,
          { traceId }
        );
        return sendError(
          res,
          400,
          "INVALID_MOBILE",
          "Invalid mobile number format",
          traceId
        );
      }
      updates.mobileNumber = trimmedMobile;
    }
    if (profilePicture !== undefined) {
      updates.profilePicture =
        profilePicture?.trim() || "/assets/avatars/default.svg";
    }
    if (bio !== undefined) {
      updates.bio = bio?.trim() || "";
    }
    if (password?.trim()) {
      if (user.provider === "google") {
        return sendError(
          res,
          400,
          "PROVIDER_MISMATCH",
          "Google users cannot set passwords. Use Google login.",
          traceId
        );
      }
      if (password.length < 8) {
        logger.warn(
          `Update profile failed: Password too short for userId ${userId}`,
          { traceId }
        );
        return sendError(
          res,
          400,
          "INVALID_PASSWORD",
          "Password must be at least 8 characters",
          traceId
        );
      }
      updates.password = password;
    }

    if (Object.keys(updates).length === 0) {
      return sendError(
        res,
        400,
        "INVALID_INPUT",
        "No valid fields provided",
        traceId
      );
    }

    const originalEmail = user.email;
    const needsTokenRefresh = updates.email || updates.password;
    if (needsTokenRefresh) {
      await user.invalidateAllTokens();
    }

    Object.assign(user, updates);
    await user.save();

    let emailStatus = { success: true, message: "No email sent" };
    const changedFields = Object.keys(updates);
    if (changedFields.length > 0 && !(changedFields.length === 1 && changedFields[0] === "profilePicture")) {
      const fieldNames = changedFields.map((field) =>
        field === "mobileNumber"
          ? "mobile number"
          : field === "profilePicture"
            ? "profile picture"
            : field
      );
      const changedFieldsMessage =
        fieldNames.length === 1
          ? fieldNames[0]
          : fieldNames.length === 2
            ? `${fieldNames[0]} and ${fieldNames[1]}`
            : `${fieldNames.slice(0, -1).join(", ")}, and ${fieldNames[fieldNames.length - 1]}`;
      const hasHave = fieldNames.length > 1 ? "have" : "has";
      const emailChanged = updates.email
        ? `You can now use your new email address ${user.email} to log in.`
        : "";
      const emailToNotify = updates.email ? originalEmail : user.email;

      emailStatus = await sendNotificationEmail({
        email: emailToNotify,
        name: user.name,
        templateType: TEMPLATE_TYPES.PROFILE_UPDATE,
        templateData: {
          changed_fields: changedFieldsMessage,
          has_have: hasHave,
          email_changed: emailChanged,
        },
        traceId,
      });
    }

    logger.info(`Profile updated for userId ${userId}`, {
      traceId,
      updatedFields: changedFields,
    });
    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        mobileNumber: user.mobileNumber,
        profilePicture: user.profilePicture,
        bio: user.bio,
        isVerified: user.isVerified,
        role: user.role,
        subscriptionName: user.subscriptionName,
        subscriptionStatus: user.subscriptionStatus,
        purchasedCourses: user.purchasedCourses,
      },
      emailStatus,
      tokens: res.locals.newTokens,
      traceId,
      needsRefresh: needsTokenRefresh,
    });
  } catch (error) {
    if (error.code === 11000) {
      logger.warn(
        `Update profile failed: Duplicate field for userId ${req.user?.userId || "unknown"}`,
        { traceId }
      );
      return sendError(
        res,
        400,
        "DUPLICATE_FIELD",
        "Email or mobile number already in use",
        traceId
      );
    }
    logger.error(
      `Update profile error for userId ${req.user?.userId || "unknown"}: ${error.message}`,
      {
        traceId,
        stack: error.stack,
      }
    );
    return sendError(
      res,
      500,
      "SERVER_ERROR",
      "Internal server error",
      traceId
    );
  }
};

export const deleteAccount = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || Date.now().toString(36);
  try {
    const { userId } = req.user;
    const user = await User.findById(userId);
    if (!user) {
      logger.warn(
        `Delete account failed for userId ${userId}: User not found`,
        { traceId }
      );
      return sendError(res, 404, "NOT_FOUND", "User not found", traceId);
    }

    const email = user.email;
    const name = user.name;
    await user.deleteOne();

    const emailStatus = await sendNotificationEmail({
      email,
      name,
      templateType: TEMPLATE_TYPES.ACCOUNT_DELETION,
      templateData: {
        user_name: name,
        deletion_date: formatDate(new Date()),
      },
      traceId,
    });

    logger.info(`Account deleted for userId ${userId}`, { traceId });
    return res.status(200).json({
      success: true,
      message: "Account deleted successfully",
      emailStatus,
      tokens: res.locals.newTokens,
      traceId,
      needsRefresh: true,
    });
  } catch (error) {
    logger.error(
      `Delete account error for userId ${req.user?.userId || "unknown"}: ${error.message}`,
      {
        traceId,
        stack: error.stack,
      }
    );
    return sendError(
      res,
      500,
      "SERVER_ERROR",
      "Internal server error",
      traceId
    );
  }
};

export const getAllUsers = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || Date.now().toString(36);
  try {
    const { page = 1, limit = 10 } = req.query;
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);

    if (pageNumber < 1 || limitNumber < 1) {
      logger.warn("Invalid pagination parameters", { traceId, page, limit });
      return sendError(
        res,
        400,
        "INVALID_INPUT",
        "Invalid pagination parameters",
        traceId
      );
    }

    const users = await User.find()
      .select(
        "_id name email role isBanned createdAt subscriptionName subscriptionStatus purchasedCourses"
      )
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .lean();

    const totalUsers = await User.countDocuments();

    logger.info(`Fetched ${users.length} users for admin`, { traceId });
    return res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      users,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total: totalUsers,
        totalPages: Math.ceil(totalUsers / limitNumber),
      },
      tokens: res.locals.newTokens,
      traceId,
    });
  } catch (error) {
    logger.error(`Get all users error: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    return sendError(
      res,
      500,
      "SERVER_ERROR",
      "Internal server error",
      traceId
    );
  }
};

export const searchUsers = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || Date.now().toString(36);
  try {
    const { query, page = 1, limit = 10 } = req.query;
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);

    if (!query?.trim()) {
      logger.warn("Search users failed: Query is required", { traceId });
      return sendError(
        res,
        400,
        "INVALID_INPUT",
        "Search query is required",
        traceId
      );
    }

    if (pageNumber < 1 || limitNumber < 1) {
      logger.warn("Invalid pagination parameters", { traceId, page, limit });
      return sendError(
        res,
        400,
        "INVALID_INPUT",
        "Invalid pagination parameters",
        traceId
      );
    }

    const searchQuery = query.trim();
    const users = await User.find({
      $or: [
        { name: { $regex: searchQuery, $options: "i" } },
        { email: { $regex: searchQuery, $options: "i" } },
      ],
    })
      .select(
        "_id name email role isBanned createdAt subscriptionName subscriptionStatus purchasedCourses"
      )
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .lean();

    const totalUsers = await User.countDocuments({
      $or: [
        { name: { $regex: searchQuery, $options: "i" } },
        { email: { $regex: searchQuery, $options: "i" } },
      ],
    });

    if (users.length === 0) {
      logger.info(`No users found for query: ${searchQuery}`, { traceId });
      return res.status(200).json({
        success: true,
        code: "NO_RESULTS",
        message: "No users found with this name or email",
        users: [],
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          total: 0,
          totalPages: 0,
        },
        tokens: res.locals.newTokens,
        traceId,
      });
    }

    logger.info(`Searched ${users.length} users for query: ${searchQuery}`, {
      traceId,
    });
    return res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      users,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total: totalUsers,
        totalPages: Math.ceil(totalUsers / limitNumber),
      },
      tokens: res.locals.newTokens,
      traceId,
    });
  } catch (error) {
    logger.error(`Search users error: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    return sendError(
      res,
      500,
      "SERVER_ERROR",
      "Internal server error",
      traceId
    );
  }
};

export const deleteUser = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || Date.now().toString(36);
  try {
    const { userId } = req.params;
    if (!validator.isMongoId(userId)) {
      logger.warn("Delete user failed: Invalid user ID", { traceId, userId });
      return sendError(
        res,
        400,
        "INVALID_INPUT",
        "Valid user ID is required",
        traceId
      );
    }

    const user = await User.findById(userId);
    if (!user) {
      logger.warn(`Delete user failed: User not found for ID ${userId}`, {
        traceId,
      });
      return sendError(res, 404, "NOT_FOUND", "User not found", traceId);
    }

    if (user.role === "admin") {
      logger.warn(`Delete user failed: Cannot delete admin user ${userId}`, {
        traceId,
      });
      return sendError(
        res,
        403,
        "FORBIDDEN",
        "Cannot delete admin users",
        traceId
      );
    }

    const email = user.email;
    const name = user.name;
    await user.deleteOne();

    const emailStatus = await sendNotificationEmail({
      email,
      name,
      templateType: TEMPLATE_TYPES.ACCOUNT_DELETION,
      templateData: {
        user_name: name,
        deletion_date: formatDate(new Date()),
        reason: "Your account was removed by an administrator",
      },
      traceId,
    });

    logger.info(`User deleted by admin: ${userId}`, { traceId });
    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
      emailStatus,
      tokens: res.locals.newTokens,
      traceId,
      needsRefresh: userId === req.user.userId,
    });
  } catch (error) {
    logger.error(`Delete user error: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    return sendError(
      res,
      500,
      "SERVER_ERROR",
      "Internal server error",
      traceId
    );
  }
};

export const toggleUserBan = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || Date.now().toString(36);
  try {
    const { userId } = req.params;
    if (!validator.isMongoId(userId)) {
      logger.warn("Toggle user ban failed: Invalid user ID", {
        traceId,
        userId,
      });
      return sendError(
        res,
        400,
        "INVALID_INPUT",
        "Valid user ID is required",
        traceId
      );
    }

    if (userId === req.user.userId) {
      logger.warn(`Toggle user ban failed: Cannot ban self ${userId}`, {
        traceId,
      });
      return sendError(
        res,
        403,
        "SELF_BAN",
        "Cannot ban your own account",
        traceId
      );
    }

    const user = await User.findById(userId);
    if (!user) {
      logger.warn(`Toggle user ban failed: User not found for ID ${userId}`, {
        traceId,
      });
      return sendError(res, 404, "NOT_FOUND", "User not found", traceId);
    }

    if (user.role === "admin") {
      logger.warn(`Toggle user ban failed: Cannot ban admin user ${userId}`, {
        traceId,
      });
      return sendError(
        res,
        403,
        "FORBIDDEN",
        "Cannot ban admin users",
        traceId
      );
    }

    const isBanning = !user.isBanned;
    user.isBanned = isBanning;
    if (isBanning) {
      await user.invalidateAllTokens();
    }
    await user.save();

    logger.info(`User ${isBanning ? "banned" : "unbanned"}: ${userId}`, {
      traceId,
    });
    return res.status(200).json({
      success: true,
      message: `User ${isBanning ? "banned" : "unbanned"} successfully`,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isBanned: user.isBanned,
        subscriptionName: user.subscriptionName,
        subscriptionStatus: user.subscriptionStatus,
      },
      tokens: res.locals.newTokens,
      traceId,
      needsRefresh: isBanning && userId === req.user.userId,
    });
  } catch (error) {
    logger.error(`Toggle user ban error: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    return sendError(
      res,
      500,
      "SERVER_ERROR",
      "Internal server error",
      traceId
    );
  }
};

// Get user details by ID (admin only)
export const getUserDetails = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || Date.now().toString(36);
  try {
    const { userId } = req.params;
    if (!validator.isMongoId(userId)) {
      logger.warn("Get user details failed: Invalid user ID", {
        traceId,
        userId,
      });
      return sendError(
        res,
        400,
        "INVALID_INPUT",
        "Valid user ID is required",
        traceId
      );
    }

    const user = await User.findById(userId)
      .select("-password -refreshToken -__v")
      .populate({
        path: "activeSubscription.subscriptionId",
        select: "name type duration",
        model: Subscription,
      })
      .lean();

    if (!user) {
      logger.warn(`Get user details failed: User not found for ID ${userId}`, {
        traceId,
      });
      return sendError(res, 404, "NOT_FOUND", "User not found", traceId);
    }

    logger.info(`User details retrieved for userId ${userId}`, { traceId });
    return res.status(200).json({
      success: true,
      message: "User details retrieved successfully",
      user,
      tokens: res.locals.newTokens,
      traceId,
    });
  } catch (error) {
    logger.error(`Get user details error: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    return sendError(
      res,
      500,
      "SERVER_ERROR",
      "Internal server error",
      traceId
    );
  }
};

export const getTotalUsers = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || Date.now().toString(36);
  try {
    if (req.user.role !== "admin") {
      logger.warn(`Unauthorized access to getTotalUsers by userId ${req.user.userId}`, { traceId });
      return sendError(res, 403, "FORBIDDEN", "Admin access required", traceId);
    }

    const { year } = req.query;
    const selectedYear = parseInt(year, 10) || new Date().getFullYear();

    if (selectedYear < 2000 || selectedYear > new Date().getFullYear() + 1) {
      logger.warn(`Invalid year parameter: ${year}`, { traceId });
      return sendError(
        res,
        400,
        "INVALID_INPUT",
        "Valid year is required",
        traceId
      );
    }

    const users = await User.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(selectedYear, 0, 1),
            $lte: new Date(selectedYear, 11, 31, 23, 59, 59, 999),
          },
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
    ]);

    const totalUsers = users.reduce((sum, month) => sum + month.count, 0);
    const history = Array(12).fill(0);
    users.forEach((month) => {
      history[month._id - 1] = month.count;
    });

    logger.info(
      `Total users retrieved for year ${selectedYear}: ${totalUsers}`,
      { traceId }
    );
    return res.status(200).json({
      success: true,
      message: "Total users retrieved successfully",
      total: totalUsers,
      history,
      tokens: res.locals.newTokens,
      traceId,
    });
  } catch (error) {
    logger.error(`Get total users error: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    return sendError(
      res,
      500,
      "SERVER_ERROR",
      "Internal server error",
      traceId
    );
  }
};

export const getRecentUsers = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || Date.now().toString(36);
  try {
    if (req.user.role !== "admin") {
      logger.warn(`Unauthorized access to getRecentUsers by userId ${req.user.userId}`, { traceId });
      return sendError(res, 403, "FORBIDDEN", "Admin access required", traceId);
    }

    const { year, month } = req.query;
    const selectedYear = parseInt(year, 10) || new Date().getFullYear();
    const selectedMonth = parseInt(month, 10) || new Date().getMonth() + 1;

    if (selectedYear < 2000 || selectedYear > new Date().getFullYear() + 1) {
      logger.warn(`Invalid year parameter: ${year}`, { traceId });
      return sendError(
        res,
        400,
        "INVALID_INPUT",
        "Valid year is required",
        traceId
      );
    }

    if (selectedMonth < 1 || selectedMonth > 12) {
      logger.warn(`Invalid month parameter: ${month}`, { traceId });
      return sendError(
        res,
        400,
        "INVALID_INPUT",
        "Valid month (1-12) is required",
        traceId
      );
    }

    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const users = await User.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(selectedYear, selectedMonth - 1, 1),
            $lte: new Date(
              selectedYear,
              selectedMonth - 1,
              daysInMonth,
              23,
              59,
              59,
              999
            ),
          },
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

    const recentUsers = users.reduce((sum, day) => sum + day.count, 0);
    const daily = Array(daysInMonth).fill(0);
    users.forEach((day) => {
      daily[day._id - 1] = day.count;
    });

    logger.info(
      `Recent users retrieved for ${selectedYear}-${selectedMonth}: ${recentUsers}`,
      { traceId }
    );
    return res.status(200).json({
      success: true,
      message: "Recent users retrieved successfully",
      recent: recentUsers,
      daily,
      tokens: res.locals.newTokens,
      traceId,
    });
  } catch (error) {
    logger.error(`Get recent users error: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    return sendError(
      res,
      500,
      "SERVER_ERROR",
      "Internal server error",
      traceId
    );
  }
};