import express from "express";
import {
  getCourses,
  getCoursesByCategory,
  getCourseById,
  searchCourses,
  getCourseSyllabus,
} from "../controllers/courseListController.js";

const router = express.Router();

// Middleware to log requests for debugging
const logRequest = (req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} | TraceId: ${req.headers["x-trace-id"] || "none"}`);
  next();
};

// Placeholder for authentication middleware (uncomment and implement if required)
// const authMiddleware = (req, res, next) => {
//   const token = req.headers.authorization?.split(" ")[1];
//   if (!token) {
//     return res.status(401).json({ success: false, message: "No token provided" });
//   }
//   try {
//     // Verify token (e.g., using jwt.verify)
//     // Example: const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     next();
//   } catch (error) {
//     return res.status(401).json({ success: false, message: "Invalid token" });
//   }
// };

// Route to get all courses
router.route("/").get(logRequest, getCourses);

// Route to get courses by category
router.route("/category/:category").get(logRequest, getCoursesByCategory);

// Route to search courses by title or category
router.route("/search").get(logRequest, searchCourses);

// Route to get a single course by ID
router.route("/:id").get(logRequest, getCourseById);

// Route to fetch syllabus for a specific course by ID
router.route("/:id/syllabus").get(logRequest, /* authMiddleware, */ getCourseSyllabus);

export default router;