import mongoose from "mongoose";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import Course from "../models/Course.js";

dotenv.config();
await connectDB();

// Seed Database Function
const seedDatabase = async () => {
  try {
    console.log("Deleting existing courses...");
    await Course.deleteMany();

    console.log("Adding new courses...");
    await Course.insertMany(courses);
    console.log("Courses added successfully!");

    // Disconnect Database
    await mongoose.connection.close();
    console.log("Database connection closed.");
    process.exit();
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
};

seedDatabase();
