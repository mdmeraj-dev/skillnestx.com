import mongoose from "mongoose";
import validator from "validator";

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
      trim: true,
    },
    isLocked: {
      type: Boolean,
      default: false,
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
                  options.every((opt) => typeof opt === "string" && opt.trim().length > 0) &&
                  options.includes(this.correctAnswer)
                );
              },
              message: "Quiz must have exactly 4 non-empty options, including the correct answer",
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
      validate: {
        validator: function (quizzes) {
          return this.type === "assessment" ? quizzes.length > 0 : true;
        },
        message: "Assessments must include at least one quiz question",
      },
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
      required: [true, "At least one lesson is required per section"],
      validate: {
        validator: function (lessons) {
          return lessons.length > 0;
        },
        message: "Section must contain at least one lesson",
      },
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
      unique: true,
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
          "Technology",
          "Business",
          "Design",
          "Development",
          "Marketing",
          "Photography",
          "Music",
          "Personal Development",
          "Other",
        ],
        message: "{VALUE} is not a valid category",
      },
    },
    image: {
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
    },
    newPrice: {
      type: Number,
      required: [true, "New price is required"],
      min: [0, "New price cannot be negative"],
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
          return tags.every((tag) => typeof tag === "string" && tag.trim().length > 0);
        },
        message: "Tags must be non-empty strings",
      },
    },
    syllabus: {
      type: [sectionSchema],
      required: [true, "Course syllabus is required"],
      validate: {
        validator: function (sections) {
          return sections.length > 0;
        },
        message: "Course must contain at least one section",
      },
    },
    instructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Instructor is required"],
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
courseSchema.index({ instructor: 1 });

// Pre-save hook for data validation
courseSchema.pre("save", async function (next) {
  try {
    // Validate price logic
    if (this.newPrice > this.oldPrice) {
      return next(new Error("New price cannot be greater than old price"));
    }

    // Validate instructor exists
    const instructorExists = await mongoose.model("User").exists({
      _id: this.instructor,
      role: "instructor",
    });
    if (!instructorExists) {
      return next(new Error("Invalid or non-instructor user specified"));
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Pre-validate hook to ensure quiz content for assessments
courseSchema.pre("validate", function (next) {
  for (const section of this.syllabus) {
    for (const lesson of section.lessons) {
      if (lesson.type === "assessment" && (!lesson.quiz || lesson.quiz.length === 0)) {
        return next(new Error("Assessments must include at least one quiz question"));
      }
    }
  }
  next();
});

// Static method to find courses by category
courseSchema.statics.findByCategory = async function (category) {
  try {
    return await this.find({ category }).populate("instructor", "name");
  } catch (error) {
    throw new Error(`Failed to find courses by category: ${error.message}`);
  }
};

// Static method to search courses
courseSchema.statics.search = async function (query) {
  try {
    return await this.find(
      { $text: { $search: query } },
      { score: { $meta: "textScore" } }
    )
      .sort({ score: { $meta: "textScore" } })
      .populate("instructor", "name");
  } catch (error) {
    throw new Error(`Search failed: ${error.message}`);
  }
};

// Create and export Course model
const Course = mongoose.model("Course", courseSchema);
export default Course;