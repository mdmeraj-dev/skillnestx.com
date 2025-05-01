import express from "express";
import {
  addCourse,
  addSectionToCourse,
  addLessonToSection,
  addQuizToSection,
  getAllCourses,
  getCourseById,
  getTotalCourseCount,
  getSection,
  getLesson,
  getQuiz,
  updateCourse,
  updateSection,
  updateLesson,
  updateQuizQuestion,
  deleteCourse,
  deleteSection,
  deleteLesson,
  deleteQuizQuestion,
} from "../controllers/courseController.js"; // Import all required controller functions
import { isAuthenticated, checkRole } from "../middleware/authMiddleware.js"; // Middleware for authentication and role-based access

const router = express.Router();

// Apply authentication and authorization middleware to all course routes
router.use(isAuthenticated, checkRole("admin"));

// ======================
// Validation Middleware
// ======================

// Middleware to validate courseId, sectionId, lessonId, and quizId
const validateIds = (req, res, next) => {
  const { courseId, sectionId, lessonId, quizId } = req.params;

  if (courseId && !courseId.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({ message: "Invalid course ID." });
  }
  if (sectionId && !sectionId.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({ message: "Invalid section ID." });
  }
  if (lessonId && !lessonId.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({ message: "Invalid lesson ID." });
  }
  if (quizId && !quizId.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({ message: "Invalid quiz ID." });
  }

  next();
};

// ======================
// Course Management Routes
// ======================

// Get all courses
router.get("/", getAllCourses);

// Add a new course
router.post("/", addCourse);

// Get total number of courses
router.get("/total/count", getTotalCourseCount);

// Routes for a specific course
router
  .route("/:courseId")
  .all(validateIds) // Validate courseId
  .get(getCourseById) // Get a specific course by ID
  .put(updateCourse) // Update an existing course
  .delete(deleteCourse); // Delete a course

// ======================
// Section Management Routes
// ======================

// Add a new section to a course
router
  .route("/:courseId/sections")
  .all(validateIds) // Validate courseId
  .post(addSectionToCourse);

// Routes for a specific section
router
  .route("/:courseId/sections/:sectionId")
  .all(validateIds) // Validate courseId and sectionId
  .get(getSection) // Get a specific section of a course
  .put(updateSection) // Update a specific section
  .delete(deleteSection); // Delete a specific section of a course

// ======================
// Lesson Management Routes
// ======================

// Add a new lesson to a section
router
  .route("/:courseId/sections/:sectionId/lessons")
  .all(validateIds) // Validate courseId and sectionId
  .post(addLessonToSection);

// Routes for a specific lesson
router
  .route("/:courseId/sections/:sectionId/lessons/:lessonId")
  .all(validateIds) // Validate courseId, sectionId, and lessonId
  .get(getLesson) // Get a specific lesson of a section
  .put(updateLesson) // Update a specific lesson
  .delete(deleteLesson); // Delete a specific lesson of a section

// ======================
// Quiz Management Routes
// ======================

// Add quiz questions to a section
router
  .route("/:courseId/sections/:sectionId/quiz")
  .all(validateIds) // Validate courseId and sectionId
  .post(addQuizToSection);

// Routes for a specific quiz question
router
  .route("/:courseId/sections/:sectionId/quiz/:quizId")
  .all(validateIds) // Validate courseId, sectionId, and quizId
  .get(getQuiz) // Get a specific quiz question
  .put(updateQuizQuestion) // Update a specific quiz question
  .delete(deleteQuizQuestion); // Delete a specific quiz question

// ======================
// Error Handling for Invalid Routes
// ======================

// Handle invalid routes
router.use((req, res) => {
  res.status(404).json({ message: "Route not found." });
});

// Handle errors
router.use((err, req, res, next) => {
  console.error("Error:", err.message);
  res.status(500).json({ message: "Internal server error." });
});

export default router;