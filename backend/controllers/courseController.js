import { randomUUID } from "crypto";
import { validationResult } from "express-validator";
import sanitizeHtml from "sanitize-html";
import validator from "validator";
import { Types } from "mongoose";
import Course from "../models/Course.js";
import { logger } from "../utils/logger.js";
import jwt from "jsonwebtoken";
import axios from "axios";

// Set security headers with relaxed CSP for frontend compatibility
const setSecurityHeaders = (res) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self';",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  });
};

// Middleware to check if user is admin using JWT
const ensureAdmin = async (req, res, traceId) => {
  const authHeader = req.headers["authorization"];
  const BASE_URL = process.env.BACKEND_URL || "http://localhost:5000";

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logger.warn(
      "Admin access failed: Missing or invalid Authorization header",
      { traceId }
    );
    return res.status(401).json({
      success: false,
      code: "UNAUTHORIZED",
      message: "Authentication required",
      traceId,
    });
  }

  const accessToken = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
    req.user = { userId: decoded.userId, role: decoded.role };

    if (decoded.role !== "admin") {
      logger.warn(
        `Admin access denied for userId ${decoded.userId}: Not an admin`,
        { traceId }
      );
      return res.status(403).json({
        success: false,
        code: "FORBIDDEN",
        message: "Admin access required",
        traceId,
      });
    }

    return true;
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      const refreshToken = req.headers["x-refresh-token"];
      if (!refreshToken) {
        logger.warn("Admin access failed: No refresh token provided", {
          traceId,
        });
        return res.status(401).json({
          success: false,
          code: "UNAUTHORIZED",
          message: "Refresh token required",
          traceId,
        });
      }

      try {
        const refreshResponse = await axios.post(
          `${BASE_URL}/api/auth/refresh-token`,
          { refreshToken },
          {
            headers: { "X-Trace-Id": traceId },
          }
        );

        if (refreshResponse.data.success && refreshResponse.data.tokens) {
          const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
            refreshResponse.data.tokens;
          res.setHeader("X-Access-Token", newAccessToken);
          res.setHeader("X-Refresh-Token", newRefreshToken);

          const decoded = jwt.verify(newAccessToken, process.env.JWT_SECRET);
          req.user = { userId: decoded.userId, role: decoded.role };

          if (decoded.role !== "admin") {
            logger.warn(
              `Admin access denied for userId ${decoded.userId}: Not an admin`,
              { traceId }
            );
            return res.status(403).json({
              success: false,
              code: "FORBIDDEN",
              message: "Admin access required",
              traceId,
            });
          }

          return true;
        } else {
          logger.warn("Admin access failed: Token refresh failed", { traceId });
          return res.status(401).json({
            success: false,
            code: "UNAUTHORIZED",
            message: "Failed to refresh token",
            traceId,
          });
        }
      } catch (refreshError) {
        logger.error(`Token refresh error: ${refreshError.message}`, {
          traceId,
          stack: refreshError.stack,
        });
        return res.status(401).json({
          success: false,
          code: "UNAUTHORIZED",
          message: "Invalid refresh token",
          traceId,
        });
      }
    }

    logger.warn(`Admin access failed: Invalid token - ${error.message}`, {
      traceId,
    });
    return res.status(401).json({
      success: false,
      code: "UNAUTHORIZED",
      message: "Invalid token",
      traceId,
    });
  }
};

// Validate MongoDB ID using Mongoose
const isValidObjectId = (id) => Types.ObjectId.isValid(id);

// Enhanced sanitize input with length limits
const sanitizeInput = (input, maxLength = 1000, key) => {
  if (typeof input === "string") {
    const trimmed = input.trim().slice(0, maxLength);
    const allowedTags = key === "content" ? ["code"] : [];
    return sanitizeHtml(trimmed, {
      allowedTags,
      allowedAttributes: {},
    });
  }
  if (Array.isArray(input)) {
    return input.map((item) => sanitizeInput(item, maxLength, key));
  }
  if (typeof input === "object" && input !== null) {
    return Object.fromEntries(
      Object.entries(input).map(([k, value]) => [
        k,
        sanitizeInput(value, maxLength, k),
      ])
    );
  }
  return input;
};

// Allowed categories for courses (aligned with Course.js schema)
const ALLOWED_CATEGORIES = [
  "Frontend",
  "Backend",
  "Machine Learning",
  "Artificial Intelligence",
  "System Design",
  "Database",
];

// Normalize form data with stricter validation
const normalizeFormData = (body) => {
  const normalized = {};
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null || value === "") {
      if (key === "rating" || key === "ratingCount") normalized[key] = 0;
      if (key === "syllabus" || key === "lessons" || key === "quiz")
        normalized[key] = [];
      continue;
    }
    if (key === "tags" && typeof value === "string") {
      normalized[key] = value
        .split(",")
        .map((tag) => sanitizeInput(tag.trim(), 50, key))
        .filter((tag) => tag.length > 0 && tag.length <= 50)
        .slice(0, 20);
    } else if (key === "syllabus" && typeof value === "string") {
      try {
        normalized[key] = JSON.parse(value);
        if (!Array.isArray(normalized[key])) {
          normalized[key] = [];
        }
      } catch {
        normalized[key] = [];
      }
    } else if (key === "category") {
      const sanitized = sanitizeInput(value, 50, key);
      normalized[key] = ALLOWED_CATEGORIES.includes(sanitized)
        ? sanitized
        : undefined;
    } else if (
      ["oldPrice", "newPrice", "rating", "ratingCount"].includes(key)
    ) {
      const parsed =
        key === "oldPrice" || key === "newPrice"
          ? parseInt(value, 10)
          : parseFloat(value);
      normalized[key] = isNaN(parsed)
        ? key === "rating" || key === "ratingCount"
          ? 0
          : undefined
        : parsed;
    } else {
      normalized[key] = sanitizeInput(
        value,
        key === "description" ? 2000 : key === "content" ? 10000 : 1000,
        key
      );
    }
  }
  return normalized;
};

// Validate syllabus structure with length limits (allow empty syllabus)
const validateSyllabus = (syllabus) => {
  if (!Array.isArray(syllabus) || syllabus.length > 50) return false; // Max 50 sections
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
            (lesson.quiz ? validateQuiz(lesson.quiz) : true)
        ))
  );
};

// Validate quiz structure with correctAnswer validation (allow empty quiz)
const validateQuiz = (quiz) => {
  if (!Array.isArray(quiz) || quiz.length > 50) return false; // Max 50 questions
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
};

// ======================
// Course Management
// ======================

export const getTotalCourses = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  setSecurityHeaders(res);

  try {
    if (!(await ensureAdmin(req, res, traceId))) return;

    const { year = new Date().getFullYear() } = req.query;
    const yearNumber = parseInt(year, 10);

    // Validate year input
    if (
      isNaN(yearNumber) ||
      yearNumber < 2000 ||
      yearNumber > new Date().getFullYear() + 1
    ) {
      logger.warn("Invalid year for total courses", { traceId, year });
      return res.status(400).json({
        success: false,
        code: "INVALID_INPUT",
        message: "Valid year (2000 or later) is required",
        traceId,
      });
    }

    // Define year boundaries in UTC
    const startOfYear = new Date(Date.UTC(yearNumber, 0, 1, 0, 0, 0, 0));
    const endOfYear = new Date(Date.UTC(yearNumber, 11, 31, 23, 59, 59, 999));

    // Fetch total courses and monthly breakdown
    const [total, monthlyData] = await Promise.all([
      Course.countDocuments({
        createdAt: { $gte: startOfYear, $lte: endOfYear },
      }),
      Course.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfYear, $lte: endOfYear },
          },
        },
        {
          $group: {
            _id: { $month: "$createdAt" }, // Month number (1-12)
            count: { $sum: 1 },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]),
    ]);

    // Initialize monthly history array (Jan to Dec)
    const history = Array(12).fill(0);
    monthlyData.forEach((month) => {
      history[month._id - 1] = month.count; // Map month number to array index
    });

    // Verify total matches sum of monthly counts
    const historySum = history.reduce((sum, count) => sum + count, 0);
    if (historySum !== total) {
      logger.warn("Total courses mismatch with monthly sum", {
        traceId,
        total,
        historySum,
      });
    }

    logger.info(`Total courses retrieved for ${yearNumber}`, {
      traceId,
      userId: req.user.userId,
      total,
      history,
      startOfYear: startOfYear.toISOString(),
      endOfYear: endOfYear.toISOString(),
    });

    return res.status(200).json({
      success: true,
      message: "Total courses retrieved successfully",
      data: { total, history }, // history: [count for Jan, Feb, ..., Dec]
      traceId,
    });
  } catch (error) {
    logger.error(`Get total courses error: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      code: "DATABASE_ERROR",
      message: "Failed to fetch total courses",
      traceId,
    });
  }
};

export const getRecentCourses = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  setSecurityHeaders(res);

  try {
    if (!(await ensureAdmin(req, res, traceId))) return;

    const {
      year = new Date().getFullYear(),
      month = new Date().getMonth() + 1,
    } = req.query;
    const yearNumber = parseInt(year, 10);
    const monthNumber = parseInt(month, 10);

    // Validate year and month
    if (
      isNaN(yearNumber) ||
      yearNumber < 2000 ||
      yearNumber > new Date().getFullYear() + 1 ||
      isNaN(monthNumber) ||
      monthNumber < 1 ||
      monthNumber > 12
    ) {
      logger.warn("Invalid year or month for recent courses", {
        traceId,
        year,
        month,
      });
      return res.status(400).json({
        success: false,
        code: "INVALID_INPUT",
        message: "Valid year (2000 or later) and month (1-12) are required",
        traceId,
      });
    }

    // Define month boundaries in UTC
    const startDate = new Date(
      Date.UTC(yearNumber, monthNumber - 1, 1, 0, 0, 0, 0)
    );
    const endDate = new Date(
      Date.UTC(yearNumber, monthNumber, 0, 23, 59, 59, 999)
    );
    const daysInMonth = endDate.getDate();

    // Fetch daily course counts
    const courses = await Course.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { $dayOfMonth: "$createdAt" },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Define dynamic week ranges based on daysInMonth
    const weeksInMonth = Math.ceil(daysInMonth / 7);
    const daysPerWeek = Math.ceil(daysInMonth / weeksInMonth);
    const weekRanges = Array.from({ length: weeksInMonth }, (_, i) => {
      const start = i * daysPerWeek + 1;
      const end = Math.min(start + daysPerWeek - 1, daysInMonth);
      const startPadded = start.toString().padStart(2, "0");
      const endPadded = end.toString().padStart(2, "0");
      return {
        start,
        end,
        label: `Week ${i + 1}: ${startPadded}-${endPadded}`,
      };
    });

    // Initialize weekly counts and labels
    const weekly = Array(4).fill(0);
    const weekLabels = weekRanges.map((range) => range.label);

    // Map daily counts to weeks
    courses.forEach((day) => {
      const dayOfMonth = day._id;
      for (let i = 0; i < weekRanges.length; i++) {
        const { start, end } = weekRanges[i];
        if (dayOfMonth >= start && dayOfMonth <= end) {
          weekly[i] += day.count;
          break;
        }
      }
    });

    // Calculate total courses for the month
    const recent = weekly.reduce((sum, count) => sum + count, 0);

    logger.info(`Recent courses retrieved for ${yearNumber}-${monthNumber}`, {
      traceId,
      userId: req.user.userId,
      recent,
      weekly,
      weekLabels,
    });

    return res.status(200).json({
      success: true,
      message: "Recent courses retrieved successfully",
      data: { recent, weekly, weekLabels }, // weekly: [count for Week 1, Week 2, Week 3, Week 4]
      traceId,
    });
  } catch (error) {
    logger.error(`Get recent courses error: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      code: "DATABASE_ERROR",
      message: "Failed to fetch recent courses",
      traceId,
    });
  }
};

// Get all the details of a course
export const getCourseDetails = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  setSecurityHeaders(res);

  try {
    if (!(await ensureAdmin(req, res, traceId))) return;

    const {
      page = 1,
      limit = 10,
      sortBy = "updatedAt",
      sortOrder = "desc",
    } = req.query;
    const pageNumber = parseInt(page, 10);
    const limitNumber = Math.min(parseInt(limit, 10), 100);
    const validSortFields = [
      "title",
      "category",
      "oldPrice",
      "newPrice",
      "rating",
      "ratingCount",
      "updatedAt",
    ];
    const sortField = validSortFields.includes(sortBy) ? sortBy : "updatedAt";
    const sortDirection = sortOrder === "asc" ? 1 : -1;

    if (
      isNaN(pageNumber) ||
      pageNumber < 1 ||
      isNaN(limitNumber) ||
      limitNumber < 1
    ) {
      logger.warn("Invalid pagination parameters", { traceId, page, limit });
      return res.status(400).json({
        success: false,
        code: "INVALID_PAGINATION",
        message: "Invalid pagination parameters",
        traceId,
      });
    }

    const skip = (pageNumber - 1) * limitNumber;
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [courses, totalCourses, recentCoursesWeekly] = await Promise.all([
      Course.find({})
        .select(
          "title description category imageUrl oldPrice newPrice rating ratingCount updatedAt"
        )
        .sort({ [sortField]: sortDirection })
        .skip(skip)
        .limit(limitNumber)
        .lean(),
      Course.countDocuments(),
      Course.aggregate([
        {
          $match: {
            updatedAt: { $gte: oneMonthAgo },
          },
        },
        {
          $group: {
            _id: {
              week: { $week: "$updatedAt" },
              year: { $year: "$updatedAt" },
            },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { "_id.year": -1, "_id.week": -1 },
        },
        {
          $limit: 4,
        },
      ]),
    ]);

    // Format weekly stats
    const weeklyStats = Array(4).fill(0);
    recentCoursesWeekly.forEach((week) => {
      const weekIndex = Math.floor(
        (Date.now() -
          new Date(week._id.year, 0, (week._id.week - 1) * 7).getTime()) /
          (7 * 24 * 60 * 60 * 1000)
      );
      if (weekIndex >= 0 && weekIndex < 4) {
        weeklyStats[3 - weekIndex] = week.count;
      }
    });

    logger.info(`Fetched ${courses.length} courses with details for admin`, {
      traceId,
      userId: req.user.userId,
    });
    return res.status(200).json({
      success: true,
      message: "Courses retrieved successfully",
      data: {
        courses,
        totalCourses,
        recentCoursesWeekly: weeklyStats,
      },
      pagination: {
        total: totalCourses,
        pages: Math.ceil(totalCourses / limitNumber),
        page: pageNumber,
        limit: limitNumber,
      },
      traceId,
    });
  } catch (error) {
    logger.error(`Fetch courses all details error: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      code: "DATABASE_ERROR",
      message: "Failed to fetch courses details",
      traceId,
    });
  }
};

// Get all courses with pagination
export const getAllCourses = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  setSecurityHeaders(res);

  try {
    if (!(await ensureAdmin(req, res, traceId))) return;

    const { page = 1, limit = 10 } = req.query;
    const pageNumber = parseInt(page, 10);
    const limitNumber = Math.min(parseInt(limit, 10), 100);

    if (
      isNaN(pageNumber) ||
      pageNumber < 1 ||
      isNaN(limitNumber) ||
      limitNumber < 1
    ) {
      logger.warn("Invalid pagination parameters", { traceId, page, limit });
      return res.status(400).json({
        success: false,
        code: "INVALID_PAGINATION",
        message: "Invalid pagination parameters",
        traceId,
      });
    }

    const skip = (pageNumber - 1) * limitNumber;

    const [courses, totalCourses] = await Promise.all([
      Course.find({})
        .select(
          "title description category imageUrl oldPrice newPrice rating ratingCount tags syllabus updatedAt"
        )
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limitNumber)
        .lean(),
      Course.countDocuments(),
    ]);

    logger.info(`Fetched ${courses.length} courses for admin`, {
      traceId,
      userId: req.user.userId,
    });
    return res.status(200).json({
      success: true,
      message: "Courses retrieved successfully",
      data: courses,
      pagination: {
        total: totalCourses,
        pages: Math.ceil(totalCourses / limitNumber),
        page: pageNumber,
        limit: limitNumber,
      },
      traceId,
    });
  } catch (error) {
    logger.error(`Get courses error: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      code: error.name === "CastError" ? "INVALID_ID" : "DATABASE_ERROR",
      message:
        error.name === "CastError"
          ? "Invalid course ID format"
          : "Failed to fetch courses",
      traceId,
    });
  }
};

// Create a new course
export const createCourse = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  setSecurityHeaders(res);

  try {
    if (!(await ensureAdmin(req, res, traceId))) return;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("Validation errors in create course", {
        traceId,
        errors: errors.array(),
      });
      return res.status(400).json({
        success: false,
        code: "INVALID_INPUT",
        errors: errors.array(),
        traceId,
      });
    }

    const normalizedBody = normalizeFormData(req.body);
    const {
      title,
      description,
      category,
      imageUrl,
      oldPrice,
      newPrice,
      rating = 0,
      ratingCount = 0,
      tags = [],
      syllabus = [],
    } = normalizedBody;

    if (
      !title ||
      !description ||
      !category ||
      !imageUrl ||
      oldPrice === undefined ||
      newPrice === undefined
    ) {
      logger.warn("Missing required fields in create course", {
        traceId,
        title,
        description,
        category,
        imageUrl,
        oldPrice,
        newPrice,
      });
      return res.status(400).json({
        success: false,
        code: "INVALID_INPUT",
        message:
          "Title, description, category, imageUrl, oldPrice, and newPrice are required",
        traceId,
      });
    }

    if (title.length > 200) {
      logger.warn("Title too long", { traceId, titleLength: title.length });
      return res.status(400).json({
        success: false,
        code: "INVALID_INPUT",
        message: "Title must be 200 characters or less",
        traceId,
      });
    }

    if (description.length < 10 || description.length > 2000) {
      logger.warn("Invalid description length", {
        traceId,
        descriptionLength: description.length,
      });
      return res.status(400).json({
        success: false,
        code: "INVALID_INPUT",
        message: "Description must be between 10 and 2000 characters",
        traceId,
      });
    }

    if (
      !validator.isURL(imageUrl, {
        protocols: ["http", "https"],
        require_protocol: true,
        allow_underscores: true,
      })
    ) {
      logger.warn("Invalid image URL", { traceId, imageUrl });
      return res.status(400).json({
        success: false,
        code: "INVALID_URL",
        message: "Invalid image URL",
        traceId,
      });
    }

    if (isNaN(oldPrice) || oldPrice < 0 || isNaN(newPrice) || newPrice < 0) {
      logger.warn("Invalid price values", { traceId, oldPrice, newPrice });
      return res.status(400).json({
        success: false,
        code: "INVALID_PRICE",
        message: "Prices must be non-negative numbers",
        traceId,
      });
    }

    if (newPrice > oldPrice) {
      logger.warn("New price exceeds old price", {
        traceId,
        newPrice,
        oldPrice,
      });
      return res.status(400).json({
        success: false,
        code: "INVALID_PRICE",
        message: "New price cannot be greater than old price",
        traceId,
      });
    }

    if (rating < 0 || rating > 5) {
      logger.warn("Invalid rating value", { traceId, rating });
      return res.status(400).json({
        success: false,
        code: "INVALID_RATING",
        message: "Rating must be between 0 and 5",
        traceId,
      });
    }

    if (isNaN(ratingCount) || ratingCount < 0) {
      logger.warn("Invalid rating count", { traceId, ratingCount });
      return res.status(400).json({
        success: false,
        code: "INVALID_RATING_COUNT",
        message: "Rating count must be a non-negative number",
        traceId,
      });
    }

    if (syllabus.length > 0 && !validateSyllabus(syllabus)) {
      logger.warn("Invalid syllabus format", { traceId });
      return res.status(400).json({
        success: false,
        code: "INVALID_SYLLABUS",
        message: "Syllabus must be an array of valid sections",
        traceId,
      });
    }

    const newCourse = new Course({
      title,
      description,
      category,
      imageUrl,
      oldPrice,
      newPrice,
      rating,
      ratingCount,
      tags,
      syllabus,
    });

    await newCourse.save();

    logger.info(`Course created: ${newCourse._id}`, {
      traceId,
      userId: req.user.userId,
    });
    return res.status(201).json({
      success: true,
      message: "Course created successfully",
      data: newCourse,
      traceId,
    });
  } catch (error) {
    logger.error(`Create course error: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      code:
        error.name === "ValidationError" ? "INVALID_INPUT" : "DATABASE_ERROR",
      message:
        error.name === "ValidationError"
          ? "Invalid course data"
          : "Failed to create course",
      traceId,
    });
  }
};

// Get a course by ID
export const getCourse = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  setSecurityHeaders(res);

  try {
    if (!(await ensureAdmin(req, res, traceId))) return;

    const { courseId } = req.params;

    if (!isValidObjectId(courseId)) {
      logger.warn(`Invalid course ID: ${courseId}`, { traceId });
      return res.status(400).json({
        success: false,
        code: "INVALID_ID",
        message: "Invalid course ID format",
        traceId,
      });
    }

    const course = await Course.findById(courseId)
      .select(
        "title description category imageUrl oldPrice newPrice rating ratingCount tags syllabus updatedAt"
      )
      .lean();

    if (!course) {
      logger.warn(`Course not found: ${courseId}`, { traceId });
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Course not found",
        traceId,
      });
    }

    logger.info(`Course retrieved: ${courseId}`, {
      traceId,
      userId: req.user.userId,
    });
    return res.status(200).json({
      success: true,
      message: "Course retrieved successfully",
      data: course,
      traceId,
    });
  } catch (error) {
    logger.error(`Get course error: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      code: error.name === "CastError" ? "INVALID_ID" : "DATABASE_ERROR",
      message:
        error.name === "CastError"
          ? "Invalid course ID format"
          : "Failed to fetch course",
      traceId,
    });
  }
};

// Update an existing course
export const updateCourse = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  setSecurityHeaders(res);

  try {
    if (!(await ensureAdmin(req, res, traceId))) return;

    const { courseId } = req.params;
    const normalizedBody = normalizeFormData(req.body);

    if (!isValidObjectId(courseId)) {
      logger.warn(`Invalid course ID: ${courseId}`, { traceId });
      return res.status(400).json({
        success: false,
        code: "INVALID_ID",
        message: "Invalid course ID format",
        traceId,
      });
    }

    const updates = {};
    for (const [key, value] of Object.entries(normalizedBody)) {
      if (value !== undefined && value !== null) {
        updates[key] = value;
      }
    }

    if (Object.keys(updates).length === 0) {
      logger.warn("No valid fields provided for update", { traceId });
      return res.status(400).json({
        success: false,
        code: "INVALID_INPUT",
        message: "No valid fields provided for update",
        traceId,
      });
    }

    if (updates.title && updates.title.length > 200) {
      logger.warn("Title too long", {
        traceId,
        titleLength: updates.title.length,
      });
      return res.status(400).json({
        success: false,
        code: "INVALID_INPUT",
        message: "Title must be 200 characters or less",
        traceId,
      });
    }

    if (
      updates.description &&
      (updates.description.length < 10 || updates.description.length > 2000)
    ) {
      logger.warn("Invalid description length", {
        traceId,
        descriptionLength: updates.description.length,
      });
      return res.status(400).json({
        success: false,
        code: "INVALID_INPUT",
        message: "Description must be between 10 and 2000 characters",
        traceId,
      });
    }

    if (
      updates.imageUrl &&
      !validator.isURL(updates.imageUrl, {
        protocols: ["http", "https"],
        require_protocol: true,
        allow_underscores: true,
      })
    ) {
      logger.warn("Invalid image URL", { traceId, imageUrl: updates.imageUrl });
      return res.status(400).json({
        success: false,
        code: "INVALID_URL",
        message: "Invalid image URL",
        traceId,
      });
    }

    if (updates.oldPrice && (isNaN(updates.oldPrice) || updates.oldPrice < 0)) {
      logger.warn("Invalid oldPrice", { traceId, oldPrice: updates.oldPrice });
      return res.status(400).json({
        success: false,
        code: "INVALID_PRICE",
        message: "Old price must be a non-negative number",
        traceId,
      });
    }

    if (updates.newPrice && (isNaN(updates.newPrice) || updates.newPrice < 0)) {
      logger.warn("Invalid newPrice", { traceId, newPrice: updates.newPrice });
      return res.status(400).json({
        success: false,
        code: "INVALID_PRICE",
        message: "New price must be a non-negative number",
        traceId,
      });
    }

    if (
      updates.newPrice &&
      updates.oldPrice &&
      updates.newPrice > updates.oldPrice
    ) {
      logger.warn("New price exceeds old price", {
        traceId,
        newPrice: updates.newPrice,
        oldPrice: updates.oldPrice,
      });
      return res.status(400).json({
        success: false,
        code: "INVALID_PRICE",
        message: "New price cannot be greater than old price",
        traceId,
      });
    }

    if (updates.rating && (updates.rating < 0 || updates.rating > 5)) {
      logger.warn("Invalid rating", { traceId, rating: updates.rating });
      return res.status(400).json({
        success: false,
        code: "INVALID_RATING",
        message: "Rating must be between 0 and 5",
        traceId,
      });
    }

    if (
      updates.ratingCount &&
      (isNaN(updates.ratingCount) || updates.ratingCount < 0)
    ) {
      logger.warn("Invalid rating count", {
        traceId,
        ratingCount: updates.ratingCount,
      });
      return res.status(400).json({
        success: false,
        code: "INVALID_RATING_COUNT",
        message: "Rating count must be a non-negative number",
        traceId,
      });
    }

    if (updates.syllabus && !validateSyllabus(updates.syllabus)) {
      logger.warn("Invalid syllabus format", { traceId });
      return res.status(400).json({
        success: false,
        code: "INVALID_SYLLABUS",
        message: "Syllabus must be an array of valid sections",
        traceId,
      });
    }

    const course = await Course.findByIdAndUpdate(
      courseId,
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    if (!course) {
      logger.warn(`Course not found: ${courseId}`, { traceId });
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Course not found",
        traceId,
      });
    }

    logger.info(`Course updated: ${courseId}`, {
      traceId,
      userId: req.user.userId,
    });
    return res.status(200).json({
      success: true,
      message: "Course updated successfully",
      data: course,
      traceId,
    });
  } catch (error) {
    logger.error(`Update course error: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      code:
        error.name === "CastError"
          ? "INVALID_ID"
          : error.name === "ValidationError"
            ? "INVALID_INPUT"
            : "DATABASE_ERROR",
      message:
        error.name === "CastError"
          ? "Invalid course ID format"
          : error.name === "ValidationError"
            ? "Invalid course data"
            : "Failed to update course",
      traceId,
    });
  }
};

// Delete a course
export const deleteCourse = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  setSecurityHeaders(res);

  try {
    if (!(await ensureAdmin(req, res, traceId))) return;

    const { courseId } = req.params;

    if (!isValidObjectId(courseId)) {
      logger.warn(`Invalid course ID: ${courseId}`, { traceId });
      return res.status(400).json({
        success: false,
        code: "INVALID_ID",
        message: "Invalid course ID format",
        traceId,
      });
    }

    const course = await Course.findByIdAndDelete(courseId).lean();
    if (!course) {
      logger.warn(`Course not found: ${courseId}`, { traceId });
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Course not found",
        traceId,
      });
    }

    logger.info(`Course deleted: ${courseId}`, {
      traceId,
      userId: req.user.userId,
    });
    return res.status(200).json({
      success: true,
      message: "Course deleted successfully",
      traceId,
    });
  } catch (error) {
    logger.error(`Delete course error: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      code: error.name === "CastError" ? "INVALID_ID" : "DATABASE_ERROR",
      message:
        error.name === "CastError"
          ? "Invalid course ID format"
          : "Failed to delete course",
      traceId,
    });
  }
};

// Search courses by name or category
export const searchCourses = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  setSecurityHeaders(res);

  try {
    if (!(await ensureAdmin(req, res, traceId))) return;

    const { query, page = 1, limit = 10 } = req.query;
    const pageNumber = parseInt(page, 10);
    const limitNumber = Math.min(parseInt(limit, 10), 100);

    if (!query?.trim()) {
      logger.warn("Search courses failed: Query is required", { traceId });
      return res.status(400).json({
        success: false,
        code: "INVALID_INPUT",
        message: "Search query is required",
        traceId,
      });
    }

    if (
      isNaN(pageNumber) ||
      pageNumber < 1 ||
      isNaN(limitNumber) ||
      limitNumber < 1
    ) {
      logger.warn("Invalid pagination parameters", { traceId, page, limit });
      return res.status(400).json({
        success: false,
        code: "INVALID_PAGINATION",
        message: "Invalid pagination parameters",
        traceId,
      });
    }

    const sanitizedQuery = sanitizeInput(query.trim(), 100);
    console.log("Sanitized Query:", sanitizedQuery); // Debug

    const searchCriteria = {
      $or: [
        { title: { $regex: sanitizedQuery, $options: "i" } },
        { category: { $regex: sanitizedQuery, $options: "i" } },
      ],
    };
    console.log("Search Criteria:", JSON.stringify(searchCriteria)); // Debug

    const [courses, totalCourses] = await Promise.all([
      Course.find(searchCriteria)
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber)
        .select(
          "title description category imageUrl oldPrice newPrice rating ratingCount tags syllabus updatedAt"
        )
        .lean(),
      Course.countDocuments(searchCriteria),
    ]);

    logger.info(
      `Searched ${courses.length} courses for query: ${sanitizedQuery}`,
      { traceId, userId: req.user.userId }
    );
    return res.status(200).json({
      success: true,
      message: courses.length
        ? "Courses retrieved successfully"
        : "No courses found with this query",
      data: courses,
      pagination: {
        total: totalCourses,
        pages: Math.ceil(totalCourses / limitNumber),
        page: pageNumber,
        limit: limitNumber,
      },
      traceId,
    });
  } catch (error) {
    logger.error(`Search courses error: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      code: "DATABASE_ERROR",
      message: "Failed to search courses",
      traceId,
    });
  }
};

// ======================
// Section Management
// ======================

// Create a new section in a course
export const createSection = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  setSecurityHeaders(res);

  try {
    if (!ensureAdmin(req, res, traceId)) return;

    const { courseId } = req.params;
    const { title, lessons = [] } = normalizeFormData(req.body);

    if (!isValidObjectId(courseId)) {
      logger.warn(`Invalid course ID: ${courseId}`, { traceId });
      return res.status(400).json({
        success: false,
        code: "INVALID_ID",
        message: "Invalid course ID format",
        traceId,
      });
    }

    if (!title?.trim() || title.trim().length > 100) {
      logger.warn("Invalid section title", {
        traceId,
        titleLength: title?.length,
      });
      return res.status(400).json({
        success: false,
        code: "INVALID_INPUT",
        message: "Section title is required and must be 100 characters or less",
        traceId,
      });
    }

    if (lessons.length > 0 && !validateSyllabus([{ title, lessons }])) {
      logger.warn("Invalid lessons format", { traceId });
      return res.status(400).json({
        success: false,
        code: "INVALID_SYLLABUS",
        message: "Lessons must be an array of valid lesson objects",
        traceId,
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      logger.warn(`Course not found: ${courseId}`, { traceId });
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Course not found",
        traceId,
      });
    }

    course.syllabus.push({ title, lessons });
    await course.save();

    logger.info(`Section created in course: ${courseId}`, {
      traceId,
      userId: req.user.userId,
    });
    return res.status(201).json({
      success: true,
      message: "Section created successfully",
      data: course.syllabus[course.syllabus.length - 1],
      traceId,
    });
  } catch (error) {
    logger.error(`Create section error: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      code:
        error.name === "ValidationError" ? "INVALID_INPUT" : "DATABASE_ERROR",
      message:
        error.name === "ValidationError"
          ? "Invalid section data"
          : "Failed to create section",
      traceId,
    });
  }
};

// Get a specific section of a course
export const getSection = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  setSecurityHeaders(res);

  try {
    if (!ensureAdmin(req, res, traceId)) return;

    const { courseId, sectionId } = req.params;

    if (!isValidObjectId(courseId) || !isValidObjectId(sectionId)) {
      logger.warn(`Invalid IDs: courseId=${courseId}, sectionId=${sectionId}`, {
        traceId,
      });
      return res.status(400).json({
        success: false,
        code: "INVALID_ID",
        message: "Invalid course or section ID format",
        traceId,
      });
    }

    const course = await Course.findById(courseId).lean();
    if (!course) {
      logger.warn(`Course not found: ${courseId}`, { traceId });
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Course not found",
        traceId,
      });
    }

    const section = course.syllabus.find((s) => s._id.toString() === sectionId);
    if (!section) {
      logger.warn(`Section not found: ${sectionId}`, { traceId });
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Section not found",
        traceId,
      });
    }

    logger.info(`Section retrieved: ${sectionId}`, {
      traceId,
      userId: req.user.userId,
    });
    return res.status(200).json({
      success: true,
      message: "Section retrieved successfully",
      data: section,
      traceId,
    });
  } catch (error) {
    logger.error(`Get section error: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      code: error.name === "CastError" ? "INVALID_ID" : "DATABASE_ERROR",
      message:
        error.name === "CastError"
          ? "Invalid course or section ID format"
          : "Failed to fetch section",
      traceId,
    });
  }
};

// Update a specific section within a course
export const updateSection = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  setSecurityHeaders(res);

  try {
    if (!ensureAdmin(req, res, traceId)) return;

    const { courseId, sectionId } = req.params;
    const { title, lessons } = normalizeFormData(req.body);

    if (!isValidObjectId(courseId) || !isValidObjectId(sectionId)) {
      logger.warn(`Invalid IDs: courseId=${courseId}, sectionId=${sectionId}`, {
        traceId,
      });
      return res.status(400).json({
        success: false,
        code: "INVALID_ID",
        message: "Invalid course or section ID format",
        traceId,
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      logger.warn(`Course not found: ${courseId}`, { traceId });
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Course not found",
        traceId,
      });
    }

    const section = course.syllabus.id(sectionId);
    if (!section) {
      logger.warn(`Section not found: ${sectionId}`, { traceId });
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Section not found",
        traceId,
      });
    }

    // Validate input only if provided
    if (title && (!title.trim() || title.trim().length > 100)) {
      logger.warn("Invalid section title", {
        traceId,
        titleLength: title?.length,
      });
      return res.status(400).json({
        success: false,
        code: "INVALID_INPUT",
        message: "Section title must be 100 characters or less",
        traceId,
      });
    }

    if (
      lessons &&
      lessons.length > 0 &&
      !validateSyllabus([{ title: section.title, lessons }])
    ) {
      logger.warn("Invalid lessons format", { traceId });
      return res.status(400).json({
        success: false,
        code: "INVALID_SYLLABUS",
        message: "Lessons must be an array of valid lesson objects",
        traceId,
      });
    }

    // Update only provided fields
    if (title) section.title = title;
    if (lessons !== undefined) section.lessons = lessons;

    await course.save();

    logger.info(`Section updated: ${sectionId}`, {
      traceId,
      userId: req.user.userId,
    });
    return res.status(200).json({
      success: true,
      message: "Section updated successfully",
      data: section,
      traceId,
    });
  } catch (error) {
    logger.error(`Update section error: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      code:
        error.name === "ValidationError" ? "INVALID_INPUT" : "DATABASE_ERROR",
      message:
        error.name === "ValidationError"
          ? "Invalid section data"
          : "Failed to update section",
      traceId,
    });
  }
};

// Delete a specific section of a course
export const deleteSection = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  setSecurityHeaders(res);

  try {
    if (!ensureAdmin(req, res, traceId)) return;

    const { courseId, sectionId } = req.params;

    if (!isValidObjectId(courseId) || !isValidObjectId(sectionId)) {
      logger.warn(`Invalid IDs: courseId=${courseId}, sectionId=${sectionId}`, {
        traceId,
      });
      return res.status(400).json({
        success: false,
        code: "INVALID_ID",
        message: "Invalid course or section ID format",
        traceId,
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      logger.warn(`Course not found: ${courseId}`, { traceId });
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Course not found",
        traceId,
      });
    }

    const section = course.syllabus.id(sectionId);
    if (!section) {
      logger.warn(`Section not found: ${sectionId}`, { traceId });
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Section not found",
        traceId,
      });
    }

    course.syllabus.pull(sectionId);
    await course.save();

    logger.info(`Section deleted: ${sectionId}`, {
      traceId,
      userId: req.user.userId,
    });
    return res.status(200).json({
      success: true,
      message: "Section deleted successfully",
      traceId,
    });
  } catch (error) {
    logger.error(`Delete section error: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      code: error.name === "CastError" ? "INVALID_ID" : "DATABASE_ERROR",
      message:
        error.name === "CastError"
          ? "Invalid course or section ID format"
          : "Failed to delete section",
      traceId,
    });
  }
};

// ======================
// Lesson Management
// ======================

// Create a new lesson in a section
export const createLesson = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  setSecurityHeaders(res);

  try {
    if (!ensureAdmin(req, res, traceId)) return;

    const { courseId, sectionId } = req.params;
    const {
      title,
      content,
      isLocked = false,
      type = "lesson",
      quiz = [],
    } = normalizeFormData(req.body);

    if (!isValidObjectId(courseId) || !isValidObjectId(sectionId)) {
      logger.warn(`Invalid IDs: courseId=${courseId}, sectionId=${sectionId}`, {
        traceId,
      });
      return res.status(400).json({
        success: false,
        code: "INVALID_ID",
        message: "Invalid course or section ID format",
        traceId,
      });
    }

    if (
      !title?.trim() ||
      title.trim().length > 100 ||
      !content?.trim() ||
      content.trim().length > 10000
    ) {
      logger.warn("Invalid lesson title or content", {
        traceId,
        titleLength: title?.length,
        contentLength: content?.length,
      });
      return res.status(400).json({
        success: false,
        code: "INVALID_INPUT",
        message:
          "Lesson title (max 100 chars) and content (max 10000 chars) are required",
        traceId,
      });
    }

    if (!["lesson", "assessment"].includes(type)) {
      logger.warn("Invalid lesson type", { traceId, type });
      return res.status(400).json({
        success: false,
        code: "INVALID_INPUT",
        message: "Lesson type must be 'lesson' or 'assessment'",
        traceId,
      });
    }

    if (quiz.length > 0 && !validateQuiz(quiz)) {
      logger.warn("Invalid quiz format", { traceId });
      return res.status(400).json({
        success: false,
        code: "INVALID_QUIZ",
        message: "Quiz must be an array of valid questions",
        traceId,
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      logger.warn(`Course not found: ${courseId}`, { traceId });
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Course not found",
        traceId,
      });
    }

    const section = course.syllabus.id(sectionId);
    if (!section) {
      logger.warn(`Section not found: ${sectionId}`, { traceId });
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Section not found",
        traceId,
      });
    }

    section.lessons.push({
      title,
      content,
      isLocked,
      type,
      quiz,
    });
    await course.save();

    logger.info(`Lesson created in section: ${sectionId}`, {
      traceId,
      userId: req.user.userId,
    });
    return res.status(201).json({
      success: true,
      message: "Lesson created successfully",
      data: section.lessons[section.lessons.length - 1],
      traceId,
    });
  } catch (error) {
    logger.error(`Create lesson error: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      code:
        error.name === "ValidationError" ? "INVALID_INPUT" : "DATABASE_ERROR",
      message:
        error.name === "ValidationError"
          ? "Invalid lesson data"
          : "Failed to create lesson",
      traceId,
    });
  }
};

// Get a specific lesson of a section
export const getLesson = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  setSecurityHeaders(res);

  try {
    if (!ensureAdmin(req, res, traceId)) return;

    const { courseId, sectionId, lessonId } = req.params;

    if (
      !isValidObjectId(courseId) ||
      !isValidObjectId(sectionId) ||
      !isValidObjectId(lessonId)
    ) {
      logger.warn(
        `Invalid IDs: courseId=${courseId}, sectionId=${sectionId}, lessonId=${lessonId}`,
        { traceId }
      );
      return res.status(400).json({
        success: false,
        code: "INVALID_ID",
        message: "Invalid course, section, or lesson ID format",
        traceId,
      });
    }

    const course = await Course.findById(courseId).lean();
    if (!course) {
      logger.warn(`Course not found: ${courseId}`, { traceId });
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Course not found",
        traceId,
      });
    }

    const section = course.syllabus.find((s) => s._id.toString() === sectionId);
    if (!section) {
      logger.warn(`Section not found: ${sectionId}`, { traceId });
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Section not found",
        traceId,
      });
    }

    const lesson = section.lessons.find((l) => l._id.toString() === lessonId);
    if (!lesson) {
      logger.warn(`Lesson not found: ${lessonId}`, { traceId });
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Lesson not found",
        traceId,
      });
    }

    logger.info(`Lesson retrieved: ${lessonId}`, {
      traceId,
      userId: req.user.userId,
    });
    return res.status(200).json({
      success: true,
      message: "Lesson retrieved successfully",
      data: lesson,
      traceId,
    });
  } catch (error) {
    logger.error(`Get lesson error: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      code: error.name === "CastError" ? "INVALID_ID" : "DATABASE_ERROR",
      message:
        error.name === "CastError"
          ? "Invalid course, section, or lesson ID format"
          : "Failed to fetch lesson",
      traceId,
    });
  }
};

// Update a specific lesson within a section
export const updateLesson = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  setSecurityHeaders(res);

  try {
    if (!ensureAdmin(req, res, traceId)) return;

    const { courseId, sectionId, lessonId } = req.params;
    const { title, content, isLocked, type, quiz } = normalizeFormData(
      req.body
    );

    if (
      !isValidObjectId(courseId) ||
      !isValidObjectId(sectionId) ||
      !isValidObjectId(lessonId)
    ) {
      logger.warn(
        `Invalid IDs: courseId=${courseId}, sectionId=${sectionId}, lessonId=${lessonId}`,
        { traceId }
      );
      return res.status(400).json({
        success: false,
        code: "INVALID_ID",
        message: "Invalid course, section, or lesson ID format",
        traceId,
      });
    }

    if (title && (!title.trim() || title.trim().length > 100)) {
      logger.warn("Invalid lesson title", {
        traceId,
        titleLength: title?.length,
      });
      return res.status(400).json({
        success: false,
        code: "INVALID_INPUT",
        message: "Lesson title must be 100 characters or less",
        traceId,
      });
    }

    if (content && (!content.trim() || content.trim().length > 10000)) {
      logger.warn("Invalid lesson content", {
        traceId,
        contentLength: content?.length,
      });
      return res.status(400).json({
        success: false,
        code: "INVALID_INPUT",
        message: "Lesson content must be 10000 characters or less",
        traceId,
      });
    }

    if (type && !["lesson", "assessment"].includes(type)) {
      logger.warn("Invalid lesson type", { traceId, type });
      return res.status(400).json({
        success: false,
        code: "INVALID_INPUT",
        message: "Lesson type must be 'lesson' or 'assessment'",
        traceId,
      });
    }

    if (quiz && quiz.length > 0 && !validateQuiz(quiz)) {
      logger.warn("Invalid quiz format", { traceId });
      return res.status(400).json({
        success: false,
        code: "INVALID_QUIZ",
        message: "Quiz must be an array of valid questions",
        traceId,
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      logger.warn(`Course not found: ${courseId}`, { traceId });
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Course not found",
        traceId,
      });
    }

    const section = course.syllabus.id(sectionId);
    if (!section) {
      logger.warn(`Section not found: ${sectionId}`, { traceId });
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Section not found",
        traceId,
      });
    }

    const lesson = section.lessons.id(lessonId);
    if (!lesson) {
      logger.warn(`Lesson not found: ${lessonId}`, { traceId });
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Lesson not found",
        traceId,
      });
    }

    if (title) lesson.title = title;
    if (content) lesson.content = content;
    if (isLocked !== undefined) lesson.isLocked = isLocked;
    if (type) lesson.type = type;
    if (quiz !== undefined) lesson.quiz = quiz;

    await course.save();

    logger.info(`Lesson updated: ${lessonId}`, {
      traceId,
      userId: req.user.userId,
    });
    return res.status(200).json({
      success: true,
      message: "Lesson updated successfully",
      data: lesson,
      traceId,
    });
  } catch (error) {
    logger.error(`Update lesson error: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      code:
        error.name === "ValidationError" ? "INVALID_INPUT" : "DATABASE_ERROR",
      message:
        error.name === "ValidationError"
          ? "Invalid lesson data"
          : "Failed to update lesson",
      traceId,
    });
  }
};

// Delete a specific lesson of a section
export const deleteLesson = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  setSecurityHeaders(res);

  try {
    if (!ensureAdmin(req, res, traceId)) return;

    const { courseId, sectionId, lessonId } = req.params;

    if (
      !isValidObjectId(courseId) ||
      !isValidObjectId(sectionId) ||
      !isValidObjectId(lessonId)
    ) {
      logger.warn(
        `Invalid IDs: courseId=${courseId}, sectionId=${sectionId}, lessonId=${lessonId}`,
        { traceId }
      );
      return res.status(400).json({
        success: false,
        code: "INVALID_ID",
        message: "Invalid course, section, or lesson ID format",
        traceId,
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      logger.warn(`Course not found: ${courseId}`, { traceId });
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Course not found",
        traceId,
      });
    }

    const section = course.syllabus.id(sectionId);
    if (!section) {
      logger.warn(`Section not found: ${sectionId}`, { traceId });
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Section not found",
        traceId,
      });
    }

    const lesson = section.lessons.id(lessonId);
    if (!lesson) {
      logger.warn(`Lesson not found: ${lessonId}`, { traceId });
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Lesson not found",
        traceId,
      });
    }

    section.lessons.pull(lessonId);
    await course.save();

    logger.info(`Lesson deleted: ${lessonId}`, {
      traceId,
      userId: req.user.userId,
    });
    return res.status(200).json({
      success: true,
      message: "Lesson deleted successfully",
      traceId,
    });
  } catch (error) {
    logger.error(`Delete lesson error: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      code: error.name === "CastError" ? "INVALID_ID" : "DATABASE_ERROR",
      message:
        error.name === "CastError"
          ? "Invalid course, section, or lesson ID format"
          : "Failed to delete lesson",
      traceId,
    });
  }
};

// ======================
// Quiz Management
// ======================

// Create a quiz for a lesson
export const createQuiz = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  setSecurityHeaders(res);

  try {
    if (!(await ensureAdmin(req, res, traceId))) return;

    const { courseId, sectionId, lessonId } = req.params;
    const { quiz } = normalizeFormData(req.body);

    if (
      !isValidObjectId(courseId) ||
      !isValidObjectId(sectionId) ||
      !isValidObjectId(lessonId)
    ) {
      logger.warn(
        `Invalid IDs: courseId=${courseId}, sectionId=${sectionId}, lessonId=${lessonId}`,
        { traceId }
      );
      return res.status(400).json({
        success: false,
        code: "INVALID_ID",
        message: "Invalid course, section, or lesson ID format",
        traceId,
      });
    }

    if (!quiz || !validateQuiz(quiz)) {
      logger.warn("Invalid quiz format", { traceId });
      return res.status(400).json({
        success: false,
        code: "INVALID_QUIZ",
        message:
          "Quiz must be an array of valid questions with exactly 4 options each",
        traceId,
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      logger.warn(`Course not found: ${courseId}`, { traceId });
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Course not found",
        traceId,
      });
    }

    const section = course.syllabus.id(sectionId);
    if (!section) {
      logger.warn(`Section not found: ${sectionId}`, { traceId });
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Section not found",
        traceId,
      });
    }

    const lesson = section.lessons.id(lessonId);
    if (!lesson) {
      logger.warn(`Lesson not found: ${lessonId}`, { traceId });
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Lesson not found",
        traceId,
      });
    }

    if (lesson.type !== "assessment") {
      logger.warn(`Lesson is not an assessment: ${lessonId}`, { traceId });
      return res.status(400).json({
        success: false,
        code: "INVALID_INPUT",
        message: "Quizzes can only be added to assessment lessons",
        traceId,
      });
    }

    lesson.quiz = quiz;
    await course.save();

    logger.info(`Quiz created for lesson: ${lessonId}`, {
      traceId,
      userId: req.user.userId,
    });
    return res.status(201).json({
      success: true,
      message: "Quiz created successfully",
      data: lesson.quiz,
      traceId,
    });
  } catch (error) {
    logger.error(`Create quiz error: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      code:
        error.name === "ValidationError" ? "INVALID_INPUT" : "DATABASE_ERROR",
      message:
        error.name === "ValidationError"
          ? "Invalid quiz data"
          : "Failed to create quiz",
      traceId,
    });
  }
};

// Get a quiz for a lesson
export const getQuiz = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  setSecurityHeaders(res);

  try {
    if (!(await ensureAdmin(req, res, traceId))) return;

    const { courseId, sectionId, lessonId } = req.params;

    if (
      !isValidObjectId(courseId) ||
      !isValidObjectId(sectionId) ||
      !isValidObjectId(lessonId)
    ) {
      logger.warn(
        `Invalid IDs: courseId=${courseId}, sectionId=${sectionId}, lessonId=${lessonId}`,
        { traceId }
      );
      return res.status(400).json({
        success: false,
        code: "INVALID_ID",
        message: "Invalid course, section, or lesson ID format",
        traceId,
      });
    }

    const course = await Course.findById(courseId).lean();
    if (!course) {
      logger.warn(`Course not found: ${courseId}`, { traceId });
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Course not found",
        traceId,
      });
    }

    const section = course.syllabus.find((s) => s._id.toString() === sectionId);
    if (!section) {
      logger.warn(`Section not found: ${sectionId}`, { traceId });
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Section not found",
        traceId,
      });
    }

    const lesson = section.lessons.find((l) => l._id.toString() === lessonId);
    if (!lesson) {
      logger.warn(`Lesson not found: ${lessonId}`, { traceId });
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Lesson not found",
        traceId,
      });
    }

    logger.info(`Quiz retrieved for lesson: ${lessonId}`, {
      traceId,
      userId: req.user.userId,
    });
    return res.status(200).json({
      success: true,
      message: "Quiz retrieved successfully",
      data: lesson.quiz || [],
      traceId,
    });
  } catch (error) {
    logger.error(`Get quiz error: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      code: error.name === "CastError" ? "INVALID_ID" : "DATABASE_ERROR",
      message:
        error.name === "CastError"
          ? "Invalid course, section, or lesson ID format"
          : "Failed to fetch quiz",
      traceId,
    });
  }
};

// Update a specific quiz question
export const updateQuiz = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  setSecurityHeaders(res);

  try {
    if (!(await ensureAdmin(req, res, traceId))) return;

    const { courseId, sectionId, lessonId, quizId } = req.params;
    const { question, options, correctAnswer } = normalizeFormData(req.body);

    if (
      !isValidObjectId(courseId) ||
      !isValidObjectId(sectionId) ||
      !isValidObjectId(lessonId) ||
      !isValidObjectId(quizId)
    ) {
      logger.warn(
        `Invalid IDs: courseId=${courseId}, sectionId=${sectionId}, lessonId=${lessonId}, quizId=${quizId}`,
        { traceId }
      );
      return res.status(400).json({
        success: false,
        code: "INVALID_ID",
        message: "Invalid course, section, lesson, or quiz ID format",
        traceId,
      });
    }

    if (
      !question?.trim() ||
      question.trim().length > 500 ||
      !Array.isArray(options) ||
      options.length !== 4 ||
      !options.every(
        (opt) =>
          typeof opt === "string" &&
          opt.trim().length > 0 &&
          opt.trim().length <= 200
      ) ||
      !correctAnswer?.trim() ||
      !options.includes(correctAnswer)
    ) {
      logger.warn("Invalid quiz question format", { traceId });
      return res.status(400).json({
        success: false,
        code: "INVALID_QUIZ",
        message:
          "Question (max 500 chars), exactly 4 options (max 200 chars each), and valid correct answer are required",
        traceId,
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      logger.warn(`Course not found: ${courseId}`, { traceId });
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Course not found",
        traceId,
      });
    }

    const section = course.syllabus.id(sectionId);
    if (!section) {
      logger.warn(`Section not found: ${sectionId}`, { traceId });
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Section not found",
        traceId,
      });
    }

    const lesson = section.lessons.id(lessonId);
    if (!lesson) {
      logger.warn(`Lesson not found: ${lessonId}`, { traceId });
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Lesson not found",
        traceId,
      });
    }

    const quizQuestion = lesson.quiz.id(quizId);
    if (!quizQuestion) {
      logger.warn(`Quiz question not found: ${quizId}`, { traceId });
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Quiz question not found",
        traceId,
      });
    }

    quizQuestion.question = question;
    quizQuestion.options = options;
    quizQuestion.correctAnswer = correctAnswer;

    await course.save();

    logger.info(`Quiz question updated: ${quizId}`, {
      traceId,
      userId: req.user.userId,
    });
    return res.status(200).json({
      success: true,
      message: "Quiz question updated successfully",
      data: quizQuestion,
      traceId,
    });
  } catch (error) {
    logger.error(`Update quiz question error: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      code:
        error.name === "ValidationError" ? "INVALID_INPUT" : "DATABASE_ERROR",
      message:
        error.name === "ValidationError"
          ? "Invalid quiz question data"
          : "Failed to update quiz question",
      traceId,
    });
  }
};

// Delete a specific quiz question
export const deleteQuiz = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || randomUUID();
  setSecurityHeaders(res);

  try {
    if (!(await ensureAdmin(req, res, traceId))) return;

    const { courseId, sectionId, lessonId, quizId } = req.params;

    if (
      !isValidObjectId(courseId) ||
      !isValidObjectId(sectionId) ||
      !isValidObjectId(lessonId) ||
      !isValidObjectId(quizId)
    ) {
      logger.warn(
        `Invalid IDs: courseId=${courseId}, sectionId=${sectionId}, lessonId=${lessonId}, quizId=${quizId}`,
        { traceId }
      );
      return res.status(400).json({
        success: false,
        code: "INVALID_ID",
        message: "Invalid course, section, lesson, or quiz ID format",
        traceId,
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      logger.warn(`Course not found: ${courseId}`, { traceId });
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Course not found",
        traceId,
      });
    }

    const section = course.syllabus.id(sectionId);
    if (!section) {
      logger.warn(`Section not found: ${sectionId}`, { traceId });
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Section not found",
        traceId,
      });
    }

    const lesson = section.lessons.id(lessonId);
    if (!lesson) {
      logger.warn(`Lesson not found: ${lessonId}`, { traceId });
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Lesson not found",
        traceId,
      });
    }

    const quizQuestion = lesson.quiz.id(quizId);
    if (!quizQuestion) {
      logger.warn(`Quiz question not found: ${quizId}`, { traceId });
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Quiz question not found",
        traceId,
      });
    }

    lesson.quiz.pull(quizId);
    await course.save();

    logger.info(`Quiz question deleted: ${quizId}`, {
      traceId,
      userId: req.user.userId,
    });
    return res.status(200).json({
      success: true,
      message: "Quiz question deleted successfully",
      traceId,
    });
  } catch (error) {
    logger.error(`Delete quiz question error: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      code:
        error.name === "ValidationError" ? "INVALID_INPUT" : "DATABASE_ERROR",
      message:
        error.name === "ValidationError"
          ? "Invalid quiz question data"
          : "Failed to delete quiz question",
      traceId,
    });
  }
};
