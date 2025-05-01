// Not Found Middleware
export const notFound = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404);
    next(error);
  };
  
  // Error Handler Middleware
  export const errorHandler = (err, req, res, next) => {
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode; // Default to 500 if status code is 200
    res.status(statusCode);
  
    // Log the error for debugging (in development mode)
    if (process.env.NODE_ENV !== 'production') {
      console.error(err.stack);
    }
  
    // Send error response
    res.json({
      success: false,
      message: err.message,
      stack: process.env.NODE_ENV === 'production' ? null : err.stack, // Hide stack trace in production
    });
  };