import express from "express";
import {
  getCourses,
  getCoursesByCategory,
  getCourseById,
  searchCourses,
  getCourseSyllabus,
} from "../controllers/courseListController.js";

const router = express.Router();

// Route to get all courses
router.route("/").get(getCourses);

// Route to get courses by category
router.route("/category/:category").get(getCoursesByCategory);

// Route to search courses by title or category
router.route("/search").get(searchCourses);

// Route to get a single course by ID
router.route("/:id").get(getCourseById);

// Route to fetch syllabus for a specific course by ID
router.route("/:id/syllabus").get(getCourseSyllabus);

export default router;