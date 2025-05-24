import express from "express";
import { getPurchasedCourses } from "../controllers/purchasedCourseController.js";
import { ensureAuthenticated, setSecurityHeaders } from "../middleware/authMiddleware.js";

const router = express.Router();

// Route to fetch purchased courses for the authenticated user
router.get("/purchased-courses", setSecurityHeaders, ensureAuthenticated, getPurchasedCourses);

export default router;