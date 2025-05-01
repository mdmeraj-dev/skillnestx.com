import mongoose from "mongoose";

const connectDB = async () => {
  try {
    // Ensure MONGO_URI is set in your environment variables
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not defined in the environment variables.");
    }

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
  } catch (error) {
    process.exit(1); // Exit the process with failure
  }
};

export default connectDB;