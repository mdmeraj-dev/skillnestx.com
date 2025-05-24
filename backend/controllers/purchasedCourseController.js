import asyncHandler from "express-async-handler";
import User from "../models/User.js";
import { logger } from "../utils/logger.js";
import { sendError } from "../middleware/authMiddleware.js";

// Fetch purchased courses for the authenticated user
export const getPurchasedCourses = asyncHandler(async (req, res) => {
  const traceId = req.headers?.["x-trace-id"] || crypto.randomUUID();

  // Validate authenticated user
  if (!req.user || !req.user.userId) {
    logger.error("No authenticated user found in getPurchasedCourses", { traceId });
    return sendError(res, 401, "UNAUTHENTICATED", "Authentication required", traceId);
  }

  try {
    // Fetch user with purchasedCourses
    const user = await User.findById(req.user.userId)
      .select("purchasedCourses")
      .lean();

    if (!user) {
      logger.warn(`User not found for ID: ${req.user.userId}`, { traceId });
      return sendError(res, 404, "USER_NOT_FOUND", "User not found", traceId);
    }

    if (user.isBanned) {
      logger.warn(`User is banned: ${req.user.userId}`, { traceId });
      return sendError(res, 403, "USER_BANNED", "Your account is banned. Please contact support", traceId);
    }

    // Extract purchased courses (default to empty array if none)
    const purchasedCourses = user.purchasedCourses || [];

    // Format courses for frontend
    const formattedCourses = purchasedCourses.map((course) => ({
      courseId: course.courseId.toString(),
      courseName: course.courseName,
      startDate: course.startDate,
      duration: course.duration,
      completionStatus: course.completionStatus,
      lastAccessed: course.lastAccessed,
      endDate: course.endDate,
    }));

    logger.info(`Fetched ${purchasedCourses.length} purchased courses for user: ${req.user.email}`, {
      traceId,
      userId: req.user.userId,
    });

    return res.status(200).json({
      success: true,
      message: "Purchased courses retrieved successfully",
      courses: formattedCourses,
      traceId,
    });
  } catch (error) {
    logger.error(`Error fetching purchased courses for user ${req.user.userId}: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    return sendError(res, 500, "SERVER_ERROR", "Internal server error", traceId);
  }
});