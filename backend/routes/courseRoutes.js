import express from "express";
import { check, validationResult } from "express-validator";
import { randomUUID } from "crypto";
import asyncHandler from "express-async-handler";
import { logger } from "../utils/logger.js";
import {
  getTotalCourses,
  getRecentCourses,
  getCourseDetails,
  createCourse,
  getCourse,
  updateCourse,
  deleteCourse,
  searchCourses,
  createSection,
  getSection,
  updateSection,
  deleteSection,
  createLesson,
  getLesson,
  updateLesson,
  deleteLesson,
  createQuiz,
  getQuiz,
  updateQuiz,
  deleteQuiz,
  getAllCourses, // Ensure this is imported
} from "../controllers/courseController.js";
import {
  ensureAuthenticated,
  ensureAdmin,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// Apply authentication and authorization middleware to all routes
router.use(asyncHandler(ensureAuthenticated), asyncHandler(ensureAdmin));

// ======================
// Validation Middleware
// ======================

// Centralized validation handler
const validate = (req, res, next) => {
  const traceId = req.headers?.["x-trace-id"] || randomUUID();
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn("Validation errors", { traceId, errors: errors.array() });
    return res.status(400).json({
      success: false,
      code: "INVALID_INPUT",
      message: "Validation failed",
      errors: errors.array(),
      traceId,
    });
  }
  next();
};

// Validate course creation (strict) and update (partial)
const validateCourse = [
  check("title")
    .optional() // Optional for updates
    .trim()
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ max: 200 })
    .withMessage("Title must not exceed 200 characters"),
  check("description")
    .optional() // Optional for updates
    .trim()
    .notEmpty()
    .withMessage("Description is required")
    .isLength({ min: 10, max: 2000 })
    .withMessage("Description must be between 10 and 2000 characters"),
  check("category")
    .optional() // Optional for updates
    .trim()
    .notEmpty()
    .withMessage("Category is required")
    .isIn([
      "Frontend",
      "Backend",
      "Machine Learning",
      "Artificial Intelligence",
      "System Design",
      "Database",
    ])
    .withMessage("Invalid category"),
  check("imageUrl")
    .optional()
    .isURL({
      protocols: ["http", "https"],
      require_protocol: true,
      allow_underscores: true,
    })
    .withMessage("Invalid image URL")
    .isLength({ max: 1000 })
    .withMessage("Image URL must not exceed 1000 characters"),
  check("oldPrice")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Old price must be a non-negative integer")
    .toInt(),
  check("newPrice")
    .optional()
    .isInt({ min: 0 })
    .withMessage("New price must be a non-negative integer")
    .toInt()
    .custom((newPrice, { req }) => {
      if (req.body.oldPrice !== undefined && newPrice > req.body.oldPrice) {
        throw new Error("New price cannot be greater than old price");
      }
      return true;
    }),
  check("rating")
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage("Rating must be between 0 and 5")
    .toFloat(),
  check("ratingCount")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Rating count must be a non-negative integer")
    .toInt(),
  check("tags")
    .optional()
    .isArray()
    .withMessage("Tags must be an array")
    .custom(
      (tags) =>
        tags.length <= 20 &&
        tags.every((tag) => typeof tag === "string" && tag.length <= 50)
    )
    .withMessage(
      "Tags must be an array of strings (max 20 tags, 50 chars each)"
    ),
  check("syllabus")
    .optional()
    .isArray()
    .withMessage("Syllabus must be an array")
    .custom((syllabus) => {
      if (syllabus.length > 50) return false; // Max 50 sections
      if (syllabus.length === 0) return true; // Allow empty syllabus
      return syllabus.every(
        (section) =>
          typeof section.title === "string" &&
          section.title.trim().length > 0 &&
          section.title.trim().length <= 100 &&
          Array.isArray(section.lessons) &&
          section.lessons.length <= 100 && // Max 100 lessons per section
          (section.lessons.length === 0 ||
            section.lessons.every(
              (lesson) =>
                typeof lesson.title === "string" &&
                lesson.title.trim().length > 0 &&
                lesson.title.trim().length <= 100 &&
                typeof lesson.content === "string" &&
                lesson.content.length <= 10000 &&
                typeof lesson.isLocked === "boolean" &&
                ["lesson", "assessment"].includes(lesson.type) &&
                (lesson.quiz
                  ? Array.isArray(lesson.quiz) &&
                    lesson.quiz.length <= 50 && // Max 50 questions
                    lesson.quiz.every(
                      (q) =>
                        typeof q.question === "string" &&
                        q.question.trim().length > 0 &&
                        q.question.trim().length <= 500 &&
                        Array.isArray(q.options) &&
                        q.options.length === 4 &&
                        q.options.every(
                          (opt) =>
                            typeof opt === "string" &&
                            opt.trim().length > 0 &&
                            opt.trim().length <= 200
                        ) &&
                        typeof q.correctAnswer === "string" &&
                        q.correctAnswer.trim().length > 0 &&
                        q.correctAnswer.trim().length <= 200 &&
                        q.options.includes(q.correctAnswer)
                    )
                  : true)
            ))
      );
    })
    .withMessage("Syllabus must be an array of valid sections"),
  validate,
];

// Validate section creation/update
const validateSection = [
  check("title")
    .optional() // Optional for updates
    .trim()
    .notEmpty()
    .withMessage("Section title is required")
    .isLength({ max: 100 })
    .withMessage("Section title must not exceed 100 characters"),
  check("lessons")
    .optional()
    .isArray()
    .withMessage("Lessons must be an array")
    .custom((lessons) => lessons.length <= 100)
    .withMessage("Lessons must not exceed 100 per section")
    .custom((lessons) => {
      if (lessons.length === 0) return true; // Allow empty lessons
      return lessons.every(
        (lesson) =>
          typeof lesson.title === "string" &&
          lesson.title.trim().length > 0 &&
          lesson.title.trim().length <= 100 &&
          typeof lesson.content === "string" &&
          lesson.content.length <= 10000 &&
          typeof lesson.isLocked === "boolean" &&
          ["lesson", "assessment"].includes(lesson.type) &&
          (lesson.quiz
            ? Array.isArray(lesson.quiz) &&
              lesson.quiz.length <= 50 &&
              lesson.quiz.every(
                (q) =>
                  typeof q.question === "string" &&
                  q.question.trim().length > 0 &&
                  q.question.trim().length <= 500 &&
                  Array.isArray(q.options) &&
                  q.options.length === 4 &&
                  q.options.every(
                    (opt) =>
                      typeof opt === "string" &&
                      opt.trim().length > 0 &&
                      opt.trim().length <= 200
                  ) &&
                  typeof q.correctAnswer === "string" &&
                  q.correctAnswer.trim().length > 0 &&
                  q.correctAnswer.trim().length <= 200 &&
                  q.options.includes(q.correctAnswer)
              )
            : true)
      );
    })
    .withMessage("Lessons must be valid lesson objects"),
  validate,
];

// Validate lesson creation/update
const validateLesson = [
  check("title")
    .optional() // Optional for updates
    .trim()
    .notEmpty()
    .withMessage("Lesson title is required")
    .isLength({ max: 100 })
    .withMessage("Lesson title must not exceed 100 characters"),
  check("content")
    .optional() // Optional for updates
    .notEmpty()
    .withMessage("Lesson content is required")
    .isLength({ max: 10000 })
    .withMessage("Lesson content must not exceed 10000 characters"),
  check("isLocked")
    .optional()
    .isBoolean()
    .withMessage("isLocked must be a boolean"),
  check("type")
    .optional()
    .isIn(["lesson", "assessment"])
    .withMessage("Type must be either 'lesson' or 'assessment'"),
  check("quiz")
    .optional()
    .isArray()
    .withMessage("Quiz must be an array")
    .custom((quiz) => quiz.length <= 50)
    .withMessage("Quiz must not exceed 50 questions")
    .custom((quiz) => {
      if (quiz.length === 0) return true; // Allow empty quiz
      return quiz.every(
        (q) =>
          typeof q.question === "string" &&
          q.question.trim().length > 0 &&
          q.question.trim().length <= 500 &&
          Array.isArray(q.options) &&
          q.options.length === 4 &&
          q.options.every(
            (opt) =>
              typeof opt === "string" &&
              opt.trim().length > 0 &&
              opt.trim().length <= 200
          ) &&
          typeof q.correctAnswer === "string" &&
          q.correctAnswer.trim().length > 0 &&
          q.correctAnswer.trim().length <= 200 &&
          q.options.includes(q.correctAnswer)
      );
    })
    .withMessage("Quiz must be an array of valid questions"),
  validate,
];

// Validate quiz creation
const validateQuiz = [
  check("quiz")
    .isArray()
    .withMessage("Quiz must be an array")
    .custom((quiz) => quiz.length <= 50)
    .withMessage("Quiz must not exceed 50 questions")
    .custom((quiz) => {
      if (quiz.length === 0) return true; // Allow empty quiz
      return quiz.every(
        (q) =>
          typeof q.question === "string" &&
          q.question.trim().length > 0 &&
          q.question.trim().length <= 500 &&
          Array.isArray(q.options) &&
          q.options.length === 4 &&
          q.options.every(
            (opt) =>
              typeof opt === "string" &&
              opt.trim().length > 0 &&
              opt.trim().length <= 200
          ) &&
          typeof q.correctAnswer === "string" &&
          q.correctAnswer.trim().length > 0 &&
          q.correctAnswer.trim().length <= 200 &&
          q.options.includes(q.correctAnswer)
      );
    })
    .withMessage("Quiz must be an array of valid questions"),
  validate,
];

// Validate quiz question update
const validateQuizQuestion = [
  check("question")
    .trim()
    .notEmpty()
    .withMessage("Quiz question is required")
    .isLength({ max: 500 })
    .withMessage("Quiz question must not exceed 500 characters"),
  check("options")
    .isArray()
    .withMessage("Quiz options must be an array")
    .custom((options) => options.length === 4)
    .withMessage("Quiz must have exactly 4 options")
    .custom((options) =>
      options.every((opt) => typeof opt === "string" && opt.length <= 200)
    )
    .withMessage("Each option must be a string not exceeding 200 characters"),
  check("correctAnswer")
    .trim()
    .notEmpty()
    .withMessage("Correct answer is required")
    .isLength({ max: 200 })
    .withMessage("Correct answer must not exceed 200 characters")
    .custom((correctAnswer, { req }) =>
      req.body.options.includes(correctAnswer)
    )
    .withMessage("Correct answer must be one of the provided options"),
  validate,
];

// Validate search query
const validateSearch = [
  check("query")
    .trim()
    .notEmpty()
    .withMessage("Search query is required")
    .isLength({ min: 1, max: 100 })
    .withMessage("Search query must be between 1 and 100 characters"),
  check("page")
    .optional()
    .default(1)
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer")
    .toInt(),
  check("limit")
    .optional()
    .default(10)
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100")
    .toInt(),
  validate,
];

// Validate recent courses query
const validateRecentCourses = [
  check("year")
    .optional()
    .isInt({ min: 2000, max: 2100 })
    .withMessage("Year must be between 2000 and 2100")
    .toInt(),
  check("month")
    .optional()
    .isInt({ min: 1, max: 12 })
    .withMessage("Month must be between 1 and 12")
    .toInt(),
  validate,
];

// Validate course details query
const validateCourseDetails = [
  check("page")
    .optional()
    .default(1)
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer")
    .toInt(),
  check("limit")
    .optional()
    .default(10)
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100")
    .toInt(),
  check("sortBy")
    .optional()
    .isIn([
      "title",
      "category",
      "oldPrice",
      "newPrice",
      "rating",
      "ratingCount",
      "updatedAt",
    ])
    .withMessage("Invalid sort field"),
  check("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be 'asc' or 'desc'"),
  validate,
];

// ======================
// Course Management Routes
// ======================

// Get all courses or create a new course
router
  .route("")
  .get(validateCourseDetails, asyncHandler(getAllCourses))
  .post(validateCourse, asyncHandler(createCourse));

// Get detailed course information for admin dashboard
router.get("/details", validateCourseDetails, asyncHandler(getCourseDetails));

// Search courses by title or category
router.get("/search", validateSearch, asyncHandler(searchCourses));

// Get total courses and history
router.get("/total", asyncHandler(getTotalCourses));

// Get recent courses for a specific month
router.get("/recent", validateRecentCourses, asyncHandler(getRecentCourses));

// Manage a specific course
router
  .route("/:courseId")
  .get(asyncHandler(getCourse))
  .put(validateCourse, asyncHandler(updateCourse))
  .delete(asyncHandler(deleteCourse));

// ======================
// Section Management Routes
// ======================

// Create a new section
router.post(
  "/:courseId/sections",
  validateSection,
  asyncHandler(createSection)
);

// Manage a specific section
router
  .route("/:courseId/sections/:sectionId")
  .get(asyncHandler(getSection))
  .put(validateSection, asyncHandler(updateSection))
  .delete(asyncHandler(deleteSection));

// ======================
// Lesson Management Routes
// ======================

// Create a new lesson
router.post(
  "/:courseId/sections/:sectionId/lessons",
  validateLesson,
  asyncHandler(createLesson)
);

// Manage a specific lesson
router
  .route("/:courseId/sections/:sectionId/lessons/:lessonId")
  .get(asyncHandler(getLesson))
  .put(validateLesson, asyncHandler(updateLesson))
  .delete(asyncHandler(deleteLesson));

// ======================
// Quiz Management Routes
// ======================

// Get or create a quiz for a lesson
router
  .route("/:courseId/sections/:sectionId/lessons/:lessonId/quiz")
  .get(asyncHandler(getQuiz))
  .post(validateQuiz, asyncHandler(createQuiz));

// Manage a specific quiz question
router
  .route("/:courseId/sections/:sectionId/lessons/:lessonId/quiz/:quizId")
  .put(validateQuizQuestion, asyncHandler(updateQuiz))
  .delete(asyncHandler(deleteQuiz));

// ======================
// Error Handling
// ======================

// Handle invalid routes
router.use((req, res, next) => {
  const traceId = req.headers?.["x-trace-id"] || randomUUID();
  logger.warn(`Route not found: ${req.method} ${req.originalUrl}`, { traceId });
  res.status(404).json({
    success: false,
    code: "NOT_FOUND",
    message: `Route ${req.method} ${req.originalUrl} not found`,
    traceId,
  });
});

// Handle invalid methods
router.use((req, res, next) => {
  const traceId = req.headers?.["x-trace-id"] || randomUUID();
  logger.warn(`Method not allowed: ${req.method} ${req.originalUrl}`, {
    traceId,
  });
  res.status(405).json({
    success: false,
    code: "METHOD_NOT_ALLOWED",
    message: `Method ${req.method} not allowed on ${req.originalUrl}`,
    traceId,
  });
});

// Global error handler
router.use((err, req, res, next) => {
  const traceId = req.headers?.["x-trace-id"] || randomUUID();
  logger.error(`Server error: ${err.message}`, { traceId, stack: err.stack });

  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      code: "INVALID_INPUT",
      message: "Validation failed",
      errors: Object.values(err.errors).map((e) => e.message),
      traceId,
    });
  }

  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      code: "INVALID_ID",
      message: "Invalid ID format",
      traceId,
    });
  }

  if (err.name === "UnauthorizedError") {
    return res.status(401).json({
      success: false,
      code: "UNAUTHORIZED",
      message: "Authentication required",
      traceId,
    });
  }

  res.status(500).json({
    success: false,
    code: "SERVER_ERROR",
    message: "Internal server error",
    traceId,
  });
});

export default router;