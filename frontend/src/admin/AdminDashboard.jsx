import React, { useState, useEffect, useCallback, Suspense } from "react";
import { Routes, Route, Navigate, Outlet, Link, useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import AdminNavbar from "./components/AdminNavbar";
import AdminSidebar from "./components/AdminSidebar";
import AdminMainContent from "./components/AdminMainContent";
import "./styles/AdminDashboard.css";
import { toast } from "react-toastify";

// Logger for consistency with App.jsx
const logger = {
  error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta),
  warn: (msg, meta) => {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[WARN] ${msg}`, meta);
    }
  },
  debug: (msg, meta) => {
    if (process.env.NODE_ENV !== "production") {
      console.debug(`[DEBUG] ${msg}`, meta);
    }
  },
};

// Functional ErrorBoundary aligned with App.jsx
const ErrorBoundary = ({ children }) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const handleError = (error, errorInfo) => {
      logger.error("ErrorBoundary caught error", { error: error.message, errorInfo });
      setHasError(true);
    };
    window.addEventListener("error", handleError);
    return () => window.removeEventListener("error", handleError);
  }, []);

  if (hasError) {
    return (
      <div className="admin-dashboard-error-fallback">
        <h2>Something went wrong</h2>
        <p>Please try refreshing the page or contact support.</p>
        <button
          onClick={() => setHasError(false)}
          className="admin-dashboard-retry-button"
          type="button"
        >
          Retry
        </button>
      </div>
    );
  }
  return children;
};

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
};

// Simplified ProtectedRoute relying on App.jsx auth
const ProtectedRoute = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const traceId = crypto.randomUUID();

  if (!user || user.role !== "admin") {
    onLogout();
  }

  return <Outlet />;
};

ProtectedRoute.propTypes = {
  user: PropTypes.shape({
    _id: PropTypes.string,
    email: PropTypes.string,
    role: PropTypes.oneOf(["user", "admin"]),
  }),
  onLogout: PropTypes.func.isRequired,
};

// 404 Page Component
const NotFound = () => {
  return (
    <div className="admin-dashboard-not-found">
      <h1>404 - Page Not Found</h1>
      <p>Sorry, the page you are looking for does not exist.</p>
      <Link to="/admin/home" className="admin-dashboard-not-found-link">
        Return to Dashboard
      </Link>
    </div>
  );
};

const AdminDashboard = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);

  // Validate user on mount
  useEffect(() => {
    const traceId = crypto.randomUUID();
    if (!user || user.role !== "admin") {
      logger.warn("AdminDashboard: Invalid user", { user, traceId });
      onLogout();
      toast.error("Session invalid. Please log in as an admin.");
      navigate("/login", { replace: true });
    } else if (!window.location.pathname.startsWith("/admin")) {
      logger.debug("Redirecting to /admin/home", { traceId });
      navigate("/admin/home", { replace: true });
    }
  }, [user, onLogout, navigate]);

  // Debounced resize handler
  const handleResize = useCallback(() => {
    const isDesktop = window.innerWidth >= 1024;
    setIsSidebarOpen(isDesktop);
  }, []);

  useEffect(() => {
    let timeoutId;
    const debouncedResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleResize, 100);
    };

    window.addEventListener("resize", debouncedResize);
    return () => {
      window.removeEventListener("resize", debouncedResize);
      clearTimeout(timeoutId);
    };
  }, [handleResize]);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  // Early return if user is invalid
  if (!user || user.role !== "admin") {
    return null; // Render nothing, as useEffect handles redirect
  }

  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="admin-dashboard-loading" aria-live="polite">
            <div className="spinner" />
            <style>
              {`
                .admin-dashboard-loading {
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  height: 100vh;
                  background-color: #f5f5f5;
                }
                .spinner {
                  width: 40px;
                  height: 40px;
                  border: 4px solid #783ef0;
                  border-top: 4px solid #f3f3f3;
                  border-radius: 50%;
                  animation: spin 1s linear infinite;
                }
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}
            </style>
          </div>
        }
      >
        <div className="admin-dashboard">
          <AdminNavbar
            user={user}
            onLogout={onLogout}
            toggleSidebar={toggleSidebar}
            isSidebarOpen={isSidebarOpen}
          />
          <AdminSidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
          <Routes>
            <Route element={<ProtectedRoute user={user} onLogout={onLogout} />}>
              <Route
                path="home"
                element={<AdminMainContent section="Dashboard" isSidebarOpen={isSidebarOpen} />}
              />
              <Route
                path="users"
                element={<AdminMainContent section="Users" isSidebarOpen={isSidebarOpen} />}
              />
              <Route
                path="courses"
                element={<AdminMainContent section="Courses" isSidebarOpen={isSidebarOpen} />}
              />
              <Route
                path="subscriptions"
                element={<AdminMainContent section="Subscriptions" isSidebarOpen={isSidebarOpen} />}
              />
              <Route
                path="transactions"
                element={<AdminMainContent section="Transactions" isSidebarOpen={isSidebarOpen} />}
              />
              <Route
                path="testimonials"
                element={<AdminMainContent section="Testimonials" isSidebarOpen={isSidebarOpen} />}
              />
              <Route index element={<Navigate to="home" replace />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </Suspense>
    </ErrorBoundary>
  );
};

AdminDashboard.propTypes = {
  user: PropTypes.shape({
    _id: PropTypes.string,
    email: PropTypes.string,
    role: PropTypes.oneOf(["user", "admin"]),
  }),
  onLogout: PropTypes.func.isRequired,
};

export default AdminDashboard;