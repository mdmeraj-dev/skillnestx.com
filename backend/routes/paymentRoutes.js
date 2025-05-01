import express from "express";
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
  razorpayWebhook,
} from "../controllers/paymentController.js";
import { isAuthenticated, adminOnly } from "../middleware/authMiddleware.js"; // Use protect and adminOnly
import { rawBodyMiddleware } from "../controllers/paymentController.js"; // Import rawBodyMiddleware for webhook

const router = express.Router();

// User routes
router.post("/create-order", isAuthenticated, createRazorpayOrder); // Create a Razorpay order
router.post("/verify-payment", isAuthenticated, verifyRazorpayPayment); // Verify Razorpay payment

// Webhook route (no authentication required)
router.post("/webhook", rawBodyMiddleware, razorpayWebhook); // Handle Razorpay webhook events

export default router;