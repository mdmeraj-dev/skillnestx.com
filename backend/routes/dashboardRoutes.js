import express from 'express';
import { getDashboardMetrics } from '../controllers/dashboardController.js';
import { ensureAuthenticated, ensureAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// @desc    Get dashboard metrics
// @route   GET /api/admin/dashboard
// @access  Private/Admin
router.route('/').get(ensureAuthenticated, ensureAdmin, getDashboardMetrics);

export default router;