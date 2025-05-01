import express from "express";
import UserProgressController from "../controllers/userProgressController.js";
import { isAuthenticated } from "../middleware/authMiddleware.js"; // Middleware for protected routes

const router = express.Router();

// Apply authentication middleware to all routes below
router.use(isAuthenticated);

// Progress routes
router.get("/progress", UserProgressController.getProgress); // Get progress for a user and course
router.post("/progress", UserProgressController.updateProgress); // Update or create progress
router.post("/progress/mark-completed", UserProgressController.markAsCompleted); // Mark a lesson as completed
router.post("/progress/update-quiz-score", UserProgressController.updateQuizScore); // Update quiz score for an assessment
router.delete("/progress", UserProgressController.deleteProgress); // Delete a progress entry

export default router;