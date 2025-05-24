import React, { lazy, Suspense, Component, memo } from "react";
import PropTypes from "prop-types";
import AdminFooter from "./AdminFooter";
import "../styles/AdminMainContent.css";

// Lazy-load section components
const Dashboard = lazy(() => import("../pages/Dashboard"));
const UserManagement = lazy(() => import("../pages/UserManagement"));
const CourseManagement = lazy(() => import("../pages/CourseManagement"));
const SubscriptionManagement = lazy(() => import("../pages/SubscriptionManagement"));
const TransactionManagement = lazy(() => import("../pages/TransactionManagement"));
const TestimonialManagement = lazy(() => import("../pages/TestimonialManagement"));

// ErrorBoundary for catching errors in section components
class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("MainContent ErrorBoundary caught:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="admin-main-error-fallback">
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message || "An unexpected error occurred."}</p>
          <button
            onClick={this.handleRetry}
            className="admin-main-retry-button"
            type="button"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// NotFound component for invalid pages
const NotFound = () => (
  <div className="admin-main-not-found">
    <h2>Section Not Found</h2>
    <p>The requested admin section does not exist.</p>
    <a href="/admin/home" className="admin-main-not-found-link">
      Return to Dashboard
    </a>
  </div>
);

// Map section prop to components
const sectionMap = {
  Dashboard,
  Users: UserManagement,
  Courses: CourseManagement,
  Subscriptions: SubscriptionManagement,
  Transactions: TransactionManagement,
  Testimonials: TestimonialManagement,
};

const MainContent = ({ section, isSidebarOpen }) => {
  const SectionComponent = sectionMap[section] || NotFound;

  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="admin-main-page-loading" aria-live="polite">
            Loading...
          </div>
        }
      >
        <main
          className="admin-main-content"
          data-sidebar-open={isSidebarOpen}
          role="main"
          aria-label="Admin Main Content"
        >
          <div className="admin-main-content-container">
            <SectionComponent />
          </div>
        </main>
        <AdminFooter isSidebarOpen={isSidebarOpen} />
      </Suspense>
    </ErrorBoundary>
  );
};

MainContent.propTypes = {
  section: PropTypes.string.isRequired,
  isSidebarOpen: PropTypes.bool.isRequired,
};

export default memo(MainContent);