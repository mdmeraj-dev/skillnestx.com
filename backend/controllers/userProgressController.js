import UserProgress from "../models/UserProgress.js";
import Course from "../models/Course.js";
import { logger } from "../utils/logger.js";
import mongoose from "mongoose"; // Added for ObjectId validation

export const getCourseProgress = async (req, res, next) => {
  const { courseId } = req.params;
  const userId = req.user.userId; // Use authenticated user ID
  const traceId = req.traceId;
  try {
    logger.info("getCourseProgress: Starting", { traceId, userId, courseId });

    // Find course
    const course = await Course.findById(courseId);
    if (!course) {
      logger.warn("getCourseProgress: Course not found", { traceId, courseId });
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Course not found",
        traceId,
      });
    }

    // Find progress
    const progress = await UserProgress.findOne({ userId, courseId });
    const totalLessons = course.syllabus.reduce(
      (sum, section) => sum + (section.lessons?.length || 0),
      0
    );
    const completedLessons = progress?.completedLessons || [];
    const progressPercentage = totalLessons
      ? (completedLessons.length / totalLessons) * 100
      : 0;

    logger.info("getCourseProgress: Success", {
      traceId,
      totalLessons,
      completedLessons: completedLessons.length,
      progressPercentage,
      isCompleted: progress?.isCompleted || false,
    });

    return res.status(200).json({
      success: true,
      data: {
        courseProgress: {
          completedLessons,
          totalLessons,
          progressPercentage: Number(progressPercentage.toFixed(2)),
          isCompleted: progress?.isCompleted || false,
          completedAt: progress?.completedAt,
          courseTitle: course.title,
        },
      },
      traceId,
    });
  } catch (err) {
    logger.error("getCourseProgress: Error", { traceId, error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: "Server error",
      traceId,
    });
  }
};

export const markLessonCompleted = async (req, res, next) => {
  const { courseId, lessonId } = req.body;
  const userId = req.user.userId; // Use authenticated user ID
  const traceId = req.traceId;
  try {
    logger.info("markLessonCompleted: Starting", { traceId, userId, courseId, lessonId });

    // Find course
    const course = await Course.findById(courseId);
    if (!course) {
      logger.warn("markLessonCompleted: Course not found", { traceId, courseId });
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Course not found",
        traceId,
      });
    }

    // Verify lesson exists
    const lessonExists = course.syllabus.some((section) =>
      section.lessons.some((lesson) => lesson._id.toString() === lessonId)
    );
    if (!lessonExists) {
      logger.warn("markLessonCompleted: Lesson not found", { traceId, lessonId });
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Lesson not found",
        traceId,
      });
    }

    // Update progress
    let progress = await UserProgress.findOne({ userId, courseId });
    if (!progress) {
      progress = new UserProgress({ userId, courseId, completedLessons: [], isCompleted: false });
    }
    if (!progress.completedLessons.includes(lessonId)) {
      progress.completedLessons.push(lessonId);
      await progress.save();
    }

    const totalLessons = course.syllabus.reduce(
      (sum, section) => sum + (section.lessons?.length || 0),
      0
    );
    const progressPercentage = totalLessons
      ? (progress.completedLessons.length / totalLessons) * 100
      : 0;

    logger.info("markLessonCompleted: Success", {
      traceId,
      totalLessons,
      completedLessons: progress.completedLessons.length,
      progressPercentage,
      isCompleted: progress.isCompleted,
    });

    return res.status(200).json({
      success: true,
      data: {
        courseProgress: {
          completedLessons: progress.completedLessons,
          totalLessons,
          progressPercentage: Number(progressPercentage.toFixed(2)),
          isCompleted: progress.isCompleted,
          completedAt: progress.completedAt,
          courseTitle: course.title,
        },
      },
      traceId,
    });
  } catch (err) {
    logger.error("markLessonCompleted: Error", { traceId, error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: "Server error",
      traceId,
    });
  }
};

export const markCourseCompleted = async (req, res) => {
  const traceId = req.traceId || Date.now().toString(36);
  try {
    const userId = req.user.userId; // From auth middleware
    const { courseId } = req.body;

    if (!courseId) {
      logger.warn(`markCourseCompleted: Missing courseId`, { traceId, userId });
      return res.status(400).json({
        success: false,
        code: "BAD_REQUEST",
        message: "Course ID is required",
        traceId,
      });
    }

    // Verify course exists
    const course = await Course.findById(courseId);
    if (!course) {
      logger.warn(`markCourseCompleted: Course not found`, { traceId, courseId });
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Course not found",
        traceId,
      });
    }

    // Update progress
    const progress = await UserProgress.findOneAndUpdate(
      { userId, courseId },
      { 
        $set: { 
          isCompleted: true,
          completedAt: new Date(),
          updatedAt: new Date(),
        }
      },
      { new: true, upsert: true }
    );

    logger.info(`markCourseCompleted: Success`, { traceId, userId, courseId });
    return res.status(200).json({
      success: true,
      message: "Course marked as completed",
      data: {
        courseProgress: {
          courseId: progress.courseId,
          isCompleted: progress.isCompleted,
          completedAt: progress.completedAt,
          completedLessons: progress.completedLessons,
          courseTitle: course.title,
        },
      },
      traceId,
    });
  } catch (error) {
    logger.error(`markCourseCompleted: Error`, { traceId, error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: "Internal server error",
      traceId,
    });
  }
};

export const getCompletedCourses = async (req, res) => {
  const traceId = req.traceId || Date.now().toString(36);
  try {
    const { userId } = req.params;

    // Fetch completed courses
    const completedProgress = await UserProgress.find({ 
      userId, 
      isCompleted: true 
    }).lean();

    // Fetch course details
    const completedCourses = await Promise.all(
      completedProgress.map(async (progress) => {
        const course = await Course.findById(progress.courseId).select("title").lean();
        return {
          courseId: progress.courseId,
          title: course?.title || "Untitled Course",
          completedAt: progress.completedAt || progress.updatedAt,
        };
      })
    );

    logger.info(`getCompletedCourses: Success`, { traceId, userId, count: completedCourses.length });
    return res.status(200).json({
      success: true,
      message: "Completed courses retrieved",
      data: completedCourses,
      traceId,
    });
  } catch (error) {
    logger.error(`getCompletedCourses: Error`, { traceId, error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: "Internal server error",
      traceId,
    });
  }
};

export const getInProgressCourses = async (req, res) => {
  const traceId = req.traceId || Date.now().toString(36);
  try {
    const { userId } = req.params;

    // Validate userId
    if (!userId || !mongoose.isValidObjectId(userId)) {
      logger.warn("getInProgressCourses: Invalid userId", { traceId, userId });
      return res.status(400).json({
        success: false,
        code: "BAD_REQUEST",
        message: "Invalid user ID",
        traceId,
      });
    }

    // Fetch UserProgress records with at least one completed lesson
    const progressRecords = await UserProgress.find({
      userId,
      completedLessons: { $ne: [] }, // At least one lesson completed
    }).lean();

    if (!progressRecords || progressRecords.length === 0) {
      logger.info("getInProgressCourses: No in-progress courses found", { traceId, userId });
      return res.status(200).json({
        success: true,
        data: [],
        message: "No in-progress courses found",
        traceId,
      });
    }

    // Fetch course details and calculate progress
    const inProgressCourses = await Promise.all(
      progressRecords.map(async (progress) => {
        const course = await Course.findById(progress.courseId).select("title imageUrl syllabus duration newPrice").lean();
        if (!course) {
          logger.warn("getInProgressCourses: Course not found", {
            traceId,
            courseId: progress.courseId,
          });
          return null;
        }

        const totalLessons = course.syllabus.reduce(
          (sum, section) => sum + (section.lessons?.length || 0),
          0
        );
        const completedLessonsCount = progress.completedLessons.length;
        const progressPercentage = totalLessons
          ? (completedLessonsCount / totalLessons) * 100
          : 0;

        return {
          courseId: progress.courseId,
          courseTitle: course.title,
          imageUrl: course.imageUrl,
          progressPercentage: Number(progressPercentage.toFixed(2)),
          completedLessons: progress.completedLessons,
          isCompleted: progress.isCompleted,
          duration: course.duration || "1 Year",
          newPrice: course.newPrice || 0,
        };
      })
    );

    // Filter out null results (courses not found)
    const validCourses = inProgressCourses.filter((course) => course !== null);

    logger.info("getInProgressCourses: Success", {
      traceId,
      userId,
      count: validCourses.length,
    });

    return res.status(200).json({
      success: true,
      message: "In-progress courses retrieved",
      data: validCourses,
      traceId,
    });
  } catch (error) {
    logger.error("getInProgressCourses: Error", {
      traceId,
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: "Server error while fetching in-progress courses",
      traceId,
    });
  }
};