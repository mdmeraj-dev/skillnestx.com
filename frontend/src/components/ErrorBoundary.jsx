import React, { Component } from "react";
import { toast } from "react-toastify"; // For user feedback

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  // Catch errors in any components below and re-render with fallback UI
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  // Log error details
  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    // Placeholder for logging to a service like Sentry
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    toast.error("An error occurred. Please try again or contact support.");

    // Optional: Send error to a logging service
    // logErrorToService(error, errorInfo);
  }

  // Reset error state to retry rendering
  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Something Went Wrong</h1>
            <p className="text-gray-600 mb-6">
              We're sorry, but an error occurred while loading this content. Please try again or contact support if the issue persists.
            </p>
            <button
              onClick={this.handleRetry}
              className="bg-blue-600 text-white px-6 py-2 rounded-full hover:bg-blue-700 transition-colors duration-300"
            >
              Try Again
            </button>
            {process.env.NODE_ENV === "development" && (
              <div className="mt-6 text-left">
                <p className="text-sm text-gray-500 font-mono">
                  <strong>Error:</strong> {this.state.error?.toString()}
                </p>
                <p className="text-sm text-gray-500 font-mono">
                  <strong>Stack Trace:</strong> {this.state.errorInfo?.componentStack}
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;