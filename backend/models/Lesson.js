import mongoose from "mongoose";
import validator from "validator";
import logger from "../utils/logger.js";

// Lesson Schema for standalone lesson documents
const lessonSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Lesson title is required"],
      trim: true,
      maxlength: [100, "Lesson title cannot exceed 100 characters"],
    },
    content: {
      type: String,
      required: [true, "Lesson content is required"],
      trim: true,
      minlength: [10, "Lesson content must be at least 10 characters"],
      maxlength: [10000, "Lesson content cannot exceed 10,000 characters"],
    },
    duration: {
      type: Number,
      required: [true, "Lesson duration is required"],
      min: [1, "Duration must be at least 1 minute"],
      max: [600, "Duration cannot exceed 600 minutes (10 hours)"],
      validate: {
        validator: Number.isInteger,
        message: "Duration must be an integer (in minutes)",
      },
    },
    isLocked: {
      type: Boolean,
      default: true,
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
    instructorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Instructor ID is required"],
      validate: {
        validator: async function (userId) {
          const user = await mongoose.model("User").findOne({
            _id: userId,
            role: "instructor",
          });
          return !!user;
        },
        message: "Invalid instructor ID",
      },
    },
    resources: [
      {
        type: String,
        trim: true,
        validate: {
          validator: function (v) {
            return validator.isURL(v, {
              protocols: ["http", "https"],
              require_protocol: true,
              allow_underscores: true,
            });
          },
          message: "{VALUE} is not a valid URL",
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for optimized queries
lessonSchema.index({ courseId: 1 });
lessonSchema.index({ title: "text" });

// Pre-save middleware for data consistency
lessonSchema.pre("save", async function (next) {
  try {
    // Ensure duration is rounded to the nearest integer
    this.duration = Math.round(this.duration);

    next();
  } catch (error) {
    logger.error(`Error in Lesson pre-save: ${error.message}`);
    next(error);
  }
});

// Post-save hook for logging
lessonSchema.post("save", function (doc) {
  logger.info(`Lesson saved: ${doc._id}, title: ${doc.title}, course: ${doc.courseId}`);
});

// Static method to find lessons by course
lessonSchema.statics.findByCourse = async function (courseId) {
  try {
    return await this.find({ courseId })
      .populate("instructorId", "name")
      .select("title duration isLocked");
  } catch (error) {
    logger.error(`Error finding lessons for course ${courseId}: ${error.message}`);
    throw new Error(`Failed to find lessons: ${error.message}`);
  }
};

// Instance method to update lesson content
lessonSchema.methods.updateContent = async function (newContent) {
  try {
    this.content = newContent;
    await this.validate();
    await this.save();
    logger.info(`Lesson content updated: ${this._id}, title: ${this.title}`);
    return this;
  } catch (error) {
    logger.error(`Error updating lesson content ${this._id}: ${error.message}`);
    throw new Error(`Failed to update lesson content: ${error.message}`);
  }
};

// Create and export Lesson model
const Lesson = mongoose.model("Lesson", lessonSchema);
export default Lesson;