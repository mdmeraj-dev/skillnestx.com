import express from 'express';
import {
  getTestimonials,
  addTestimonial,
  updateTestimonial,
  deleteTestimonial,
} from '../controllers/testimonialController.js'; // Import the controller functions
import {isAuthenticated, checkRole } from '../middleware/authMiddleware.js'; // Import the authentication and authorization middleware

const router = express.Router();

// Public route (no authentication required)
router.get('/', getTestimonials); // Get all testimonials (public access)

// Apply authentication and authorization middleware to all other testimonial routes
router.use(isAuthenticated, checkRole('admin'));

// Testimonial Management Routes (admin only)
router.post('/', addTestimonial); // Add a new testimonial (admin only)
router.put('/:id', updateTestimonial); // Update an existing testimonial (admin only)
router.delete('/:id', deleteTestimonial); // Delete a testimonial (admin only)

export default router;