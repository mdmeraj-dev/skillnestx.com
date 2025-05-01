import mongoose from "mongoose";
import validator from "validator";
import logger from "../utils/logger.js";

// Testimonial Schema for storing user testimonials
const testimonialSchema = new mongoose.Schema(
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
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [50, "Name cannot exceed 50 characters"],
      minlength: [2, "Name must be at least 2 characters"],
    },
    role: {
      type: String,
      required: [true, "Role is required"],
      trim: true,
      maxlength: [50, "Role cannot exceed 50 characters"],
      minlength: [2, "Role must be at least 2 characters"],
    },
    testimonial: {
      type: String,
      required: [true, "Testimonial content is required"],
      trim: true,
      minlength: [10, "Testimonial must be at least 10 characters"],
      maxlength: [500, "Testimonial cannot exceed 500 characters"],
    },
    image: {
      type: String,
      required: [true, "Image URL is required"],
      trim: true,
      validate: {
        validator: function (v) {
          return validator.isURL(v, {
            protocols: ["http", "https"],
            require_protocol: true,
          });
        },
        message: "{VALUE} is not a valid URL",
      },
    },
    socialMedia: [
      {
        logo: {
          type: String,
          required: [true, "Social media logo URL is required"],
          trim: true,
          validate: {
            validator: function (v) {
              return validator.isURL(v, {
                protocols: ["http", "https"],
                require_protocol: true,
              });
            },
            message: "{VALUE} is not a valid URL",
          },
        },
        platform: {
          type: String,
          required: [true, "Social media platform is required"],
          trim: true,
          enum: {
            values: ["linkedin", "twitter", "facebook", "instagram", "github", "other"],
            message: "{VALUE} is not a supported social media platform",
          },
        },
      },
    ],
    isApproved: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for optimized queries
testimonialSchema.index({ userId: 1 });
testimonialSchema.index({ courseId: 1 });
testimonialSchema.index({ isApproved: 1 });

// Pre-save middleware for data consistency
testimonialSchema.pre("save", async function (next) {
  try {
    // Ensure user has completed the course
    const progress = await mongoose.model("UserProgress").calculateCourseProgress(this.userId, this.courseId);
    if (progress.progressPercentage < 100) {
      return next(new Error("User has not completed the course"));
    }
    next();
  } catch (error) {
    logger.error(`Error in Testimonial pre-save: ${error.message}`);
    next(error);
  }
});

// Post-save hook for logging
testimonialSchema.post("save", function (doc) {
  logger.info(
    `Testimonial saved: ${doc._id}, user: ${doc.userId}, course: ${doc.courseId}, approved: ${doc.isApproved}`
  );
});

// Static method to find approved testimonials
testimonialSchema.statics.findApproved = async function () {
  try {
    return await this.find({ isApproved: true })
      .populate("userId", "name email")
      .populate("courseId", "title")
      .select("name role testimonial image socialMedia");
  } catch (error) {
    logger.error(`Error finding approved testimonials: ${error.message}`);
    throw new Error(`Failed to find approved testimonials: ${error.message}`);
  }
};

// Static method to find testimonials by user
testimonialSchema.statics.findByUser = async function (userId) {
  try {
    return await this.find({ userId })
      .populate("courseId", "title")
      .select("name role testimonial image socialMedia isApproved createdAt");
  } catch (error) {
    logger.error(`Error finding testimonials for user ${userId}: ${error.message}`);
    throw new Error(`Failed to find testimonials: ${error.message}`);
  }
};

// Static method to find testimonials by course
testimonialSchema.statics.findByCourse = async function (courseId) {
  try {
    return await this.find({ courseId })
      .populate("userId", "name email")
      .select("name role testimonial image socialMedia isApproved createdAt");
  } catch (error) {
    logger.error(`Error finding testimonials for course ${courseId}: ${error.message}`);
    throw new Error(`Failed to find testimonials: ${error.message}`);
  }
};

// Instance method to approve a testimonial
testimonialSchema.methods.approveTestimonial = async function () {
  try {
    if (this.isApproved) {
      throw new Error("Testimonial is already approved");
    }
    this.isApproved = true;
    await this.save();
    logger.info(`Testimonial approved: ${this._id}, user: ${this.userId}, course: ${this.courseId}`);
    return this;
  } catch (error) {
    logger.error(`Error approving testimonial ${this._id}: ${error.message}`);
    throw new Error(`Failed to approve testimonial: ${error.message}`);
  }
};

// Create and export Testimonial model
const Testimonial = mongoose.model("Testimonial", testimonialSchema);
export default Testimonial;