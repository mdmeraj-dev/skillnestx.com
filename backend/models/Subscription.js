import mongoose from "mongoose";
import logger from "../utils/logger.js";

// Subscription Schema
const subscriptionSchema = new mongoose.Schema(
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
    type: {
      type: String,
      enum: {
        values: ["free", "basic", "pro", "premium", "team", "gift"],
        message: "{VALUE} is not a valid subscription type",
      },
      required: [true, "Subscription type is required"],
      default: "free",
    },
    status: {
      type: String,
      enum: {
        values: ["pending", "active", "cancelled", "expired", "failed"],
        message: "{VALUE} is not a valid subscription status",
      },
      required: [true, "Subscription status is required"],
      default: "pending",
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0, "Amount cannot be negative"],
    },
    currency: {
      type: String,
      enum: {
        values: ["INR", "USD", "EUR", "GBP"],
        message: "{VALUE} is not a supported currency",
      },
      required: [true, "Currency is required"],
      default: "INR",
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
      default: Date.now,
    },
    endDate: {
      type: Date,
    },
    planDuration: {
      type: Number,
      min: [0, "Plan duration cannot be negative"],
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: "Plan duration must be an integer",
      },
    },
    razorpaySubscriptionId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    includedCourses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Course",
        validate: {
          validator: async function (courseId) {
            const course = await mongoose.model("Course").findById(courseId);
            return !!course;
          },
          message: "Invalid course ID",
        },
      },
    ],
    maxUsers: {
      type: Number,
      min: [1, "Maximum users must be at least 1"],
      default: 1,
      validate: {
        validator: function (v) {
          return this.type !== "team" || v > 1;
        },
        message: "Team plan must allow more than one user",
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
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ razorpaySubscriptionId: 1 }, { unique: true, sparse: true });
subscriptionSchema.index({ startDate: -1, endDate: -1 });

// Pre-validate hook for date consistency
subscriptionSchema.pre("validate", function (next) {
  if (this.endDate && this.startDate && this.endDate < this.startDate) {
    return next(new Error("End date cannot be earlier than start date"));
  }
  next();
});

// Pre-save hook to calculate endDate and ensure data consistency
subscriptionSchema.pre("save", async function (next) {
  try {
    // Calculate endDate based on startDate and planDuration
    if (this.isModified("startDate") || this.isModified("planDuration")) {
      if (this.planDuration > 0 && this.startDate) {
        const endDate = new Date(this.startDate);
        endDate.setDate(endDate.getDate() + this.planDuration);
        this.endDate = endDate;
      }
    }

    // Ensure amount is 0 for free subscriptions
    if (this.type === "free" && this.amount !== 0) {
      this.amount = 0;
    }

    next();
  } catch (error) {
    logger.error(`Error in subscription pre-save: ${error.message}`);
    next(error);
  }
});

// Post-save hook for logging
subscriptionSchema.post("save", function (doc) {
  logger.info(`Subscription saved: ${doc._id}, user: ${doc.userId}, type: ${type}, status: ${doc.status}`);
});

// Static method to find active subscriptions
subscriptionSchema.statics.findActive = async function () {
  try {
    return await this.find({
      status: "active",
      endDate: { $gte: new Date() },
    }).populate("userId", "name email");
  } catch (error) {
    logger.error(`Error finding active subscriptions: ${error.message}`);
    throw new Error(`Failed to find active subscriptions: ${error.message}`);
  }
};

// Static method to find expired subscriptions
subscriptionSchema.statics.findExpired = async function () {
  try {
    return await this.find({
      status: { $in: ["active", "pending"] },
      endDate: { $lt: new Date() },
    }).populate("userId", "name email");
  } catch (error) {
    logger.error(`Error finding expired subscriptions: ${error.message}`);
    throw new Error(`Failed to find expired subscriptions: ${error.message}`);
  }
};

// Method to cancel subscription
subscriptionSchema.methods.cancel = async function () {
  try {
    this.status = "cancelled";
    this.endDate = new Date();
    await this.save();
    logger.info(`Subscription cancelled: ${this._id}, user: ${this.userId}`);
    return this;
  } catch (error) {
    logger.error(`Error cancelling subscription ${this._id}: ${error.message}`);
    throw new Error(`Failed to cancel subscription: ${error.message}`);
  }
};

// Method to activate subscription
subscriptionSchema.methods.activate = async function () {
  try {
    if (this.status !== "pending") {
      throw new Error("Only pending subscriptions can be activated");
    }
    this.status = "active";
    this.startDate = new Date();
    if (this.planDuration > 0) {
      const endDate = new Date(this.startDate);
      endDate.setDate(endDate.getDate() + this.planDuration);
      this.endDate = endDate;
    }
    await this.save();
    logger.info(`Subscription activated: ${this._id}, user: ${this.userId}`);
    return this;
  } catch (error) {
    logger.error(`Error activating subscription ${this._id}: ${error.message}`);
    throw new Error(`Failed to activate subscription: ${error.message}`);
  }
};

// Create and export Subscription model
const Subscription = mongoose.model("Subscription", subscriptionSchema);
export default Subscription;