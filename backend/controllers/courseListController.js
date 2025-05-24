import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import Course from "../models/Course.js";


// @desc    Get all courses
// @route   GET /api/courses
// @access  Public
const getCourses = asyncHandler(async (req, res) => {
  try {
    const courses = await Course.find({}).lean(); // Use .lean() for faster JSON response
    if (courses.length > 0) {
      res.json({ success: true, courses });
    } else {
      res.status(404).json({ success: false, message: "No courses found" });
    }
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// @desc    Get courses by category
// @route   GET /api/courses/category/:category
// @access  Public
const getCoursesByCategory = asyncHandler(async (req, res) => {
  try {
    const category = req.params.category;
    const courses = await Course.find({ category }).lean(); // Use .lean() for faster JSON response
    if (courses.length > 0) {
      res.json({ success: true, courses });
    } else {
      res.status(404).json({ success: false, message: "No courses found in this category" });
    }
  } catch (error) {
    console.error("Error fetching courses by category:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// @desc    Get a single course by _id
// @route   GET /api/courses/:id
// @access  Public
const getCourseById = asyncHandler(async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid course ID" });
    }
    const course = await Course.findById(req.params.id).lean(); // Use .lean() for faster JSON response
    if (course) {
      res.json({ success: true, course });
    } else {
      res.status(404).json({ success: false, message: "Course not found" });
    }
  } catch (error) {
    console.error("Error fetching course by ID:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// @desc    Search courses by title or category
// @route   GET /api/courses/search?title=...&category=...
// @access  Public
const searchCourses = asyncHandler(async (req, res) => {
  try {
    const { title, category } = req.query;
    let query = {};

    // If title is provided, perform a case-insensitive search
    if (title) {
      query.title = { $regex: title, $options: "i" };
    }

    // If category is provided, perform an exact match (case-insensitive)
    if (category) {
      query.category = { $regex: new RegExp(`^${category.trim()}$`, "i") };
    }

    // Find courses based on the query
    const courses = await Course.find(query).lean(); // Use .lean() for faster JSON response
    if (courses.length === 0) {
      return res.status(404).json({ success: false, message: "No courses found" });
    }

    res.json({ success: true, courses });
  } catch (error) {
    console.error("Error searching courses:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// @desc    Fetch syllabus for a specific course by ID
// @route   GET /api/courses/:id/syllabus
// @access  Public
const getCourseSyllabus = asyncHandler(async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid course ID" });
    }
    const course = await Course.findById(req.params.id).select("syllabus").lean(); // Use .lean() for faster JSON response
    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }
    res.json({ success: true, syllabus: Array.isArray(course.syllabus) ? course.syllabus : [] });
  } catch (error) {
    console.error("Error fetching syllabus:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

export {
  getCourses,
  getCoursesByCategory,
  getCourseById,
  searchCourses,
  getCourseSyllabus,
};