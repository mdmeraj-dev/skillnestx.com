import express from 'express';
import {
  getTestimonials,
  addTestimonial,
  updateTestimonial,
  deleteTestimonial,
  getTotalTestimonials,
  getRecentTestimonials,
} from '../controllers/testimonialController.js';
import { ensureAuthenticated, ensureRole } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes (no authentication required)
router.get('/', getTestimonials); // Get all testimonials with optional filtering
router.get('/total', getTotalTestimonials); // Get total testimonials for a year
router.get('/recent', getRecentTestimonials); // Get recent testimonials for a year and month

// Apply authentication and authorization middleware to admin routes
router.use(ensureAuthenticated, ensureRole('admin'));

// Admin routes
router.post('/', addTestimonial); // Add a new testimonial
router.put('/:id', updateTestimonial); // Update an existing testimonial
router.delete('/:id', deleteTestimonial); // Delete a testimonial

export default router;