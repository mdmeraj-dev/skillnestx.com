import mongoose from "mongoose";
import bcrypt from "bcrypt";
import crypto from "crypto";
import validator from "validator";
import sanitizeHtml from "sanitize-html";

const purchasedCourseSchema = new mongoose.Schema(
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
      set: (v) => sanitizeHtml(v, { allowedTags: [], allowedAttributes: {} }),
    },
    purchaseDate: {
      type: Date,
      default: Date.now,
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

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [50, "Name cannot exceed 50 characters"],
      minlength: [2, "Name must be at least 2 characters"],
      set: (v) => sanitizeHtml(v, { allowedTags: [], allowedAttributes: {} }),
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
      enum: {
        values: ["email", "google"],
        message: "Invalid authentication provider",
      },
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
      enum: {
        values: ["user", "admin", "instructor"],
        message: "Invalid role",
      },
      default: "user",
    },
    purchasedCourses: [purchasedCourseSchema],
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
          if (!v || v === "") return true; // Allow empty or null
          return /^\/assets\/avatars\/(boy-[1-3]|girl-[1-3]|default)\.svg$/.test(v);
        },
        message: "Invalid profile picture path. Must be a valid avatar path (e.g., /assets/avatars/girl-3.svg).",
      },
      set: (v) => (v ? sanitizeHtml(v, { allowedTags: [], allowedAttributes: {} }) : v),
    },
    bio: {
      type: String,
      default: "",
      trim: true,
      maxlength: [500, "Bio cannot exceed 500 characters"],
      set: (v) => sanitizeHtml(v, { allowedTags: [], allowedAttributes: {} }),
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpiry: { type: Date, select: false },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpiry: { type: Date, select: false },
    resetAttempts: { type: Number, default: 0, select: false },
    resetAttemptsLastUpdated: { type: Date, select: false },
    sessionToken: { type: String, select: false },
    lastLogin: { type: Date },
    lastActive: { type: Date, default: Date.now },
    keepLoggedIn: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.password;
        delete ret.resetPasswordToken;
        delete ret.resetPasswordExpiry;
        delete ret.resetAttempts;
        delete ret.resetAttemptsLastUpdated;
        delete ret.emailVerificationToken;
        delete ret.emailVerificationExpiry;
        delete ret.googleId;
        delete ret.sessionToken;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

userSchema.index({ role: 1 });
userSchema.index({ lastActive: -1 });
userSchema.index({ sessionToken: 1 }, { sparse: true });

userSchema.virtual("fullName").get(function () {
  return this.name;
});

userSchema.pre("save", async function (next) {
  try {
    if (!this.isModified("password") || !this.password) return next();
    if (this.password.startsWith("$2b$")) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.pre("save", function (next) {
  if (this.isModified() && !this.isModified("lastActive")) {
    this.lastActive = new Date();
  }
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error("Password comparison failed");
  }
};

userSchema.methods.generateEmailVerificationToken = async function () {
  try {
    const token = crypto.randomBytes(48).toString("hex");
    this.emailVerificationToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");
    this.emailVerificationExpiry = Date.now() + 24 * 60 * 60 * 1000;
    await this.save();
    return token;
  } catch (error) {
    throw new Error("Failed to generate email verification token");
  }
};

userSchema.statics.verifyEmailToken = async function (token) {
  try {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await this.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpiry: { $gt: Date.now() },
    }).select("+emailVerificationToken +emailVerificationExpiry");
    if (!user) throw new Error("Invalid or expired verification token");
    return user;
  } catch (error) {
    throw error;
  }
};

userSchema.methods.generatePasswordResetToken = async function () {
  try {
    const RESET_LIMIT = 5;
    const RESET_WINDOW = 60 * 60 * 1000;
    if (
      this.resetAttempts >= RESET_LIMIT &&
      this.resetAttemptsLastUpdated > Date.now() - RESET_WINDOW
    ) {
      throw new Error("Too many reset attempts. Please try again later.");
    }
    const resetToken = crypto.randomBytes(48).toString("hex");
    this.resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    this.resetPasswordExpiry = Date.now() + 10 * 60 * 1000;
    this.resetAttempts =
      this.resetAttempts >= RESET_LIMIT ? 1 : (this.resetAttempts || 0) + 1;
    this.resetAttemptsLastUpdated = new Date();
    await this.save();
    return resetToken;
  } catch (error) {
    throw error;
  }
};

userSchema.statics.verifyResetToken = async function (token) {
  try {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await this.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpiry: { $gt: Date.now() },
    }).select(
      "+resetPasswordToken +resetPasswordExpiry +resetAttempts +resetAttemptsLastUpdated +password"
    );
    if (!user) throw new Error("Invalid or expired reset token");
    return user;
  } catch (error) {
    throw error;
  }
};

userSchema.methods.clearResetToken = async function () {
  try {
    this.resetPasswordToken = undefined;
    this.resetPasswordExpiry = undefined;
    this.resetAttempts = 0;
    this.resetAttemptsLastUpdated = undefined;
    await this.save();
  } catch (error) {
    throw new Error("Failed to clear reset token");
  }
};

userSchema.methods.generateSessionToken = async function () {
  try {
    const sessionToken = crypto.randomBytes(64).toString("hex");
    this.sessionToken = crypto
      .createHash("sha256")
      .update(sessionToken)
      .digest("hex");
    await this.save();
    return sessionToken;
  } catch (error) {
    throw new Error("Failed to generate session token");
  }
};

userSchema.statics.verifySessionToken = async function (token) {
  try {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await this.findOne({
      sessionToken: hashedToken,
    }).select("+sessionToken");
    if (!user) throw new Error("Invalid session token");
    return user;
  } catch (error) {
    throw error;
  }
};

userSchema.methods.invalidateSession = async function () {
  try {
    this.sessionToken = undefined;
    await this.save();
  } catch (error) {
    throw new Error("Failed to invalidate session");
  }
};

userSchema.methods.hardDelete = async function () {
  try {
    await this.deleteOne();
  } catch (error) {
    throw new Error("Failed to delete user");
  }
};

const User = mongoose.model("User", userSchema);
export default User;