import mongoose from "mongoose";
import bcrypt from "bcrypt";
import crypto from "crypto";
import validator from "validator";
import sanitizeHtml from "sanitize-html";
import jwt from "jsonwebtoken";
import Course from "./Course.js";
import Subscription from "./Subscription.js";
import { logger } from "../utils/logger.js";

// Utility function to sanitize string fields
const sanitize = (value) =>
  sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} });

// Schema for purchased courses
const purchasedCourse = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: [true, "Course ID is required"],
    },
    courseName: {
      type: String,
      required: [true, "Course name is required"],
      trim: true,
      maxlength: [100, "Course name cannot exceed 100 characters"],
      set: sanitize,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      default: function () {
        if (this.duration) {
          return new Date(
            this.startDate.getTime() + this.duration * 24 * 60 * 60 * 1000
          );
        }
        return null;
      },
    },
    duration: {
      type: Number,
      required: [true, "Course duration is required"],
      min: [1, "Duration must be at least 1 day"],
    },
    completionStatus: {
      type: Number,
      min: [0, "Completion status cannot be negative"],
      max: [100, "Completion status cannot exceed 100"],
      default: 0,
    },
    lastAccessed: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

// Schema for purchased subscription
const activeSubscription = new mongoose.Schema(
  {
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      required: [
        function () {
          return this.status === "active";
        },
        "Subscription ID is required for active plans",
      ],
    },
    subscriptionName: {
      type: String,
      required: [
        function () {
          return this.status === "active";
        },
        "Subscription name is required for active plans",
      ],
      trim: true,
      maxlength: [100, "Subscription name cannot exceed 100 characters"],
      set: sanitize,
      validate: {
        validator: function (v) {
          const validNames = [
            "Basic Plan",
            "Pro Plan",
            "Premium Plan",
            "Gift Plan",
            "Team Plan",
          ];
          const isValid =
            !this.status || this.status !== "active" || validNames.includes(v);
          if (!isValid) {
            logger.error(`Invalid subscriptionName: ${v}`, {
              activeSubscription: this,
            });
          }
          return isValid;
        },
        message:
          "Subscription name must be one of Basic Plan, Pro Plan, Premium Plan, Gift Plan, Team Plan",
      },
    },
    subscriptionType: {
      type: String,
      enum: ["Personal", "Team", "Gift"],
      required: [
        function () {
          return this.status === "active";
        },
        "Subscription type is required for active plans",
      ],
    },
    status: {
      type: String,
      enum: ["active", "inactive", "cancelled", "expired"],
      default: "inactive",
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    duration: {
      type: Number,
      enum: [30, 180, 365],
      required: [
        function () {
          return this.status === "active";
        },
        "Duration is required for active subscriptions",
      ],
    },
    endDate: {
      type: Date,
      default: function () {
        if (this.duration) {
          return new Date(
            this.startDate.getTime() + this.duration * 24 * 60 * 60 * 1000
          );
        }
        return null;
      },
    },
  },
  { _id: false }
);

// Main user schema
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [50, "Name cannot exceed 50 characters"],
      minlength: [2, "Name must be at least 2 characters"],
      set: sanitize,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      validate: [validator.isEmail, "Invalid email address"],
    },
    password: {
      type: String,
      select: false,
      minlength: [8, "Password must be at least 8 characters"],
      required: [
        function () {
          return this.provider === "email";
        },
        "Password is required for email authentication",
      ],
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
      select: false,
      required: [
        function () {
          return this.provider === "google";
        },
        "Google ID is required for Google authentication",
      ],
    },
    provider: {
      type: String,
      enum: ["email", "google"],
      required: [true, "Authentication provider is required"],
      default: "email",
      immutable: true,
    },
    mobileNumber: {
      type: String,
      trim: true,
      validate: {
        validator: (v) => !v || /^\+?[1-9]\d{6,14}$/.test(v),
        message: "Invalid mobile number format",
      },
    },
    role: {
      type: String,
      enum: ["user", "admin", "instructor"],
      default: "user",
    },
    isBanned: {
      type: Boolean,
      default: false,
    },
    activeSubscription: {
      type: activeSubscription,
      default: () => ({
        status: "inactive",
        startDate: null,
        endDate: null,
        duration: null,
        subscriptionId: null,
        subscriptionName: null,
        subscriptionType: null,
      }),
    },
    purchasedCourses: [purchasedCourse],
    transactions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Transaction",
      },
    ],
    profilePicture: {
      type: String,
      trim: true,
      default: "/assets/avatars/default.svg",
      validate: {
        validator: function (v) {
          return (
            !v ||
            /^\/assets\/avatars\/(boy-[1-3]|girl-[1-3]|default)\.svg$/.test(v)
          );
        },
        message: "Invalid profile picture path",
      },
      set: sanitize,
    },
    bio: {
      type: String,
      default: "",
      trim: true,
      maxlength: [500, "Bio cannot exceed 500 characters"],
      set: sanitize,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpiry: { type: Date, select: false },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpiry: { type: Date, select: false },
    refreshToken: { type: String, select: false },
    refreshTokenExpiry: { type: Date, select: false },
    lastLogin: { type: Date, default: null },
    lastActive: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.password;
        delete ret.googleId;
        delete ret.emailVerificationToken;
        delete ret.emailVerificationExpiry;
        delete ret.resetPasswordToken;
        delete ret.resetPasswordExpiry;
        delete ret.refreshToken;
        delete ret.refreshTokenExpiry;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// Optimized indexes
userSchema.index({ role: 1 });
userSchema.index({ isBanned: 1 });
userSchema.index({ "activeSubscription.status": 1 });
userSchema.index({ email: "text", name: "text" });

// Virtual for subscription duration
userSchema.virtual("subscriptionDuration").get(function () {
  if (
    this.activeSubscription &&
    this.activeSubscription.status === "active" &&
    this.activeSubscription.startDate &&
    this.activeSubscription.endDate
  ) {
    const diffTime =
      this.activeSubscription.endDate - this.activeSubscription.startDate;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  return 0;
});

// Middleware for password hashing
userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  try {
    const saltRounds = 12;
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (error) {
    logger.error(`Password hashing failed: ${error.message}`, {
      userId: this._id,
    });
    next(new Error(`Password hashing failed: ${error.message}`));
  }
});

// Middleware for subscription validation
userSchema.pre("save", function (next) {
  if (!this.activeSubscription) {
    this.activeSubscription = {
      status: "inactive",
      startDate: null,
      endDate: null,
      duration: null,
      subscriptionId: null,
      subscriptionName: null,
      subscriptionType: null,
    };
  }

  if (this.activeSubscription.status === "active") {
    if (
      !this.activeSubscription.startDate ||
      !this.activeSubscription.endDate ||
      !this.activeSubscription.subscriptionId ||
      !this.activeSubscription.duration ||
      !this.activeSubscription.subscriptionName ||
      !this.activeSubscription.subscriptionType
    ) {
      logger.error("Missing required subscription details", {
        activeSubscription: this.activeSubscription,
      });
      return next(
        new Error(
          "All subscription details are required for active subscriptions"
        )
      );
    }
    if (this.activeSubscription.endDate <= this.activeSubscription.startDate) {
      logger.error("Invalid subscription dates", {
        activeSubscription: this.activeSubscription,
      });
      return next(new Error("Subscription end date must be after start date"));
    }
  }
  next();
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to generate email verification token
userSchema.methods.generateEmailVerificationToken = async function () {
  const token = crypto.randomBytes(32).toString("hex");
  this.emailVerificationToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  this.emailVerificationExpiry = Date.now() + 24 * 60 * 60 * 1000;
  await this.save();
  return token;
};

// Method to clear email verification token
userSchema.methods.clearEmailVerificationToken = async function () {
  this.emailVerificationToken = undefined;
  this.emailVerificationExpiry = undefined;
  this.isVerified = true;
  await this.save();
};

// Static method to verify email token
userSchema.statics.verifyEmailToken = async function (token) {
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  const user = await this.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpiry: { $gt: Date.now() },
  }).select("+emailVerificationToken +emailVerificationExpiry");
  if (!user) throw new Error("Invalid or expired verification token");
  return user;
};

// Method to generate password reset token
userSchema.methods.generatePasswordResetToken = async function () {
  const token = crypto.randomBytes(32).toString("hex");
  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  this.resetPasswordExpiry = Date.now() + 10 * 60 * 1000;
  await this.save();
  return token;
};

// Static method to verify reset token
userSchema.statics.verifyResetToken = async function (token) {
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  const user = await this.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpiry: { $gt: Date.now() },
  }).select("+resetPasswordToken +resetPasswordExpiry +password");
  if (!user) throw new Error("Invalid or expired reset token");
  return user;
};

// Method to clear reset token
userSchema.methods.clearResetToken = async function () {
  this.resetPasswordToken = undefined;
  this.resetPasswordExpiry = undefined;
  await this.save();
};

// Method to generate refresh token
userSchema.methods.generateRefreshToken = async function () {
  const refreshToken = crypto.randomBytes(64).toString("hex");
  this.refreshToken = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");
  this.refreshTokenExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
  await this.save();
  return refreshToken;
};

// Static method to verify refresh token
userSchema.statics.verifyRefreshToken = async function (token) {
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  const user = await this.findOne({
    refreshToken: hashedToken,
    refreshTokenExpiry: { $gt: Date.now() },
  }).select("+refreshToken +refreshTokenExpiry");
  if (!user) throw new Error("Invalid or expired refresh token");
  return user;
};

// Method to invalidate refresh token
userSchema.methods.invalidateRefreshToken = async function () {
  this.refreshToken = undefined;
  this.refreshTokenExpiry = undefined;
  await this.save();
};

// Method to invalidate all tokens
userSchema.methods.invalidateallTokens = async function () {
  this.refreshToken = undefined;
  this.refreshTokenExpiry = undefined;
  this.emailVerificationToken = undefined;
  this.emailVerificationExpiry = undefined;
  this.resetPasswordToken = undefined;
  this.resetPasswordExpiry = undefined;
  await this.save();
};

// Static method to search users
userSchema.statics.searchUsers = async function (query) {
  return this.find(
    { $text: { $search: query } },
    { score: { $meta: "textScore" } }
  )
    .select("name email activeSubscription.status")
    .sort({ score: { $meta: "textScore" } })
    .limit(50)
    .lean();
};

// Method to generate access token
userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    { userId: this._id, email: this.email, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: "60m", issuer: "skillnestx", audience: "skillnestx-users" }
  );
};

// Method to grant user access to a course or subscription
userSchema.methods.grantUserAccess = async function ({
  courseId,
  subscriptionId,
  transactionId,
}) {
  try {
    if (courseId) {
      const course = await Course.findById(courseId);
      if (!course) {
        logger.error(`Invalid course ID: ${courseId}`, { userId: the._id });
        throw new Error("Invalid course ID");
      }
      if (!this.purchasedCourses) this.purchasedCourses = [];
      const courseExists = this.purchasedCourses.some(
        (c) => c.courseId.toString() === courseId.toString()
      );
      if (!courseExists) {
        this.purchasedCourses.push({
          courseId,
          courseName: course.title,
          startDate: new Date(),
          duration: course.duration || 365, // Default to 1 year if not specified
          completionStatus: 0,
          lastAccessed: new Date(),
        });
      }
    } else if (subscriptionId) {
      const subscription = await Subscription.findById(subscriptionId);
      if (!subscription) {
        logger.error(`Invalid subscription ID: ${subscriptionId}`, {
          userId: this._id,
        });
        throw new Error("Invalid subscription ID");
      }
      this.activeSubscription = {
        subscriptionId,
        subscriptionName: subscription.name,
        subscriptionType: subscription.type,
        status: "active",
        startDate: new Date(),
        duration: subscription.duration || 365,
        endDate: new Date(
          Date.now() + (subscription.duration || 365) * 24 * 60 * 60 * 1000
        ),
      };
    } else {
      logger.error("Missing courseId or subscriptionId", { userId: this._id });
      throw new Error("Course ID or subscription ID is required");
    }

    if (transactionId && !this.transactions.includes(transactionId)) {
      this.transactions.push(transactionId);
    }

    logger.info("Granting user access", {
      userId: this._id,
      courseId,
      subscriptionId,
      transactionId,
    });
    await this.save();
  } catch (error) {
    logger.error(`Failed to grant user access: ${error.message}`, {
      userId: this._id,
      stack: error.stack,
    });
    throw error;
  }
};

// Method to revoke user access to a course or subscription
userSchema.methods.revokeUserAccess = async function (payload, traceId) {
  try {
    const { courseId, subscriptionId, transactionId } = payload;

    if (courseId) {
      if (!mongoose.Types.ObjectId.isValid(courseId)) {
        logger.error("Invalid course ID format", { traceId, courseId });
        throw new Error("Invalid course ID format");
      }
      const courseObjectId = new mongoose.Types.ObjectId(courseId);
      const courseIndex = this.purchasedCourses.findIndex(
        (course) => course.courseId.toString() === courseObjectId.toString()
      );
      if (courseIndex === -1) {
        logger.warn("Course not found in purchased courses", { traceId, courseId });
      } else {
        this.purchasedCourses.splice(courseIndex, 1);
        logger.info(`Course ${courseId} removed from purchasedCourses`, { traceId, userId: this._id });
      }
    } else if (subscriptionId) {
      if (!mongoose.Types.ObjectId.isValid(subscriptionId)) {
        logger.error("Invalid subscription ID format", { traceId, subscriptionId });
        throw new Error("Invalid subscription ID format");
      }
      const subscriptionObjectId = new mongoose.Types.ObjectId(subscriptionId);
      if (!this.activeSubscription) {
        logger.warn("No active subscription found", { traceId, subscriptionId, userId: this._id });
      } else if (this.activeSubscription.subscriptionId.toString() !== subscriptionObjectId.toString()) {
        logger.warn("Subscription ID mismatch", {
          traceId,
          subscriptionId,
          activeSubscriptionId: this.activeSubscription.subscriptionId,
          userId: this._id,
        });
      } else {
        logger.info(`Revoking subscription ${subscriptionId}`, { traceId, userId: this._id });
        this.activeSubscription = null;
      }
    } else {
      logger.error("No courseId or subscriptionId provided", { traceId });
      throw new Error("Course ID or Subscription ID is required");
    }

    if (transactionId && mongoose.Types.ObjectId.isValid(transactionId)) {
      if (!Array.isArray(this.transactions)) {
        logger.warn("Transactions array is not properly initialized", { traceId, userId: this._id });
        this.transactions = [];
      }
      const transactionIndex = this.transactions.findIndex(
        (txn) => txn && txn.toString() === transactionId.toString()
      );
      if (transactionIndex !== -1) {
        this.transactions.splice(transactionIndex, 1);
        logger.info(`Transaction ${transactionId} removed from transactions`, { traceId, userId: this._id });
      } else {
        logger.warn("Transaction not found in transactions array", { traceId, transactionId });
      }
    } else if (transactionId) {
      logger.warn("Invalid transaction ID format", { traceId, transactionId });
    }

    await this.save();
    logger.info("User access revoked", { traceId, userId: this._id, courseId, subscriptionId });
  } catch (error) {
    logger.error(`Failed to revoke user access: ${error.message}`, { traceId, stack: error.stack });
    throw error;
  }
};

const User = mongoose.model("User", userSchema);
export default User;