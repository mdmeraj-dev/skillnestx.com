// routes/feedbackRoutes.js
import express from "express";
import { submitFeedback, getAllFeedback } from "../controllers/feedbackController.js";

const router = express.Router();

// POST /api/feedback
router.post("/feedback", submitFeedback);

// GET /api/feedback (Admin-only)
router.get("/feedback", getAllFeedback);

export default router;