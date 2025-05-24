import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  orderId: {
    type: String,
    required: true,
  },
  paymentId: {
    type: String,
    required: true,
    unique: true,
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
    required: false,
  },
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subscription",
    required: false,
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
        },
        price: {
          type: Number,
          required: true,
        },
      },
    ],
    required: false,
    default: [],
    validate: {
      validator: function () {
        if (this.purchaseType === "cart") {
          return (
            Array.isArray(this.notes.cartItems) &&
            this.notes.cartItems.length > 0
          );
        }
        return true;
      },
      message: "Cart items must be a non-empty array for cart purchases",
    },
  },
  currency: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "successful", "failed"],
    default: "pending",
  },
  purchaseType: {
    type: String,
    enum: ["course", "subscription", "cart"],
    required: true,
  },
  notes: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  refundStatus: {
    type: String,
    enum: ["processed", "refunded", "failed", null],
    required: false,
    default: null,
  },
});

export const Transaction = mongoose.model("Transaction", transactionSchema);