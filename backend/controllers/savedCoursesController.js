import SavedCourse from "../models/SavedCourse.js";
import Course from "../models/Course.js";
import { logger } from "../utils/logger.js";
import { sendError } from "../middleware/authMiddleware.js";
import mongoose from "mongoose";

// Toggle saved course (save or unsave based on current state)
export const toggleSavedCourse = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || Date.now().toString(36);
  try {
    const { courseId } = req.body;
    const userId = req.user?.userId;

    // Validate input
    if (!courseId || !mongoose.isValidObjectId(courseId)) {
      logger.warn(`Toggle saved course failed: Invalid or missing courseId`, { traceId, userId });
      return sendError(res, 400, "INVALID_INPUT", "Valid courseId is required", traceId);
    }

    // Check if course exists
    const course = await Course.findById(courseId).select("_id");
    if (!course) {
      logger.warn(`Toggle saved course failed: Course not found`, { traceId, userId, courseId });
      return sendError(res, 404, "COURSE_NOT_FOUND", "Course not found", traceId);
    }

    // Check if course is already saved
    const existingSavedCourse = await SavedCourse.findOne({ userId, courseId });

    if (existingSavedCourse) {
      // If already saved, remove it
      await SavedCourse.deleteOne({ _id: existingSavedCourse._id });
      logger.info(`Course ${courseId} removed from saved courses for user ${userId}`, { traceId });
      return res.status(200).json({
        success: true,
        message: "Course removed from saved courses",
        isSaved: false,
        traceId,
      });
    } else {
      // If not saved, add it
      const savedCourse = new SavedCourse({ userId, courseId });
      await savedCourse.save();
      logger.info(`Course ${courseId} saved for user ${userId}`, { traceId });
      return res.status(201).json({
        success: true,
        message: "Course saved successfully",
        isSaved: true,
        traceId,
      });
    }
  } catch (error) {
    logger.error(`Toggle saved course error: ${error.message}`, { traceId, userId, courseId, stack: error.stack });
    return sendError(res, 500, "SERVER_ERROR", "Internal server error", traceId);
  }
};

// Get all saved courses for the authenticated user
export const getSavedCourses = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || Date.now().toString(36);
  try {
    const userId = req.user?.userId;

    const savedCourses = await SavedCourse.findByUserId(userId);
    logger.info(`Retrieved ${savedCourses.length} saved courses for user ${userId}`, { traceId });

    return res.status(200).json({
      success: true,
      message: "Saved courses retrieved successfully",
      data: savedCourses.map((savedCourse) => ({
        _id: savedCourse.courseId._id,
        title: savedCourse.courseId.title,
        imageUrl: savedCourse.courseId.imageUrl,
        newPrice: savedCourse.courseId.newPrice,
        duration: savedCourse.courseId.duration,
      })),
      traceId,
    });
  } catch (error) {
    logger.error(`Get saved courses error: ${error.message}`, { traceId, userId, stack: error.stack });
    return sendError(res, 500, "SERVER_ERROR", "Internal server error", traceId);
  }
};

// Remove a specific saved course
export const removeSavedCourse = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || Date.now().toString(36);
  try {
    const { courseId } = req.params;
    const userId = req.user?.userId;

    // Validate input
    if (!courseId || !mongoose.isValidObjectId(courseId)) {
      logger.warn(`Remove saved course failed: Invalid or missing courseId`, { traceId, userId });
      return sendError(res, 400, "INVALID_INPUT", "Valid courseId is required", traceId);
    }

    // Check if saved course exists
    const savedCourse = await SavedCourse.findOne({ userId, courseId });
    if (!savedCourse) {
      logger.warn(`Remove saved course failed: Course not saved`, { traceId, userId, courseId });
      return sendError(res, 404, "SAVED_COURSE_NOT_FOUND", "Course not found in saved courses", traceId);
    }

    await SavedCourse.deleteOne({ _id: savedCourse._id });
    logger.info(`Course ${courseId} removed from saved courses for user ${userId}`, { traceId });

    return res.status(200).json({
      success: true,
      message: "Course removed from saved courses",
      traceId,
    });
  } catch (error) {
    logger.error(`Remove saved course error: ${error.message}`, { traceId, userId, courseId, stack: error.stack });
    return sendError(res, 500, "SERVER_ERROR", "Internal server error", traceId);
  }
};