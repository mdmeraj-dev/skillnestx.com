import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Get the current directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine environment
const nodeEnv = process.env.NODE_ENV || "development";
console.log(`Environment: ${nodeEnv}`);

// Load .env file only in development or if explicitly needed
if (nodeEnv !== "production") {
  const envFile = nodeEnv === "production" ? ".env.production" : ".env.development";
  const envPath = path.resolve(__dirname, "..", envFile);
  console.log(`Attempting to load .env file: ${envPath}`);

  const envConfig = dotenv.config({ path: envPath });
  if (envConfig.error) {
    console.warn(`⚠️ Failed to load ${envFile}: ${envConfig.error.message}`);
    console.log("Proceeding without .env file, relying on environment variables.");
  } else {
    console.log(`✅ Successfully loaded ${envFile}`);
  }
} else {
  console.log("Production environment detected. Skipping .env file loading, assuming environment variables are set externally (e.g., Render dashboard).");
}

// Validate required environment variables
const requiredEnvVars = [
  "PORT",
  "MONGO_URI",
  "JWT_SECRET",
  "CLIENT_URL",
  "VITE_BACKEND_URL",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
];

const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  const errorMessage = `❌ Missing required environment variables: ${missingEnvVars.join(", ")}`;
  console.error(errorMessage);
  throw new Error(errorMessage);
}

// Export configuration object
export default {
  PORT: parseInt(process.env.PORT, 10) || 5000, // Ensure PORT is a number, default to 5000
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  CLIENT_URL: process.env.CLIENT_URL,
  VITE_BACKEND_URL: process.env.VITE_BACKEND_URL,
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
};