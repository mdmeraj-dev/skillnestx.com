import express from "express";
import { toggleSavedCourse, getSavedCourses, removeSavedCourse } from "../controllers/savedCoursesController.js";
import { ensureAuthenticated, setSecurityHeaders } from "../middleware/authMiddleware.js";

const router = express.Router();

// Apply security headers and authentication middleware to all routes
router.use(setSecurityHeaders);
router.use(ensureAuthenticated);

// Route to toggle (save/unsave) a course
router.post("/toggle", toggleSavedCourse);

// Route to get all saved courses for the authenticated user
router.get("/", getSavedCourses);

// Route to remove a specific saved course
router.delete("/:courseId", removeSavedCourse);

export default router;