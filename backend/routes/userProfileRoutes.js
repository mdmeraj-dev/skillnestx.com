import express from "express";
import {
  getUserProfile,
  updateUserProfile,
  deleteUserAccount,
  updatePassword,
  changeEmail,
  getPurchasedCourses,
  subscribeUser,
  checkSubscription,
} from "../controllers/userController.js"; // Import all required controller functions
import { protect } from "../middleware/authMiddleware.js"; // Ensure user is authenticated
import { checkSubscription as checkSubscriptionMiddleware } from "../middleware/authMiddleware.js"; // Middleware to check subscription status
import { checkEmailVerified } from "../middleware/authMiddleware.js"; // Middleware to check if email is verified

const router = express.Router();

// Subscription routes
router.post("/subscribe", protect, subscribeUser); // Activate or update subscription
router.get("/check-subscription", protect, checkSubscription); // Check subscription status

// Profile routes
router
  .route("/profile")
  .get(protect, getUserProfile) // Get user profile
  .put(protect, updateUserProfile); // Update user profile

// Email and password routes
router.put("/change-email", protect, checkEmailVerified, changeEmail); // Change email (requires email verification)
router.put("/update-password", protect, updatePassword); // Update password

// Account deletion route
router.delete("/account", protect, deleteUserAccount); // Delete user account

// Fetch purchased courses route
router.get("/purchased-courses", protect, getPurchasedCourses); // Fetch purchased courses

// Protected route with subscription check
router.get("/premium-content", protect, checkSubscriptionMiddleware, (req, res) => {
  res.status(200).json({ message: "Access granted to premium content." });
});

export default router;