import { validationResult, matchedData } from 'express-validator';

/**
 * Middleware to validate the request based on the validation rules.
 * If there are validation errors, it sends a 400 response with the errors.
 * If there are no errors, it sanitizes the request data and attaches it to `req.validatedData`.
 *
 * @param {Array} validations - Array of validation rules from express-validator.
 * @returns {Function} - Express middleware function.
 */
export const validateRequest = (validations) => {
  return async (req, res, next) => {
    try {
      // Run all validation rules
      await Promise.all(validations.map((validation) => validation.run(req)));

      // Check for validation errors
      const errors = validationResult(req);

      // If there are errors, return a 400 response with the errors
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array().map((err) => ({
            field: err.path,
            message: err.msg,
          })),
        });
      }

      // Sanitize the request data and attach it to `req.validatedData`
      req.validatedData = matchedData(req, { locations: ['body', 'query', 'params'] });

      // Proceed to the next middleware
      next();
    } catch (error) {
      console.error('Validation Error:', error);

      // Log the full error stack for debugging in production
      if (process.env.NODE_ENV === 'production') {
        console.error('Validation Error Stack:', error.stack);
      }

      // Return a generic error response to avoid leaking sensitive information
      res.status(500).json({
        success: false,
        message: 'Internal server error during validation',
      });
    }
  };
};