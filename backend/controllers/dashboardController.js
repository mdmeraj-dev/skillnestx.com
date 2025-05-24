import User from '../models/User.js';
import Course from '../models/Course.js';
import Subscription  from '../models/Subscription.js';
import Testimonial from '../models/Testimonial.js';
import asyncHandler from 'express-async-handler';

// @desc    Get dashboard metrics with total counts and monthly history for current year
// @route   GET /api/admin/dashboard
// @access  Private/Admin
export const getDashboardMetrics = asyncHandler(async (req, res) => {
  const traceId = req.headers?.['x-trace-id'] || Date.now().toString(36);
  try {
    // Default to current year
    const year = new Date().getFullYear();

    // Define start and end dates for the year
    const startDate = new Date(year, 0, 1); // January 1st
    const endDate = new Date(year + 1, 0, 1); // January 1st of next year

    // Fetch data concurrently
    const [userData, subscriptionData, courseData, testimonialData] = await Promise.all([
      // Users: Total and monthly history
      (async () => {
        const total = await User.countDocuments({
          createdAt: { $gte: startDate, $lt: endDate },
        });
        const history = await User.aggregate([
          {
            $match: {
              createdAt: { $gte: startDate, $lt: endDate },
            },
          },
          {
            $group: {
              _id: { $month: '$createdAt' },
              count: { $sum: 1 },
            },
          },
          {
            $sort: { '_id': 1 },
          },
        ]);
        // Create array of 12 months, fill with counts
        const monthlyCounts = Array(12).fill(0);
        history.forEach((item) => {
          monthlyCounts[item._id - 1] = item.count;
        });
        return { total, history: monthlyCounts };
      })(),

      // Subscriptions: Total and monthly history
      (async () => {
        const total = await Subscription.countDocuments({
          createdAt: { $gte: startDate, $lt: endDate },
        });
        const history = await Subscription.aggregate([
          {
            $match: {
              createdAt: { $gte: startDate, $lt: endDate },
            },
          },
          {
            $group: {
              _id: { $month: '$createdAt' },
              count: { $sum: 1 },
            },
          },
          {
            $sort: { '_id': 1 },
          },
        ]);
        const monthlyCounts = Array(12).fill(0);
        history.forEach((item) => {
          monthlyCounts[item._id - 1] = item.count;
        });
        return { totalSubscribers: total, history: monthlyCounts };
      })(),

      // Courses: Total and monthly history
      (async () => {
        const total = await Course.countDocuments({
          createdAt: { $gte: startDate, $lt: endDate },
        });
        const history = await Course.aggregate([
          {
            $match: {
              createdAt: { $gte: startDate, $lt: endDate },
            },
          },
          {
            $group: {
              _id: { $month: '$createdAt' },
              count: { $sum: 1 },
            },
          },
          {
            $sort: { '_id': 1 },
          },
        ]);
        const monthlyCounts = Array(12).fill(0);
        history.forEach((item) => {
          monthlyCounts[item._id - 1] = item.count;
        });
        return { recent: total, history: monthlyCounts };
      })(),

      // Testimonials: Total and monthly history
      (async () => {
        const total = await Testimonial.countDocuments({
          createdAt: { $gte: startDate, $lt: endDate },
        });
        const history = await Testimonial.aggregate([
          {
            $match: {
              createdAt: { $gte: startDate, $lt: endDate },
            },
          },
          {
            $group: {
              _id: { $month: '$createdAt' },
              count: { $sum: 1 },
            },
          },
          {
            $sort: { '_id': 1 },
          },
        ]);
        const monthlyCounts = Array(12).fill(0);
        history.forEach((item) => {
          monthlyCounts[item._id - 1] = item.count;
        });
        return { total, history: monthlyCounts };
      })(),
    ]);

    // Prepare response
    const response = {
      success: true,
      data: {
        users: userData,
        subscribers: { data: subscriptionData },
        courses: { data: courseData },
        testimonials: testimonialData,
      },
      message: 'Dashboard metrics retrieved successfully',
    };

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: `Server Error: Unable to fetch dashboard metrics - ${error.message}`,
      traceId,
    });
  }
});