// controllers/feedbackController.js
import Feedback from "../models/Feedback.js";
import logger from "../utils/logger.js"; // Optional: For logging
import { sendFeedbackConfirmationEmail } from "../utils/emailService.js"; // Optional: For sending confirmation emails

/**
 * Submit feedback
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const submitFeedback = async (req, res) => {
  const { name, email, message } = req.body;

  // Input validation
  if (!name || !email || !message) {
    logger.warn("Validation failed: Missing required fields.");
    return res.status(400).json({
      success: false,
      message: "All fields (name, email, message) are required.",
    });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    logger.warn(`Validation failed: Invalid email format for ${email}.`);
    return res.status(400).json({
      success: false,
      message: "Please provide a valid email address.",
    });
  }

  try {
    // Create and save feedback
    const newFeedback = new Feedback({ name, email, message });
    await newFeedback.save();

    // Log successful submission
    logger.info(`Feedback submitted successfully by ${email}.`);

    // Optional: Send confirmation email to the user
    await sendFeedbackConfirmationEmail(email, name);

    // Respond to the client
    res.status(201).json({
      success: true,
      message: "Feedback submitted successfully!",
      data: {
        id: newFeedback._id,
        name: newFeedback.name,
        email: newFeedback.email,
        createdAt: newFeedback.createdAt,
      },
    });
  } catch (error) {
    // Log the error
    logger.error(`Error submitting feedback: ${error.message}`, {
      stack: error.stack,
    });

    // Handle specific MongoDB errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    // Handle duplicate key errors (e.g., if email is unique)
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duplicate entry. This email has already submitted feedback.",
      });
    }

    // Generic error response
    res.status(500).json({
      success: false,
      message: "An unexpected error occurred. Please try again later.",
    });
  }
};

/**
 * Get all feedback (for admin purposes)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const getAllFeedback = async (req, res) => {
  const { page = 1, limit = 10, status } = req.query; // Pagination and filtering

  try {
    const query = {};
    if (status) {
      query.status = status; // Filter by status (e.g., pending, resolved)
    }

    const feedbackList = await Feedback.find(query)
      .sort({ createdAt: -1 }) // Sort by latest first
      .skip((page - 1) * limit) // Pagination
      .limit(Number(limit));

    const totalFeedback = await Feedback.countDocuments(query);

    res.status(200).json({
      success: true,
      message: "Feedback retrieved successfully.",
      data: feedbackList,
      pagination: {
        total: totalFeedback,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(totalFeedback / limit),
      },
    });
  } catch (error) {
    logger.error(`Error retrieving feedback: ${error.message}`, {
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      message: "An unexpected error occurred. Please try again later.",
    });
  }
};

/**
 * Update feedback status and admin reply (for admin purposes)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const updateFeedback = async (req, res) => {
  const { id } = req.params;
  const { status, adminReply } = req.body;

  try {
    // Validate input
    if (!status && !adminReply) {
      return res.status(400).json({
        success: false,
        message: "At least one field (status or adminReply) is required.",
      });
    }

    // Update feedback
    const updatedFeedback = await Feedback.findByIdAndUpdate(
      id,
      { status, adminReply, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!updatedFeedback) {
      return res.status(404).json({
        success: false,
        message: "Feedback not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Feedback updated successfully!",
      data: updatedFeedback,
    });
  } catch (error) {
    logger.error(`Error updating feedback: ${error.message}`, {
      stack: error.stack,
    });

    // Handle specific MongoDB errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    // Generic error response
    res.status(500).json({
      success: false,
      message: "An unexpected error occurred. Please try again later.",
    });
  }
};

/**
 * Delete feedback (for admin purposes)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const deleteFeedback = async (req, res) => {
  const { id } = req.params;

  try {
    const deletedFeedback = await Feedback.findByIdAndDelete(id);

    if (!deletedFeedback) {
      return res.status(404).json({
        success: false,
        message: "Feedback not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Feedback deleted successfully!",
      data: deletedFeedback,
    });
  } catch (error) {
    logger.error(`Error deleting feedback: ${error.message}`, {
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      message: "An unexpected error occurred. Please try again later.",
    });
  }
};