import mongoose from "mongoose";
import { logger } from "../utils/logger.js";

// Subscription Template Schema (for admin-defined plans like Basic, Pro, Premium)
const subscriptionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      enum: [
        "Basic Plan",
        "Pro Plan",
        "Premium Plan",
        "Gift Plan",
        "Team Plan",
      ],
      required: [true, "Subscription name is required"],
      trim: true,
      unique: true,
    },
    type: {
      type: String,
      enum: ["Personal", "Gift", "Team"],
      required: [true, "Subscription type is required"],
      trim: true,
    },
    oldPrice: {
      type: Number,
      min: [0, "Old price cannot be negative"],
      default: null,
      validate: {
        validator: function (v) {
          return v === null || Number.isInteger(v);
        },
        message: "Old price must be an integer or null",
      },
      set: (v) => (v === null ? null : Math.round(v)),
    },
    newPrice: {
      type: Number,
      required: [true, "New price is required"],
      min: [0, "New price cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "New price must be an integer",
      },
      set: (v) => Math.round(v),
    },
    features: {
      type: [String],
      required: true,
      validate: {
        validator: (arr) => arr.length > 0,
        message: "Features must be a non-empty array",
      },
    },
    duration: {
      type: Number,
      enum: [30, 180, 365],
      required: [true, "Duration is required"],
    },
    tag: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Pre-save hook to validate and log
subscriptionSchema.pre("save", function (next) {
  try {
    if (this.isModified("newPrice")) this.newPrice = Math.round(this.newPrice);
    if (this.isModified("oldPrice") && this.oldPrice !== null)
      this.oldPrice = Math.round(this.oldPrice);
    next();
  } catch (error) {
    logger.error(`Subscription validation failed: ${error.message}`, { subscriptionId: this._id });
    next(error);
  }
});

// Post-save hook for logging
subscriptionSchema.post("save", function (doc) {
  logger.info(
    `Subscription template saved: ${doc._id}, name: ${doc.name}, type: ${doc.type}`
  );
});

// Static method to create or update a subscription template
subscriptionSchema.statics.createOrUpdateSubscriptionTemplate = async function (
  subscriptionData
) {
  try {
    const validNames = [
      "Basic Plan",
      "Pro Plan",
      "Premium Plan",
      "Gift Plan",
      "Team Plan",
    ];
    if (!validNames.includes(subscriptionData.name)) {
      logger.error(`Invalid subscription name: ${subscriptionData.name}`);
      throw new Error(`Name must be one of: ${validNames.join(", ")}`);
    }

    const data = {
      name: subscriptionData.name,
      type: subscriptionData.type,
      oldPrice: subscriptionData.oldPrice
        ? Math.round(subscriptionData.oldPrice)
        : null,
      newPrice: Math.round(subscriptionData.newPrice),
      features: subscriptionData.features,
      duration: subscriptionData.duration,
      tag: subscriptionData.tag || "",
    };

    const subscription = subscriptionData.id
      ? await this.findByIdAndUpdate(subscriptionData.id, data, {
          new: true,
          runValidators: true,
        })
      : await new this(data).save();

    if (!subscription) {
      logger.error(`Subscription not found: ${subscriptionData.id}`);
      throw new Error("Subscription template not found");
    }

    logger.info(
      `Subscription template ${subscriptionData.id ? "updated" : "created"}: ${subscription._id}`
    );
    return subscription;
  } catch (error) {
    logger.error(
      `Error ${subscriptionData.id ? "updating" : "creating"} subscription template: ${error.message}`,
      { stack: error.stack }
    );
    throw new Error(
      `Failed to ${subscriptionData.id ? "update" : "create"} subscription template: ${error.message}`
    );
  }
};

// Static method to delete a subscription template
subscriptionSchema.statics.deleteSubscriptionTemplate = async function (
  subscriptionId
) {
  try {
    const subscription = await this.findByIdAndDelete(subscriptionId);
    if (!subscription) {
      logger.error(`Subscription not found: ${subscriptionId}`);
      throw new Error("Subscription template not found");
    }
    logger.info(`Subscription template deleted: ${subscriptionId}`);
    return { message: "Subscription template deleted successfully" };
  } catch (error) {
    logger.error(`Error deleting subscription template: ${error.message}`, { stack: error.stack });
    throw new Error(`Failed to delete subscription template: ${error.message}`);
  }
};

// Static method to get all subscription templates
subscriptionSchema.statics.getAllSubscriptionTemplates = async function () {
  try {
    const subscriptions = await this.find().lean();
    return subscriptions.map((sub) => ({
      subscriptionId: sub._id.toString(),
      name: sub.name,
      type: sub.type,
      oldPrice: sub.oldPrice,
      newPrice: sub.newPrice,
      features: sub.features,
      duration: sub.duration,
      tag: sub.tag,
      createdAt: sub.createdAt,
      updatedAt: sub.updatedAt,
    }));
  } catch (error) {
    logger.error(`Error fetching subscription templates: ${error.message}`, { stack: error.stack });
    throw new Error(`Failed to fetch subscription templates: ${error.message}`);
  }
};

// Create and export model
const Subscription = mongoose.model("Subscription", subscriptionSchema);

export default Subscription;