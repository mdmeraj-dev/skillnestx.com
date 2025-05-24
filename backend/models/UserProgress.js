import mongoose from "mongoose";

const userProgressSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  courseId: {
    type: String,
    required: true,
    index: true,
  },
  completedLessons: {
    type: [String],
    default: [],
  },
  isCompleted: {
    type: Boolean,
    default: false,
  },
  // Added fields to store course metadata for purchase functionality
  courseDuration: {
    type: String,
    default: "1 Year",
  },
  coursePrice: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
  collection: "user_progress"
});

// Compound index for efficient queries by userId and courseId
userProgressSchema.index({ userId: 1, courseId: 1 }, { unique: true });

export default mongoose.model("UserProgress", userProgressSchema);