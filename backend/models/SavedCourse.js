import mongoose from "mongoose";
import { logger } from "../utils/logger.js";

// Saved Course Schema
const savedCourseSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: [true, "Course ID is required"],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    collection: "saved_courses"
  }
);

// Ensure unique combination of userId and courseId
savedCourseSchema.index({ userId: 1, courseId: 1 }, { unique: true });

// Pre-save hook for validation
savedCourseSchema.pre("save", async function (next) {
  try {
    // Validate that the referenced User exists
    const user = await mongoose.model("User").findById(this.userId);
    if (!user) {
      logger.error(`User not found for saved course: ${this.userId}`);
      return next(new Error("User not found"));
    }

    // Validate that the referenced Course exists
    const course = await mongoose.model("Course").findById(this.courseId);
    if (!course) {
      logger.error(`Course not found for saved course: ${this.courseId}`);
      return next(new Error("Course not found"));
    }

    logger.info(`Saving course ${this.courseId} for user ${this.userId}`);
    next();
  } catch (error) {
    logger.error(`Saved course validation failed: ${error.message}`, {
      userId: this.userId,
      courseId: this.courseId,
      stack: error.stack,
    });
    next(error);
  }
});

// Static method to find saved courses by user
savedCourseSchema.statics.findByUserId = async function (userId) {
  try {
    const savedCourses = await this.find({ userId })
      .populate({
        path: "courseId",
        select: "title imageUrl newPrice duration",
      })
      .lean();
    logger.info(`Found ${savedCourses.length} saved courses for user: ${userId}`);
    return savedCourses;
  } catch (error) {
    logger.error(`Failed to find saved courses for user ${userId}: ${error.message}`, {
      stack: error.stack,
    });
    throw new Error(`Failed to find saved courses: ${error.message}`);
  }
};

// Create and export SavedCourse model
const SavedCourse = mongoose.model("SavedCourse", savedCourseSchema);
export default SavedCourse;