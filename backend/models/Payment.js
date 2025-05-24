import mongoose from "mongoose";
import { logger } from "../utils/logger.js";

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "User ID is required"],
  },
  purchaseType: {
    type: String,
    enum: ["course", "subscription", "cart"],
    required: [true, "Purchase type is required"],
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
    required: [
      function () {
        return this.purchaseType === "course";
      },
      "Course ID is required for course purchase",
    ],
  },
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subscription",
    required: [
      function () {
        return this.purchaseType === "subscription";
      },
      "Subscription ID is required for subscription purchase",
    ],
  },
  amount: {
    type: Number,
    required: [true, "Amount is required"],
    min: [0, "Amount cannot be negative"],
    validate: {
      validator: Number.isInteger,
      message: "Amount must be an integer",
    },
  },
  currency: {
    type: String,
    required: [true, "Currency is required"],
    enum: ["INR"],
    default: "INR",
  },
  orderId: {
    type: String,
    required: [true, "Order ID is required"],
    unique: true,
  },
  paymentId: {
    type: String,
    required: [true, "Payment ID is required"],
    unique: true,
  },
  razorpaySignature: {
    type: String,
  },
  status: {
    type: String,
    enum: ["created", "authorized", "captured", "failed", "refunded"],
    default: "created",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  notes: {
    type: new mongoose.Schema(
      {
        courseId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Course",
          required: [
            function () {
              return this.parent().purchaseType === "course";
            },
            "Course ID is required in notes for course purchase",
          ],
        },
        subscriptionId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Subscription",
          required: [
            function () {
              return this.parent().purchaseType === "subscription";
            },
            "Subscription ID is required in notes for subscription purchase",
          ],
        },
        cartItems: {
          type: [
            {
              id: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Course",
                required: true,
              },
              name: {
                type: String,
                required: true,
                trim: true,
              },
              price: {
                type: Number,
                required: true,
                min: 0,
              },
            },
          ],
          required: [
            function () {
              return this.parent().purchaseType === "cart";
            },
            "Cart items are required in notes for cart purchase",
          ],
          validate: {
            validator: (arr) => arr.length > 0,
            message: "Cart items must be a non-empty array",
          },
        },
      },
      { _id: false }
    ),
    default: {},
  },
});

// Presave hook for validation and logging
transactionSchema.pre("save", function (next) {
  try {
    // Ensure notes aligns with purchaseType
    if (this.purchaseType === "course" && !this.notes.courseId) {
      throw new Error("Notes must include courseId for course purchase");
    }
    if (this.purchaseType === "subscription" && !this.notes.subscriptionId) {
      throw new Error("Notes must include subscriptionId for subscription purchase");
    }
    if (this.purchaseType === "cart" && (!this.notes.cartItems || this.notes.cartItems.length === 0)) {
      throw new Error("Notes must include non-empty cartItems for cart purchase");
    }
    next();
  } catch (error) {
    logger.error(`Transaction validation failed: ${error.message}`, {
      transactionId: this._id,
      userId: this.userId,
      purchaseType: this.purchaseType,
      stack: error.stack,
    });
    next(error);
  }
});

// Postsave hook for logging
transactionSchema.post("save", function (doc) {
  logger.info(`Transaction saved: ${doc._id}, userId: ${doc.userId}, purchaseType: ${doc.purchaseType}`);
});

export default mongoose.model("Transaction", transactionSchema);