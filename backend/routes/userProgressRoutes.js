import express from "express";
import { setSecurityHeaders, ensureAuthenticated } from "../middleware/authMiddleware.js";
import { validateIds } from "../middleware/validateIds.js";
import { getCourseProgress, markLessonCompleted, markCourseCompleted, getCompletedCourses, getInProgressCourses } from "../controllers/userProgressController.js";
import { logger } from "../utils/logger.js";

const router = express.Router();

router.get(
  "/:courseId",
  setSecurityHeaders,
  ensureAuthenticated,
  validateIds,
  (req, res, next) => {
    logger.info("GET /api/progress/:courseId reached", {
      traceId: req.traceId,
      params: req.params,
      user: req.user,
      headers: { authorization: req.headers.authorization?.substring(0, 20) + "..." },
    });
    next();
  },
  getCourseProgress
);

router.post(
  "/",
  setSecurityHeaders,
  ensureAuthenticated,
  validateIds,
  (req, res, next) => {
    logger.info("POST /api/progress reached", {
      traceId: req.traceId,
      body: req.body,
      user: req.user,
    });
    next();
  },
  markLessonCompleted
);

router.post(
  "/mark-completed",
  setSecurityHeaders,
  ensureAuthenticated,
  validateIds,
  (req, res, next) => {
    logger.info("POST /api/progress/mark-completed reached", {
      traceId: req.traceId,
      body: req.body,
      user: req.user,
    });
    next();
  },
  markCourseCompleted
);

router.get(
  "/completed/:userId",
  setSecurityHeaders,
  ensureAuthenticated,
  validateIds,
  (req, res, next) => {
    logger.info("GET /api/progress/completed/:userId reached", {
      traceId: req.traceId,
      params: req.params,
      user: req.user,
    });
    next();
  },
  getCompletedCourses
);

router.get(
  "/in-progress/:userId",
  setSecurityHeaders,
  ensureAuthenticated,
  validateIds,
  (req, res, next) => {
    logger.info("GET /api/progress/in-progress/:userId reached", {
      traceId: req.traceId,
      params: req.params,
      user: req.user,
    });
    next();
  },
  getInProgressCourses
);

export default router;