import mongoose from "mongoose";
import logger from "../utils/logger.js";

// Payment Schema
const paymentSchema = new mongoose.Schema(
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
      default: null,
      validate: {
        validator: async function (courseId) {
          if (!courseId) return true; // Allow null
          const course = await mongoose.model("Course").findById(courseId);
          return !!course;
        },
        message: "Invalid course ID",
      },
    },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      default: null,
      validate: {
        validator: async function (subscriptionId) {
          if (!subscriptionId) return true; // Allow null
          const subscription = await mongoose.model("Subscription").findById(subscriptionId);
          return !!subscription;
        },
        message: "Invalid subscription ID",
      },
    },
    razorpayPaymentId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      validate: {
        validator: function (v) {
          return !v || /^[a-zA-Z0-9_]{14,}$/.test(v);
        },
        message: "Invalid Razorpay payment ID",
      },
    },
    razorpayOrderId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      validate: {
        validator: function (v) {
          return !v || /^[a-zA-Z0-9_]{14,}$/.test(v);
        },
        message: "Invalid Razorpay order ID",
      },
    },
    amount: {
      type: Number,
      required: [true, "Payment amount is required"],
      min: [0, "Amount cannot be negative"],
    },
    currency: {
      type: String,
      enum: {
        values: ["INR", "USD", "EUR", "GBP", "SGD", "AED", "JPY"],
        message: "{VALUE} is not a supported currency",
      },
      required: [true, "Currency is required"],
      default: "INR",
    },
    paymentMethod: {
      type: String,
      enum: {
        values: ["upi", "card", "netbanking", "wallet", "emi", null],
        message: "{VALUE} is not a valid payment method",
      },
      default: null,
    },
    paymentType: {
      type: String,
      enum: {
        values: ["one-time", "recurring"],
        message: "{VALUE} is not a valid payment type",
      },
      required: [true, "Payment type is required"],
      default: "one-time",
    },
    paymentStatus: {
      type: String,
      enum: {
        values: ["pending", "completed", "failed"],
        message: "{VALUE} is not a valid payment status",
      },
      required: [true, "Payment status is required"],
      default: "pending",
    },
    errorMessage: {
      type: String,
      default: null,
      trim: true,
      maxlength: [500, "Error message cannot exceed 500 characters"],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for optimized queries
paymentSchema.index({ userId: 1, paymentStatus: 1 });
paymentSchema.index({ razorpayPaymentId: 1 }, { unique: true, sparse: true });
paymentSchema.index({ razorpayOrderId: 1 }, { unique: true, sparse: true });
paymentSchema.index({ createdAt: -1 });

// Pre-validate hook to ensure exactly one of courseId or subscriptionId is provided
paymentSchema.pre("validate", function (next) {
  if ((this.courseId && this.subscriptionId) || (!this.courseId && !this.subscriptionId)) {
    return next(new Error("Exactly one of courseId or subscriptionId must be provided"));
  }
  next();
});

// Pre-save hook for data consistency
paymentSchema.pre("save", async function (next) {
  try {
    // Ensure paymentType matches subscriptionId or courseId
    if (this.subscriptionId && this.paymentType !== "recurring") {
      return next(new Error("Subscription payments must be recurring"));
    }
    if (this.courseId && this.paymentType !== "one-time") {
      return next(new Error("Course payments must be one-time"));
    }
    next();
  } catch (error) {
    logger.error(`Error in payment pre-save: ${error.message}`);
    next(error);
  }
});

// Post-save hook for logging
paymentSchema.post("save", function (doc) {
  logger.info(
    `Payment saved: ${doc._id}, user: ${doc.userId}, status: ${doc.paymentStatus}, amount: ${doc.amount} ${doc.currency}`
  );
});

// Static method to find completed payments
paymentSchema.statics.findCompleted = async function () {
  try {
    return await this.find({ paymentStatus: "completed" })
      .populate("userId", "name email")
      .populate("courseId", "title")
      .populate("subscriptionId", "type");
  } catch (error) {
    logger.error(`Error finding completed payments: ${error.message}`);
    throw new Error(`Failed to find completed payments: ${error.message}`);
  }
};

// Static method to find payments by user
paymentSchema.statics.findByUser = async function (userId) {
  try {
    return await this.find({ userId })
      .populate("userId", "name email")
      .populate("courseId", "title")
      .populate("subscriptionId", "type")
      .sort({ createdAt: -1 });
  } catch (error) {
    logger.error(`Error finding payments for user ${userId}: ${error.message}`);
    throw new Error(`Failed to find payments: ${error.message}`);
  }
};

// Method to mark payment as completed
paymentSchema.methods.complete = async function () {
  try {
    if (this.paymentStatus !== "pending") {
      throw new Error("Only pending payments can be marked as completed");
    }
    this.paymentStatus = "completed";
    this.errorMessage = null;
    await this.save();
    logger.info(`Payment completed: ${this._id}, user: ${this.userId}, amount: ${this.amount} ${this.currency}`);
    return this;
  } catch (error) {
    logger.error(`Error completing payment ${this._id}: ${error.message}`);
    throw new Error(`Failed to complete payment: ${error.message}`);
  }
};

// Method to mark payment as failed
paymentSchema.methods.fail = async function (errorMessage) {
  try {
    if (this.paymentStatus !== "pending") {
      throw new Error("Only pending payments can be marked as failed");
    }
    this.paymentStatus = "failed";
    this.errorMessage = errorMessage || "Payment failed";
    await this.save();
    logger.error(`Payment failed: ${this._id}, user: ${this.userId}, error: ${this.errorMessage}`);
    return this;
  } catch (error) {
    logger.error(`Error failing payment ${this._id}: ${error.message}`);
    throw new Error(`Failed to mark payment as failed: ${error.message}`);
  }
};

// Create and export Payment model
const Payment = mongoose.model("Payment", paymentSchema);
export default Payment;