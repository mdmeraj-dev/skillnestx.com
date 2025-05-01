import express from "express";
import { handleRazorpayWebhook } from "../controllers/webhookController.js";
import logger from "../utils/logger.js";

const router = express.Router();

// Route to handle Razorpay webhook events
router.post("/razorpay", handleRazorpayWebhook);

// Error handling
router.use((err, req, res, next) => {
  logger.error(`Webhook route error: ${err.message}, Path: ${req.originalUrl}`);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === "development" ? err.message : "Internal server error.",
  });
});

export default router;