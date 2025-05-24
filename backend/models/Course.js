import mongoose from "mongoose";
import validator from "validator";
import { logger } from "../utils/logger.js";

// Lesson Schema for individual lessons or assessments
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
    },
    isLocked: {
      type: Boolean,
      default: true,
    },
    type: {
      type: String,
      enum: {
        values: ["lesson", "assessment"],
        message: "{VALUE} is not a valid lesson type",
      },
      default: "lesson",
    },
    quiz: {
      type: [
        {
          question: {
            type: String,
            required: [true, "Quiz question is required"],
            trim: true,
          },
          options: {
            type: [String],
            required: [true, "Quiz options are required"],
            validate: {
              validator: function (options) {
                return (
                  options.length === 4 &&
                  options.every(
                    (opt) => typeof opt === "string" && opt.trim().length > 0
                  ) &&
                  options.includes(this.correctAnswer)
                );
              },
              message:
                "Quiz must have exactly 4 non-empty options, including the correct answer",
            },
          },
          correctAnswer: {
            type: String,
            required: [true, "Correct answer is required"],
            trim: true,
          },
        },
      ],
      default: [],
    },
  },
  { _id: true }
);

// Section Schema for grouping lessons
const sectionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Section title is required"],
      trim: true,
      maxlength: [100, "Section title cannot exceed 100 characters"],
    },
    lessons: {
      type: [lessonSchema],
      default: [],
    },
  },
  { _id: true }
);

// Main Course Schema
const courseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Course title is required"],
      trim: true,
      maxlength: [200, "Course title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      required: [true, "Course description is required"],
      trim: true,
      minlength: [10, "Description must be at least 10 characters"],
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    category: {
      type: String,
      required: [true, "Course category is required"],
      trim: true,
      enum: {
        values: [
          "Frontend",
          "Backend",
          "Machine Learning",
          "Artificial Intelligence",
          "System Design",
          "Database",
        ],
        message: "{VALUE} is not a valid category",
      },
    },
    imageUrl: {
      type: String,
      required: [true, "Course image URL is required"],
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
    oldPrice: {
      type: Number,
      required: [true, "Old price is required"],
      min: [0, "Old price cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "Old price must be an integer",
      },
    },
    newPrice: {
      type: Number,
      required: [true, "New price is required"],
      min: [0, "New price cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "New price must be an integer",
      },
    },
    rating: {
      type: Number,
      default: 0,
      min: [0, "Rating cannot be negative"],
      max: [5, "Rating cannot exceed 5"],
    },
    ratingCount: {
      type: Number,
      default: 0,
      min: [0, "Rating count cannot be negative"],
    },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: function (tags) {
          return tags.every(
            (tag) => typeof tag === "string" && tag.trim().length > 0
          );
        },
        message: "Tags must be non-empty strings",
      },
    },
    duration: {
      type: Number,
      default: 365,
    },
    syllabus: {
      type: [sectionSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for optimized queries
courseSchema.index({ category: 1 });
courseSchema.index({ title: "text", description: "text" });
courseSchema.index({ rating: -1 });

// Pre-save hook for data validation
courseSchema.pre("save", async function (next) {
  try {
    // Validate price logic
    if (this.newPrice > this.oldPrice) {
      logger.error(`New price (${this.newPrice}) cannot be greater than old price (${this.oldPrice})`, { courseId: this._id });
      return next(new Error("New price cannot be greater than old price"));
    }
    // Log isLocked status for each lesson
    this.syllabus.forEach((section, sectionIndex) => {
      section.lessons.forEach((lesson, lessonIndex) => {
        logger.info(
          `Course ${this._id}, Section ${sectionIndex}, Lesson ${lessonIndex} (${lesson.title}) isLocked: ${lesson.isLocked}`
        );
      });
    });
    next();
  } catch (error) {
    logger.error(`Course validation failed: ${error.message}`, { courseId: this._id, stack: error.stack });
    next(error);
  }
});

// Static method to find courses by category
courseSchema.statics.findByCategory = async function (category) {
  try {
    const courses = await this.find({ category });
    logger.info(`Found ${courses.length} courses in category: ${category}`);
    return courses;
  } catch (error) {
    logger.error(`Failed to find courses by category: ${error.message}`, { category, stack: error.stack });
    throw new Error(`Failed to find courses by category: ${error.message}`);
  }
};

// Static method to search courses
courseSchema.statics.search = async function (query) {
  try {
    const courses = await this.find(
      { $text: { $search: query } },
      { score: { $meta: "textScore" } }
    ).sort({ score: { $meta: "textScore" } });
    logger.info(`Found ${courses.length} courses for search query: ${query}`);
    return courses;
  } catch (error) {
    logger.error(`Search failed: ${error.message}`, { query, stack: error.stack });
    throw new Error(`Search failed: ${error.message}`);
  }
};

// Create and export Course model
const Course = mongoose.model("Course", courseSchema);
export default Course;