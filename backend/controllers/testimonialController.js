import { randomUUID } from 'crypto';
import Testimonial from '../models/Testimonial.js';
import { logger } from '../utils/logger.js';

// Add a new testimonial
export const addTestimonial = async (req, res) => {
  const traceId = req.headers['x-trace-id'] || randomUUID();

  try {
    const { userName, courseName, platform, userRole, content, userImage } = req.body;

    // Validate required fields
    if (!userName || !courseName || !platform || !userRole || !content) {
      logger.warn('Missing required fields for adding testimonial', { traceId });
      return res.status(400).json({
        success: false,
        code: 'INVALID_INPUT',
        message: 'All fields (userName, courseName, platform, userRole, content) are required',
        traceId,
      });
    }

    // Create a new testimonial
    const newTestimonial = new Testimonial({
      userName,
      courseName,
      platform,
      userRole,
      content,
      userImage,
    });

    // Save the testimonial to the database
    await newTestimonial.save();

    logger.info(`Testimonial added successfully: ${newTestimonial._id}`, {
      traceId,
      userId: req.user?.userId,
      userName,
      userRole,
      courseName,
    });

    // Send success response
    return res.status(201).json({
      success: true,
      message: 'Testimonial added successfully',
      data: newTestimonial,
      traceId,
    });
  } catch (error) {
    logger.error(`Error adding testimonial: ${error.message}`, { traceId, stack: error.stack });
    return res.status(500).json({
      success: false,
      code: 'DATABASE_ERROR',
      message: 'Failed to add testimonial',
      traceId,
    });
  }
};

// Update a testimonial by ID (supports partial updates)
export const updateTestimonial = async (req, res) => {
  const traceId = req.headers['x-trace-id'] || randomUUID();

  try {
    const { id } = req.params;
    const { userName, courseName, platform, userRole, content, userImage } = req.body;

    // Check if at least one field is provided for update
    if (!userName && !courseName && !platform && !userRole && !content && userImage === undefined) {
      logger.warn('No fields provided for testimonial update', { traceId, id });
      return res.status(400).json({
        success: false,
        code: 'INVALID_INPUT',
        message: 'At least one field is required for update',
        traceId,
      });
    }

    // Create an update object with only the provided fields
    const updateData = {};
    if (userName) updateData.userName = userName;
    if (courseName) updateData.courseName = courseName;
    if (platform) updateData.platform = platform;
    if (userRole) updateData.userRole = userRole;
    if (content) updateData.content = content;
    if (userImage !== undefined) updateData.userImage = userImage;

    // Find and update the testimonial
    const updatedTestimonial = await Testimonial.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    // Check if the testimonial exists
    if (!updatedTestimonial) {
      logger.warn(`Testimonial not found for update: ${id}`, { traceId });
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Testimonial not found',
        traceId,
      });
    }

    logger.info(`Testimonial updated successfully: ${id}`, {
      traceId,
      userId: req.user?.userId,
      userName: updatedTestimonial.userName,
      userRole: updatedTestimonial.userRole,
      courseName: updatedTestimonial.courseName,
    });

    // Send success response
    return res.status(200).json({
      success: true,
      message: 'Testimonial updated successfully',
      data: updatedTestimonial,
      traceId,
    });
  } catch (error) {
    logger.error(`Error updating testimonial: ${error.message}`, { traceId, stack: error.stack });
    return res.status(500).json({
      success: false,
      code: 'DATABASE_ERROR',
      message: 'Failed to update testimonial',
      traceId,
    });
  }
};

// Delete a testimonial by ID
export const deleteTestimonial = async (req, res) => {
  const traceId = req.headers['x-trace-id'] || randomUUID();

  try {
    const { id } = req.params;

    // Find and delete the testimonial
    const deletedTestimonial = await Testimonial.findByIdAndDelete(id);

    // Check if the testimonial exists
    if (!deletedTestimonial) {
      logger.warn(`Testimonial not found for deletion: ${id}`, { traceId });
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Testimonial not found',
        traceId,
      });
    }

    logger.info(`Testimonial deleted successfully: ${id}`, {
      traceId,
      userId: req.user?.userId,
      userName: deletedTestimonial.userName,
      userRole: deletedTestimonial.userRole,
      courseName: deletedTestimonial.courseName,
    });

    // Send success response
    return res.status(200).json({
      success: true,
      message: 'Testimonial deleted successfully',
      data: deletedTestimonial,
      traceId,
    });
  } catch (error) {
    logger.error(`Error deleting testimonial: ${error.message}`, { traceId, stack: error.stack });
    return res.status(500).json({
      success: false,
      code: 'DATABASE_ERROR',
      message: 'Failed to delete testimonial',
      traceId,
    });
  }
};

// Fetch all testimonials with optional filtering by courseName, platform, or userRole
export const getTestimonials = async (req, res) => {
  const traceId = req.headers['x-trace-id'] || randomUUID();

  try {
    const { courseName, platform, userRole } = req.query;
    const query = {};

    // Apply filters if provided
    if (courseName) query.courseName = new RegExp(courseName, 'i');
    if (platform) query.platform = platform;
    if (userRole) query.userRole = new RegExp(userRole, 'i');

    const testimonials = await Testimonial.find(query).select('userName courseName platform userRole content userImage createdAt');

    logger.info(`Testimonials retrieved successfully`, {
      traceId,
      count: testimonials.length,
      filters: { courseName, platform, userRole },
    });

    return res.status(200).json({
      success: true,
      message: 'Testimonials retrieved successfully',
      data: testimonials,
      traceId,
    });
  } catch (error) {
    logger.error(`Error fetching testimonials: ${error.message}`, { traceId, stack: error.stack });
    return res.status(500).json({
      success: false,
      code: 'DATABASE_ERROR',
      message: 'Failed to fetch testimonials',
      traceId,
    });
  }
};

// Get total testimonials for a specific year with monthly history
export const getTotalTestimonials = async (req, res) => {
  const traceId = req.headers['x-trace-id'] || randomUUID();

  try {
    const { year = new Date().getFullYear() } = req.query;
    const yearNumber = parseInt(year, 10);

    // Validate year input
    if (
      isNaN(yearNumber) ||
      yearNumber < 2000 ||
      yearNumber > new Date().getFullYear() + 1
    ) {
      logger.warn('Invalid year for total testimonials', { traceId, year });
      return res.status(400).json({
        success: false,
        code: 'INVALID_INPUT',
        message: 'Valid year (2000 or later) is required',
        traceId,
      });
    }

    // Define year boundaries in UTC
    const startOfYear = new Date(Date.UTC(yearNumber, 0, 1, 0, 0, 0, 0));
    const endOfYear = new Date(Date.UTC(yearNumber, 11, 31, 23, 59, 59, 999));

    // Fetch total testimonials and monthly history
    const [total, monthlyData] = await Promise.all([
      Testimonial.countDocuments({
        createdAt: { $gte: startOfYear, $lte: endOfYear },
      }),
      Testimonial.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfYear, $lte: endOfYear },
          },
        },
        {
          $group: {
            _id: { $month: '$createdAt' },
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
      history[month._id - 1] = month.count;
    });

    // Verify total matches sum of monthly counts
    const historySum = history.reduce((sum, count) => sum + count, 0);
    if (historySum !== total) {
      logger.warn('Total testimonials mismatch with monthly sum', {
        traceId,
        total,
        historySum,
      });
    }

    logger.info(`Total testimonials retrieved for ${yearNumber}`, {
      traceId,
      userId: req.user?.userId,
      total,
      history,
      startOfYear: startOfYear.toISOString(),
      endOfYear: endOfYear.toISOString(),
    });

    return res.status(200).json({
      success: true,
      message: 'Total testimonials retrieved successfully',
      data: { total, history },
      traceId,
    });
  } catch (error) {
    logger.error(`Get total testimonials error: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      code: 'DATABASE_ERROR',
      message: 'Failed to fetch total testimonials',
      traceId,
    });
  }
};

// Get recent testimonials for a specific year and month with weekly history
export const getRecentTestimonials = async (req, res) => {
  const traceId = req.headers['x-trace-id'] || randomUUID();

  try {
    const { year = new Date().getFullYear(), month = new Date().getMonth() + 1 } = req.query;
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
      logger.warn('Invalid year or month for recent testimonials', {
        traceId,
        year,
        month,
      });
      return res.status(400).json({
        success: false,
        code: 'INVALID_INPUT',
        message: 'Valid year (2000 or later) and month (1-12) are required',
        traceId,
      });
    }

    // Define month boundaries in UTC
    const startDate = new Date(Date.UTC(yearNumber, monthNumber - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(yearNumber, monthNumber, 0, 23, 59, 59, 999));
    const daysInMonth = endDate.getDate();

    // Fetch daily testimonial counts
    const testimonials = await Testimonial.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { $dayOfMonth: '$createdAt' },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Define fixed week ranges: 1-8, 9-16, 17-23, 24-end
    const weekRanges = [
      { start: 1, end: 8, label: 'Week 1' },
      { start: 9, end: 16, label: 'Week 2' },
      { start: 17, end: 23, label: 'Week 3' },
      {
        start: 24,
        end: Math.min(31, daysInMonth),
        label: `Week 4`,
      },
    ];

    // Initialize weekly counts and labels
    const weekly = Array(4).fill(0);
    const weekLabels = weekRanges.map((range) => range.label);

    // Map daily counts to weeks
    testimonials.forEach((day) => {
      const dayOfMonth = day._id;
      for (let i = 0; i < weekRanges.length; i++) {
        const { start, end } = weekRanges[i];
        if (dayOfMonth >= start && dayOfMonth <= end) {
          weekly[i] += day.count;
          break;
        }
      }
    });

    // Calculate total testimonials for the month
    const recent = weekly.reduce((sum, count) => sum + count, 0);

    logger.info(`Recent testimonials retrieved for ${yearNumber}-${monthNumber}`, {
      traceId,
      userId: req.user?.userId,
      recent,
      weekly,
      weekLabels,
    });

    return res.status(200).json({
      success: true,
      message: 'Recent testimonials retrieved successfully',
      data: { recent, weekly, weekLabels },
      traceId,
    });
  } catch (error) {
    logger.error(`Get recent testimonials error: ${error.message}`, {
      traceId,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      code: 'DATABASE_ERROR',
      message: 'Failed to fetch recent testimonials',
      traceId,
    });
  }
};