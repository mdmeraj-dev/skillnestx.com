import express from 'express';
import User from '../models/User.js';
import Course from '../models/Course.js';
import { ensureAuthenticated } from '../middleware/authMiddleware.js';

const router = express.Router();

// Check if user has access to a course
router.get('/access', ensureAuthenticated, async (req, res) => {
  try {
    // Get courseId from query params and userId from authenticated user
    const { courseId } = req.query;
    const userId = req.user.userId; // Now coming from auth middleware

    if (!courseId) {
      return res.status(400).json({ hasAccess: false, message: 'Missing courseId' });
    }

    // Fetch user and course
    const user = await User.findById(userId).select('subscription purchasedCourses');
    const course = await Course.findById(courseId).select('requiredSubscriptionTypes');

    if (!user) {
      return res.status(404).json({ hasAccess: false, message: 'User not found' });
    }
    if (!course) {
      return res.status(404).json({ hasAccess: false, message: 'Course not found' });
    }

    // Use hasCourseAccess virtual
    const { hasAccess, reason } = await user.hasCourseAccess(
      courseId,
      course.requiredSubscriptionTypes || ['pro', 'premium'] // Fallback if field is missing
    );

    return res.status(hasAccess ? 200 : 403).json({ hasAccess, message: reason });
  } catch (error) {
    console.error('Error checking course access:', error);
    return res.status(500).json({
      hasAccess: false,
      message: 'Server error while checking course access',
    });
  }
});

export default router;