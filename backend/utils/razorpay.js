import Razorpay from "razorpay";
import winston from "winston";
import config from "../config/config.js"; // Import centralized config

// Configure Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "development" ? "debug" : "info"),
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

// Validate Razorpay environment variables
const validateRazorpayEnvVars = () => {
  if (!config.RAZORPAY_KEY_ID || !config.RAZORPAY_KEY_SECRET) {
    const errorMessage = "❌ Missing Razorpay environment variables: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required.";
    logger.error(errorMessage);
    throw new Error(errorMessage); // Fail fast in all environments
  }
};

// Initialize Razorpay instance lazily
let razorpayInstance;

const initializeRazorpay = () => {
  if (!razorpayInstance) {
    validateRazorpayEnvVars(); // Validate environment variables before initialization

    try {
      razorpayInstance = new Razorpay({
        key_id: config.RAZORPAY_KEY_ID,
        key_secret: config.RAZORPAY_KEY_SECRET,
      });

      logger.info("✅ Razorpay instance initialized successfully.");
    } catch (error) {
      const errorMessage = `❌ Failed to initialize Razorpay: ${error.message}`;
      logger.error(errorMessage);
      throw new Error(errorMessage); // Fail fast in all environments
    }
  }
  return razorpayInstance;
};

// Export a singleton instance of Razorpay
const razorpay = initializeRazorpay();
export default razorpay;