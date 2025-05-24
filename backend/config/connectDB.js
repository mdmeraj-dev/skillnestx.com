import mongoose from "mongoose";
import { logger } from "../utils/logger.js";
import config from "../config.js";

// MongoDB connection options
const connectionOptions = {
   dbName: "skillnestx_lms_db" ,
  connectTimeoutMS: 60000, // 60 seconds timeout
  socketTimeoutMS: 60000, // 60 seconds socket timeout
  maxPoolSize: 16, // Max 10 connections
  serverSelectionTimeoutMS: 5000, // 5 seconds server selection timeout
  autoIndex: process.env.NODE_ENV === "production" ? false : true, // Disable auto-indexing in production
  bufferCommands: false, // Fail fast on connection issues
};

/**
 * Connect to MongoDB with retry logic
 * @returns {Promise<void>}
 * @throws {Error} If connection fails after retries
 */
export const connectDB = async () => {
  const maxRetries = 16;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await mongoose.connect(config.MONGO_URI, connectionOptions);
      logger.info("Successfully connected to MongoDB");
      return;
    } catch (error) {
      if (attempt === maxRetries) {
        throw Object.assign(
          new Error(
            `Failed to connect to MongoDB after ${maxRetries} attempts: ${error.message}`
          ),
          { code: "MONGO_CONNECTION_ERROR" }
        );
      }

      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

// Handle MongoDB connection events
mongoose.connection.on("error", (error) => {
  // Silent error handling
});

mongoose.connection.on("disconnected", () => {
  if (process.env.NODE_ENV === "production") {
    connectDB().catch(() => {
      // Silent reconnection failure
    });
  }
});

mongoose.connection.on("connected", () => {
  // Silent reconnection
});