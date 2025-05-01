import express from 'express';
import { body, param } from 'express-validator'; // For input validation
import {
  getAllSubscribedUsers,
  activateSubscription,
  cancelSubscription,
  extendSubscription,
  checkSubscriptionStatus,
  getTotalSubscriberCount, // Added for dashboard
} from '../controllers/subscriptionController.js';
import {isAuthenticated, adminOnly } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js'; // Custom middleware for validation


const router = express.Router();

// Apply authentication and authorization middleware to all routes
router.use(isAuthenticated, adminOnly);

/**
 * @route   GET /api/subscriptions/users
 * @desc    Get all subscribed users
 * @access  Private/Admin
 */
router.get('/users', getAllSubscribedUsers);

/**
 * @route   GET /api/subscriptions/total/count
 * @desc    Get total count of active subscribers
 * @access  Private/Admin
 */
router.get('/total/count', getTotalSubscriberCount); // Updated endpoint

/**
 * @route   POST /api/subscriptions/users/:email/activate
 * @desc    Activate a subscription for a user
 * @access  Private/Admin
 */
router.post(
  '/users/:email/activate',
  [
    param('email').isEmail().withMessage('Invalid email address'),
    body('type')
      .isIn(['free', 'basic', 'pro', 'premium'])
      .withMessage('Invalid subscription type'),
    body('planDuration')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Plan duration must be a positive number'),
  ],
  validateRequest,
  activateSubscription
);

/**
 * @route   PUT /api/subscriptions/users/:email/cancel
 * @desc    Cancel a subscription for a user
 * @access  Private/Admin
 */
router.put(
  '/users/:email/cancel',
  [param('email').isEmail().withMessage('Invalid email address')],
  validateRequest,
  cancelSubscription
);

/**
 * @route   PUT /api/subscriptions/users/:email/extend
 * @desc    Extend a subscription for a user
 * @access  Private/Admin
 */
router.put(
  '/users/:email/extend',
  [
    param('email').isEmail().withMessage('Invalid email address'),
    body('additionalDuration')
      .isInt({ min: 1 })
      .withMessage('Additional duration must be a positive number'),
  ],
  validateRequest,
  extendSubscription
);

/**
 * @route   GET /api/subscriptions/users/:email/status
 * @desc    Check subscription status for a user
 * @access  Private/Admin
 */
router.get(
  '/users/:email/status',
  [param('email').isEmail().withMessage('Invalid email address')],
  validateRequest,
  checkSubscriptionStatus
);

export default router;