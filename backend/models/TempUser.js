import mongoose from "mongoose";
import bcrypt from "bcrypt";
import crypto from "crypto";
import validator from "validator";
import sanitizeHtml from "sanitize-html";

// Utility function to sanitize string fields
const sanitize = (value) =>
  sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} });

const tempUserSchema = new mongoose.Schema(
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
      required: [true, "Password is required"],
    },
    otp: {
      type: String,
      select: false,
      required: [true, "OTP is required"],
      validate: {
        validator: (v) => /^[a-f0-9]{64}$/.test(v), // Hashed OTP (SHA-256)
        message: "Invalid OTP format",
      },
    },
    otpExpiry: {
      type: Date,
      select: false,
      required: [true, "OTP expiry is required"],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.password;
        delete ret.otp;
        delete ret.otpExpiry;
        return ret;
      },
    },
    collection: "temp_user"
  }
);

// TTL index to auto-delete documents after 10 minutes (aligned with OTP expiry)
tempUserSchema.index({ createdAt: 1 }, { expireAfterSeconds: 600 }); // 10 minutes

// Middleware for password hashing
tempUserSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  try {
    const saltRounds = 12; // Fixed for consistency
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (error) {
    next(new Error(`Password hashing failed: ${error.message}`));
  }
});

// Method to compare passwords
tempUserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to generate OTP
tempUserSchema.methods.generateOTP = async function () {
  const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit numeric OTP
  this.otp = crypto.createHash("sha256").update(otp).digest("hex");
  this.otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes
  await this.save();
  return otp;
};

// Static method to verify OTP
tempUserSchema.statics.verifyOTP = async function (email, otp) {
  const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");
  const user = await this.findOne({
    email,
    otp: hashedOTP,
    otpExpiry: { $gt: Date.now() },
  }).select("+otp +otpExpiry +password");
  if (!user) throw new Error("Invalid or expired OTP");
  return user;
};

// Method to clear OTP
tempUserSchema.methods.clearOTP = async function () {
  this.otp = undefined;
  this.otpExpiry = undefined;
  await this.save();
};

const TempUser = mongoose.model("TempUser", tempUserSchema);
export default TempUser;