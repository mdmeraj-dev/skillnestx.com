// backend/middleware/validateIds.js
import { logger } from "../utils/logger.js";

export const validateIds = (req, res, next) => {
  const traceId = req.traceId || Date.now().toString(36);
  const { userId, courseId, lessonId } = { ...req.params, ...req.body };
  const isValidObjectId = (id) => /^[0-9a-fA-F]{24}$/.test(id);

  logger.info("validateIds: Checking IDs", { traceId, userId, courseId, lessonId });

  if (
    (userId && !isValidObjectId(userId)) ||
    (courseId && !isValidObjectId(courseId)) ||
    (lessonId && !isValidObjectId(lessonId))
  ) {
    logger.warn("validateIds: Invalid ID format", { traceId, userId, courseId, lessonId });
    return res.status(400).json({
      success: false,
      code: "INVALID_ID",
      message: "Invalid ID format",
      traceId,
    });
  }

  logger.info("validateIds: IDs valid", { traceId, userId, courseId, lessonId });
  next();
};