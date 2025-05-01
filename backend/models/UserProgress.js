import mongoose from "mongoose";
import logger from "../utils/logger.js";

// UserProgress Schema for tracking lesson progress
const userProgressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      validate: {
        validator: async function (userId) {
          const user = await mongoose.model("User").findById(userId);
          return !!user;
        },
        message: "Invalid user ID",
      },
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: [true, "Course ID is required"],
      validate: {
        validator: async function (courseId) {
          const course = await mongoose.model("Course").findById(courseId);
          return !!course;
        },
        message: "Invalid course ID",
      },
    },
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lesson",
      required: [true, "Lesson ID is required"],
      validate: {
        validator: async function (lessonId) {
          const lesson = await mongoose.model("Lesson").findById(lessonId);
          return !!lesson;
        },
        message: "Invalid lesson ID",
      },
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    quizScore: {
      type: Number,
      default: 0,
      min: [0, "Quiz score cannot be negative"],
      max: [100, "Quiz score cannot exceed 100"],
      validate: {
        validator: Number.isInteger,
        message: "Quiz score must be an integer",
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for optimized queries
userProgressSchema.index({ userId: 1, courseId: 1, lessonId: 1 }, { unique: true });
userProgressSchema.index({ userId: 1 });
userProgressSchema.index({ courseId: 1 });

// Pre-validate middleware to ensure data consistency
userProgressSchema.pre("validate", async function (next) {
  try {
    // Validate that lessonId belongs to courseId
    const lesson = await mongoose.model("Lesson").findById(this.lessonId);
    if (!lesson || lesson.courseId.toString() !== this.courseId.toString()) {
      return next(new Error("Lesson does not belong to the specified course"));
    }
    next();
  } catch (error) {
    logger.error(`Error in UserProgress pre-validate: ${error.message}`);
    next(error);
  }
});

// Post-save hook for logging
userProgressSchema.post("save", function (doc) {
  logger.info(
    `UserProgress saved: ${doc._id}, user: ${doc.userId}, course: ${doc.courseId}, lesson: ${doc.lessonId}, completed: ${doc.isCompleted}`
  );
});

// Virtual to provide progress details
userProgressSchema.virtual("progressDetails").get(function () {
  return `User ${this.userId} has ${this.isCompleted ? "completed" : "not completed"} lesson ${this.lessonId} in course ${this.courseId}`;
});

// Static method to find progress by user
userProgressSchema.statics.findByUser = async function (userId) {
  try {
    return await this.find({ userId })
      .populate("courseId", "title")
      .populate("lessonId", "title")
      .select("isCompleted quizScore createdAt updatedAt");
  } catch (error) {
    logger.error(`Error finding progress for user ${userId}: ${error.message}`);
    throw new Error(`Failed to find user progress: ${error.message}`);
  }
};

// Static method to calculate course progress for a user
userProgressSchema.statics.calculateCourseProgress = async function (userId, courseId) {
  try {
    const progressRecords = await this.find({ userId, courseId });
    const lessons = await mongoose.model("Lesson").find({ courseId });
    const completedLessons = progressRecords.filter((record) => record.isCompleted).length;
    const totalLessons = lessons.length;
    const progressPercentage = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;
    return {
      userId,
      courseId,
      completedLessons,
      totalLessons,
      progressPercentage: Math.round(progressPercentage),
    };
  } catch (error) {
    logger.error(`Error calculating progress for user ${userId}, course ${courseId}: ${error.message}`);
    throw new Error(`Failed to calculate course progress: ${error.message}`);
  }
};

// Instance method to mark a lesson as completed
userProgressSchema.methods.markAsCompleted = async function () {
  try {
    if (this.isCompleted) {
      throw new Error("Lesson is already marked as completed");
    }
    this.isCompleted = true;
    await this.save();
    logger.info(`Lesson marked as completed: ${this._id}, user: ${this.userId}, lesson: ${this.lessonId}`);
    return this;
  } catch (error) {
    logger.error(`Error marking lesson as completed ${this._id}: ${error.message}`);
    throw new Error(`Failed to mark lesson as completed: ${error.message}`);
  }
};

// Instance method to update quiz score
userProgressSchema.methods.updateQuizScore = async function (score) {
  try {
    if (!Number.isInteger(score) || score < 0 || score > 100) {
      throw new Error("Quiz score must be an integer between 0 and 100");
    }
    this.quizScore = score;
    await this.save();
    logger.info(`Quiz score updated: ${this._id}, user: ${this.userId}, lesson: ${this.lessonId}, score: ${score}`);
    return this;
  } catch (error) {
    logger.error(`Error updating quiz score ${this._id}: ${error.message}`);
    throw new Error(`Failed to update quiz score: ${error.message}`);
  }
};

// Create and export UserProgress model
const UserProgress = mongoose.model("UserProgress", userProgressSchema);
export default UserProgress;