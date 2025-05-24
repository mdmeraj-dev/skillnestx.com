import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
  Outlet,
} from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { CartProvider } from "./contexts/CartContext";
import { jwtDecode } from "jwt-decode";
import axios from "axios";
import { toast } from "react-toastify";

// Import components
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ScrollToTop from "./components/ScrollToTop";
import Carousel from "./components/Carousel";
import CourseList from "./components/CourseList";
import CourseContent from "./components/CourseContent";
import TrustedPage from "./pages/TrustedPage";
import Testimonial from "./components/Testimonial";
import FAQSection from "./components/FAQSection";
import DeleteAccount from "./components/profile/DeleteAccount";
import SavedCourseCard from "./components/SavedCourseCard";
import InProgressCourses from "./components/InProgressCourses";
import HeroSection from "./components/HeroSection";

// Import pages
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import RefundPolicy from "./pages/RefundPolicy";
import AboutUs from "./pages/AboutUs";
import ContactUs from "./pages/ContactUs";
import Careers from "./pages/Careers";
import Support from "./pages/Support";
import Login from "./pages/Login";
import SignUp from "./pages/Signup";
import PricingPage from "./pages/PricingPage";
import SearchResults from "./pages/SearchResults";
import CartPage from "./pages/CartPage";
import PaymentPage from "./pages/PaymentPage";
import PersonalPlan from "./pages/PersonalPlan";
import TeamPlan from "./pages/TeamPlan";
import GiftPlan from "./pages/GiftPlan";
import LessonPage from "./pages/LessonPage";
import ForgotPassword from "./pages/ForgotPassword";
import VerifyEmail from "./pages/VerifyEmail";
import ResetPassword from "./pages/ResetPassword";
import AdminDashboard from "./admin/AdminDashboard";
import Success from "./pages/Success";
import "./App.css";
import "./styles/SavedCourses.css";
import "./styles/InProgressCourses.css";

// Production-ready logger
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

// Configure Axios with base URL
const BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
const api = axios.create({
  baseURL: BASE_URL,
});

// Lock for verifyUser to prevent concurrent calls
let isVerifying = false;

// Axios interceptor for token refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      originalRequest.url !== "/api/auth/refresh-token" &&
      originalRequest.url !== "/api/auth/logout"
    ) {
      originalRequest._retry = true;
      const traceId = crypto.randomUUID();
      try {
        const refreshToken = localStorage.getItem("refreshToken");
        if (
          !refreshToken ||
          typeof refreshToken !== "string" ||
          refreshToken.length < 10
        ) {
          logger.warn("Invalid refresh token for interceptor", { traceId });
          throw new Error("Invalid refresh token");
        }
        logger.debug("Attempting token refresh in interceptor", { traceId });
        const refreshResponse = await api.post(
          "/api/auth/refresh-token",
          { refreshToken },
          {
            headers: {
              "X-Trace-Id": traceId,
              "Content-Type": "application/json",
            },
          }
        );
        const refreshData = refreshResponse.data;
        if (refreshResponse.status === 200 && refreshData.success) {
          localStorage.setItem("accessToken", refreshData.accessToken);
          localStorage.setItem("refreshToken", refreshData.refreshToken);
          logger.debug("Interceptor refreshed tokens", { traceId });
          originalRequest.headers[
            "Authorization"
          ] = `Bearer ${refreshData.accessToken}`;
          return api(originalRequest);
        }
        logger.warn("Interceptor token refresh failed", {
          traceId,
          status: refreshResponse.status,
          message: refreshData.message,
        });
        throw new Error(refreshData.message || "Refresh failed");
      } catch (refreshError) {
        logger.error("Interceptor refresh error", {
          error: refreshError.message,
          traceId,
          response: refreshError.response?.data,
        });
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("profilePicture");
        window.dispatchEvent(
          new CustomEvent("navigate", {
            detail: {
              path: "/login",
              state: {
                error:
                  refreshError.response?.data?.message ||
                  "Session expired. Please log in again.",
              },
              replace: true,
            },
          })
        );
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

// Simple Error Boundary
const ErrorBoundary = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  useEffect(() => {
    const handleError = () => setHasError(true);
    window.addEventListener("error", handleError);
    return () => window.removeEventListener("error", handleError);
  }, []);
  if (hasError) {
    return (
      <div className="error-fallback">
        <h1>Something went wrong.</h1>
        <p>Please try refreshing the page or contact support.</p>
      </div>
    );
  }
  return children;
};

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
};

// ProtectedRoute component
const ProtectedRoute = ({ auth, children }) => {
  const traceId = crypto.randomUUID();
  if (!auth.isAuthenticated || !auth.user) {
    logger.warn("ProtectedRoute: Invalid auth state", {
      traceId,
      isAuthenticated: auth.isAuthenticated,
      hasUser: !!auth.user,
      path: window.location.pathname,
    });
    return (
      <Navigate
        to="/login"
        state={{ error: "Please log in to access this page." }}
        replace
      />
    );
  }
  logger.debug("ProtectedRoute: Valid auth state", {
    traceId,
    userId: auth.user?._id,
    role: auth.user?.role,
    path: window.location.pathname,
  });
  return children ? children : <Outlet />;
};

ProtectedRoute.propTypes = {
  auth: PropTypes.shape({
    isAuthenticated: PropTypes.bool.isRequired,
    user: PropTypes.object,
  }).isRequired,
  children: PropTypes.node,
};

// HomeTab component
const HomeTab = ({ onCourseClick, auth }) => (
  <div className="home-tab-content">
    <CourseList onCourseClick={onCourseClick} auth={auth} />
    <Testimonial />
  </div>
);

HomeTab.propTypes = {
  onCourseClick: PropTypes.func.isRequired,
  auth: PropTypes.shape({
    isAuthenticated: PropTypes.bool.isRequired,
    user: PropTypes.object,
  }),
};

// InProgressTab component
const InProgressTab = ({ auth, onCourseClick }) => (
  <div className="tab-content">
    <InProgressCourses auth={auth} onCourseClick={onCourseClick} />
  </div>
);

InProgressTab.propTypes = {
  auth: PropTypes.shape({
    isAuthenticated: PropTypes.bool.isRequired,
    user: PropTypes.object,
  }).isRequired,
  onCourseClick: PropTypes.func.isRequired,
};

// SavedCoursesTab component
const SavedCoursesTab = ({ auth }) => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSavedCourses = async () => {
      if (!auth?.isAuthenticated || !auth?.user?._id) {
        setCourses([]);
        setLoading(false);
        toast.error("Please log in to view saved courses.");
        return;
      }
      const traceId = crypto.randomUUID();
      try {
        const accessToken = localStorage.getItem("accessToken");
        if (!accessToken) {
          throw new Error("No access token found. Please log in.");
        }
        const response = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL || "http://localhost:5000"}/api/saved-courses`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "X-Trace-Id": traceId,
            },
          }
        );
        if (response.data.success) {
          setCourses(response.data.data || []);
          logger.debug("Fetched saved courses", { traceId, count: response.data.data.length });
        } else {
          throw new Error(response.data.message || "Failed to fetch saved courses");
        }
      } catch (err) {
        logger.error("Error fetching saved courses", {
          traceId,
          error: err.response?.data?.message || err.message,
        });
        setError(err.response?.data?.message || "Failed to fetch saved courses");
        toast.error(err.response?.data?.message || "Failed to fetch saved courses");
      } finally {
        setLoading(false);
      }
    };
    fetchSavedCourses();
  }, [auth?.isAuthenticated, auth?.user?._id]);

  const handleUnsave = async (courseId) => {
    const traceId = crypto.randomUUID();
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        throw new Error("No access token found. Please log in.");
      }
      const response = await axios.delete(
        `${import.meta.env.VITE_BACKEND_URL || "http://localhost:5000"}/api/saved-courses/${courseId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "X-Trace-Id": traceId,
          },
        }
      );
      if (response.data.success) {
        setCourses(courses.filter((course) => course._id !== courseId));
        toast.success(response.data.message);
        logger.debug("Course unsaved", { traceId, courseId });
      } else {
        throw new Error(response.data.message || "Failed to unsave course");
      }
    } catch (err) {
      logger.error("Error unsaving course", {
        traceId,
        error: err.response?.data?.message || err.message,
      });
      toast.error(err.response?.data?.message || "Failed to unsave course");
    }
  };

  return (
    <div className="saved-courses-container">
      <h2 className="saved-courses-title">Saved Courses</h2>
      {loading ? (
        <div className="saved-courses-skeleton">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="skeleton-card">
              <div className="skeleton-image"></div>
              <div className="skeleton-title"></div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="saved-courses-empty">{error}</div>
      ) : courses.length === 0 ? (
        <p className="saved-courses-empty">No saved courses found. Save courses to view them here.</p>
      ) : (
        <div className="saved-courses-grid">
          {courses.map((course) => (
            <div key={course._id}>
              <SavedCourseCard course={course} onUnsave={handleUnsave} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

SavedCoursesTab.propTypes = {
  auth: PropTypes.shape({
    isAuthenticated: PropTypes.bool.isRequired,
    user: PropTypes.object,
  }).isRequired,
};

// Layout component
function Layout({
  children,
  onSearch,
  auth,
  handleLogout,
  handleAuthSuccess,
  setShowLogin = () => {},
  setShowSignup = () => {},
  searchResults = [],
}) {
  const [activeTab, setActiveTab] = useState("home");
  const [showLogin, setShowLoginLocal] = useState(false);
  const [showSignup, setShowSignupLocal] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === "/login") {
      setShowLoginLocal(true);
      setShowSignupLocal(false);
    } else if (location.pathname === "/signup") {
      setShowLoginLocal(false);
      setShowSignupLocal(true);
    } else {
      setShowLoginLocal(false);
      setShowSignupLocal(false);
    }
  }, [location.pathname]);

  const handleCloseModal = () => {
    setShowLoginLocal(false);
    setShowSignupLocal(false);
    setShowLogin(false);
    setShowSignup(false);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  return (
    <div className="app-container">
      <ScrollToTop />
      <Navbar
        onSearch={onSearch}
        setShowLogin={setShowLogin || setShowLoginLocal}
        setShowSignup={setShowSignup || setShowSignupLocal}
        user={auth?.user}
        onLogout={handleLogout}
        onAuthSuccess={handleAuthSuccess}
      />
      <div className="main-content">
        {location.pathname === "/" && (
          <>
            <HeroSection auth={auth} />
            <Carousel />
            <div className="tabs-container">
              <ul className="tabs">
                <li
                  className={`tab ${activeTab === "home" ? "active" : ""}`}
                  onClick={() => handleTabChange("home")}
                >
                  Home
                </li>
                {auth.isAuthenticated && (
                  <>
                    <li
                      className={`tab ${activeTab === "in-progress" ? "active" : ""}`}
                      onClick={() => handleTabChange("in-progress")}
                    >
                      In Progress
                    </li>
                    <li
                      className={`tab ${activeTab === "saved-courses" ? "active" : ""}`}
                      onClick={() => handleTabChange("saved-courses")}
                    >
                      Saved Courses
                    </li>
                  </>
                )}
                <div
                  className="tab-slider"
                  style={{
                    width: `${100 / (auth.isAuthenticated ? 3 : 1)}%`,
                    left: `${
                      activeTab === "home"
                        ? 0
                        : activeTab === "in-progress"
                        ? 33.33
                        : 66.66
                    }%`,
                  }}
                ></div>
              </ul>
              {activeTab === "home" && (
                <HomeTab onCourseClick={children.props.onCourseClick} auth={auth} />
              )}
              {auth.isAuthenticated && activeTab === "in-progress" && (
                <InProgressTab auth={auth} onCourseClick={children.props.onCourseClick} />
              )}
              {auth.isAuthenticated && activeTab === "saved-courses" && <SavedCoursesTab auth={auth} />}
            </div>
            <TrustedPage />
            <FAQSection />
          </>
        )}
        {location.pathname !== "/" && children}
        {showLogin && (
          <Login
            onClose={handleCloseModal}
            setShowLogin={setShowLoginLocal}
            onAuthSuccess={handleAuthSuccess}
          />
        )}
        {showSignup && (
          <SignUp
            onClose={handleCloseModal}
            setShowSignup={setShowSignupLocal}
            onAuthSuccess={handleAuthSuccess}
          />
        )}
      </div>
      <Footer />
    </div>
  );
}

Layout.propTypes = {
  children: PropTypes.node.isRequired,
  onSearch: PropTypes.func.isRequired,
  searchResults: PropTypes.array,
  auth: PropTypes.shape({
    isAuthenticated: PropTypes.bool.isRequired,
    user: PropTypes.object,
  }),
  handleLogout: PropTypes.func,
  handleAuthSuccess: PropTypes.func,
  setShowLogin: PropTypes.func,
  setShowSignup: PropTypes.func,
};

// Main App component
function App() {
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Validate environment variables
  useEffect(() => {
    if (!BASE_URL) {
      logger.error("VITE_BACKEND_URL is not defined", {});
      throw new Error("Backend URL configuration missing");
    }
  }, []);

  // Initialize auth state
  const [auth, setAuth] = useState({ user: null, isAuthenticated: false });

  // Handle navigation events from interceptor
  useEffect(() => {
    const handleNavigate = (event) => {
      const { path, state, replace } = event.detail;
      navigate(path, { state, replace });
    };
    window.addEventListener("navigate", handleNavigate);
    return () => window.removeEventListener("navigate", handleNavigate);
  }, [navigate]);

  // Verify user authentication
  const verifyUser = useCallback(async () => {
    if (isVerifying) {
      logger.debug("verifyUser: Already verifying, skipping", {
        traceId: crypto.randomUUID(),
      });
      return false;
    }
    isVerifying = true;
    const traceId = crypto.randomUUID();
    const maxRetries = 3;
    let retryCount = 0;
    const timeoutMs = 10000; // 10 seconds timeout

    // Timeout wrapper for async operations
    const timeout = (promise, ms) => {
      return Promise.race([
        promise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Request timed out")), ms)
        ),
      ]);
    };

    const attemptRefresh = async () => {
      const refreshToken = localStorage.getItem("refreshToken");
      if (
        !refreshToken ||
        typeof refreshToken !== "string" ||
        refreshToken.length < 10
      ) {
        logger.warn("Invalid refresh token in attemptRefresh", { traceId });
        throw new Error("Invalid refresh token");
      }
      logger.debug("Attempting token refresh in verifyUser", { traceId });
      try {
        const refreshResponse = await timeout(
          api.post(
            "/api/auth/refresh-token",
            { refreshToken },
            {
              headers: {
                "X-Trace-Id": traceId,
                "Content-Type": "application/json",
              },
            }
          ),
          timeoutMs
        );
        const refreshData = refreshResponse.data;
        if (refreshResponse.status === 200 && refreshData.success) {
          localStorage.setItem("accessToken", refreshData.accessToken);
          localStorage.setItem("refreshToken", refreshData.refreshToken);
          logger.debug("verifyUser refreshed tokens", { traceId });
          return refreshData.accessToken;
        }
        logger.warn("Token refresh failed", {
          traceId,
          status: refreshResponse.status,
          message: refreshData.message,
        });
        throw new Error(refreshData.message || "Refresh failed");
      } catch (error) {
        if (error.response?.status === 429 && retryCount < maxRetries) {
          retryCount++;
          const delay = Math.pow(2, retryCount) * 1000;
          logger.warn(`Rate limit hit in refresh, retrying after ${delay}ms`, {
            traceId,
            retryCount,
          });
          await new Promise((resolve) => setTimeout(resolve, delay));
          return attemptRefresh();
        }
        throw error;
      }
    };

    const attemptVerify = async (accessToken) => {
      try {
        if (!accessToken) {
          throw new Error("No access token provided");
        }
        const decoded = jwtDecode(accessToken);
        if (!decoded.userId || !decoded.email) {
          throw new Error("Invalid token structure");
        }
        const response = await timeout(
          api.get(`${BASE_URL}/api/users/current`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "X-Trace-Id": traceId,
              "Content-Type": "application/json",
            },
          }),
          timeoutMs
        );

        const data = response.data;
        if (
          response.status === 200 &&
          data.success &&
          data.user &&
          data.user._id &&
          data.user.email &&
          data.user.role
        ) {
          setAuth({
            user: data.user,
            isAuthenticated: true,
          });
          if (
            data.user.role === "admin" &&
            !location.pathname.startsWith("/admin")
          ) {
            navigate("/admin/home", { replace: true });
          }
          return { success: true, response };
        }
        logger.warn("Invalid user data from /api/users/current", {
          traceId,
          success: data.success,
          user: data.user,
          path: location.pathname,
        });
        throw new Error(data.message || "Invalid user data");
      } catch (error) {
        if (error.response?.status === 429) {
          if (retryCount < maxRetries) {
            retryCount++;
            const delay = Math.pow(2, retryCount) * 1000;
            logger.warn(`Rate limit hit in verify, retrying after ${delay}ms`, {
              traceId,
              retryCount,
            });
            await new Promise((resolve) => setTimeout(resolve, delay));
            return attemptVerify(accessToken);
          }
          logger.error(`Max retries reached for rate limit`, { traceId });
          return { success: false, error: new Error("Rate limit exceeded") };
        }
        return { success: false, error };
      }
    };

    try {
      const params = new URLSearchParams(location.search);
      const accessTokenFromQuery = params.get("accessToken");
      const refreshTokenFromQuery = params.get("refreshToken");
      const errorMessage = params.get("error");

      // Fast path: No tokens, skip verification
      const accessToken = localStorage.getItem("accessToken");
      const refreshToken = localStorage.getItem("refreshToken");
      if (!accessToken && !refreshToken && !accessTokenFromQuery && !refreshTokenFromQuery) {
        logger.debug("No tokens present, skipping verification", { traceId });
        setAuth({ user: null, isAuthenticated: false });
        return true;
      }

      // Handle Google OAuth or VerifyEmail redirect
      if (accessTokenFromQuery && refreshTokenFromQuery) {
        logger.debug("Processing OAuth redirect", {
          traceId,
          accessToken: accessTokenFromQuery.substring(0, 10) + "...",
          refreshToken: refreshTokenFromQuery.substring(0, 10) + "...",
          path: location.pathname,
        });
        try {
          await new Promise((resolve) => setTimeout(resolve, 500));
          const decoded = jwtDecode(accessTokenFromQuery);
          if (decoded.exp * 1000 < Date.now()) {
            throw new Error("OAuth access token expired");
          }
          if (!decoded.userId || !decoded.email || !decoded.role) {
            throw new Error("Invalid OAuth token structure");
          }
          if (
            !refreshTokenFromQuery ||
            typeof refreshTokenFromQuery !== "string" ||
            refreshTokenFromQuery.length < 10
          ) {
            throw new Error("Invalid refresh token format");
          }
          localStorage.setItem("accessToken", accessTokenFromQuery);
          localStorage.setItem("refreshToken", refreshTokenFromQuery);
          const result = await attemptVerify(accessTokenFromQuery);
          if (result.success && result.response) {
            logger.debug("OAuth verification successful", {
              traceId,
              user: result.response.data.user,
            });
            setAuth({
              user: result.response.data.user,
              isAuthenticated: true,
            });
            handleAuthSuccess({
              user: result.response.data.user,
              accessToken: accessTokenFromQuery,
              refreshToken: refreshTokenFromQuery,
            });
          } else {
            throw result.error || new Error("OAuth verification failed");
          }
        } catch (error) {
          logger.error("OAuth verification error", {
            error: error.message,
            traceId,
            response: error.response?.data,
            path: location.pathname,
          });
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          localStorage.removeItem("profilePicture");
          navigate("/login", {
            replace: true,
            state: {
              error:
                error.response?.data?.message ||
                "Google authentication failed. Please try again or use email/password login.",
            },
          });
        }
        return false;
      } else if (errorMessage) {
        logger.debug("Redirect with error message", {
          traceId,
          errorMessage,
          path: location.pathname,
        });
        navigate("/login", {
          replace: true,
          state: { error: decodeURIComponent(errorMessage) },
        });
        return false;
      }

      // Verify existing tokens
      if (accessToken && refreshToken) {
        logger.debug("Verifying existing tokens", {
          traceId,
          accessToken: accessToken.substring(0, 10) + "...",
          path: location.pathname,
        });
        let tokenToVerify = accessToken;
        try {
          const decoded = jwtDecode(accessToken);
          if (decoded.exp * 1000 < Date.now()) {
            logger.warn("Access token expired, attempting refresh", {
              traceId,
              userId: decoded.userId,
            });
            tokenToVerify = await attemptRefresh();
          }
        } catch (error) {
          logger.warn("Invalid access token, attempting refresh", {
            traceId,
            error: error.message,
            path: location.pathname,
          });
          tokenToVerify = await attemptRefresh();
        }
        const result = await attemptVerify(tokenToVerify);
        if (!result.success) {
          throw result.error || new Error("Token verification failed");
        }
      }
    } catch (error) {
      logger.error("Verify user error", {
        error: error.message,
        traceId,
        response: error.response?.data,
        path: location.pathname,
      });
      if (error.message.includes("CORS") || error.code === "ERR_NETWORK" || error.message.includes("timed out")) {
        logger.warn("Network error, proceeding without auth", {
          traceId,
          path: location.pathname,
        });
        setAuth({ user: null, isAuthenticated: false });
      } else {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("profilePicture");
        setAuth({ user: null, isAuthenticated: false });
        if (location.pathname.startsWith("/admin")) {
          navigate("/login", {
            replace: true,
            state: {
              error:
                error.response?.data?.message ||
                "Session expired. Please log in again.",
            },
          });
        }
      }
    } finally {
      isVerifying = false;
      setAuthChecked(true);
      setLoading(false);
      logger.debug("verifyUser completed", { traceId, path: location.pathname });
    }
    return true;
  }, [location.pathname, navigate, BASE_URL]);

  // Trigger verifyUser on mount
  useEffect(() => {
    verifyUser();
  }, [verifyUser]);

  // Periodic token refresh with retry
  useEffect(() => {
    const refreshInterval = 10 * 60 * 1000; // 10 minutes
    let refreshTimeout;
    const maxRetries = 3;

    const scheduleRefresh = async () => {
      clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(async () => {
        const traceId = crypto.randomUUID();
        const refreshToken = localStorage.getItem("refreshToken");
        if (
          !refreshToken ||
          typeof refreshToken !== "string" ||
          refreshToken.length < 10
        ) {
          logger.warn("Invalid refresh token for scheduled refresh", {
            traceId,
          });
          setAuth({ user: null, isAuthenticated: false });
          navigate("/login", {
            state: { error: "Invalid session. Please log in again." },
            replace: true,
          });
          return;
        }

        let retryCount = 0;
        while (retryCount <= maxRetries) {
          try {
            logger.debug("Attempting scheduled token refresh", { traceId });
            const refreshResponse = await api.post(
              "/api/auth/refresh-token",
              { refreshToken },
              {
                headers: {
                  "X-Trace-Id": traceId,
                  "Content-Type": "application/json",
                },
              }
            );
            const refreshData = refreshResponse.data;
            if (refreshResponse.status === 200 && refreshData.success) {
              localStorage.setItem("accessToken", refreshData.accessToken);
              localStorage.setItem("refreshToken", refreshData.refreshToken);
              logger.debug("Scheduled token refresh successful", { traceId });
              scheduleRefresh();
              return;
            }
            logger.warn("Scheduled token refresh failed", {
              traceId,
              status: refreshResponse.status,
              message: refreshData.message,
            });
            throw new Error(refreshData.message || "Refresh failed");
          } catch (error) {
            if (error.response?.status === 429 && retryCount < maxRetries) {
              retryCount++;
              const delay = Math.pow(2, retryCount) * 1000;
              logger.warn(
                `Rate limit hit in scheduled refresh, retrying after ${delay}ms`,
                {
                  traceId,
                  retryCount,
                }
              );
              await new Promise((resolve) => setTimeout(resolve, delay));
            } else {
              logger.error("Scheduled refresh error", {
                error: error.message,
                traceId,
                response: error.response?.data,
              });
              localStorage.removeItem("accessToken");
              localStorage.removeItem("refreshToken");
              localStorage.removeItem("profilePicture");
              setAuth({ user: null, isAuthenticated: false });
              navigate("/login", {
                state: {
                  error:
                    error.response?.data?.message ||
                    "Session expired. Please log in again.",
                },
                replace: true,
              });
              return;
            }
          }
        }
      }, refreshInterval);
    };

    if (localStorage.getItem("refreshToken")) {
      scheduleRefresh();
    }

    return () => clearTimeout(refreshTimeout);
  }, [navigate]);

  const handleAuthSuccess = (userData) => {
    const traceId = crypto.randomUUID();
    logger.debug("handleAuthSuccess called", {
      userData: {
        ...userData,
        accessToken: userData.accessToken?.substring(0, 10) + "...",
        refreshToken: userData.refreshToken?.substring(0, 10) + "...",
      },
      traceId,
    });

    if (
      !userData ||
      !userData.user ||
      !userData.accessToken ||
      !userData.refreshToken
    ) {
      logger.warn("handleAuthSuccess received invalid userData", {
        userData,
        traceId,
      });
      setAuth({ user: null, isAuthenticated: false });
      navigate("/login", {
        state: { error: "Authentication failed. Please log in again." },
        replace: true,
      });
      return;
    }

    try {
      const decoded = jwtDecode(userData.accessToken);
      if (decoded.exp * 1000 < Date.now()) {
        throw new Error("Access token expired");
      }
      if (!decoded.userId || !decoded.email || !decoded.role) {
        throw new Error("Invalid access token structure");
      }
      if (
        !userData.refreshToken ||
        typeof userData.refreshToken !== "string" ||
        userData.refreshToken.length < 10
      ) {
        throw new Error("Invalid refresh token format");
      }
      if (!userData.user._id || !userData.user.email || !userData.user.role) {
        throw new Error("Invalid user data structure");
      }
    } catch (error) {
      logger.error("Invalid token or user in handleAuthSuccess", {
        error: error.message,
        traceId,
      });
      setAuth({ user: null, isAuthenticated: false });
      navigate("/login", {
        state: { error: "Authentication failed. Please log in again." },
        replace: true,
      });
      return;
    }

    const user = {
      ...userData.user,
      role:
        userData.user.role && ["user", "admin"].includes(userData.user.role)
          ? userData.user.role
          : "user",
    };

    setAuth({
      user,
      isAuthenticated: true,
    });

    localStorage.setItem("accessToken", userData.accessToken);
    localStorage.setItem("refreshToken", userData.refreshToken);

    if (user.role === "admin") {
      navigate("/admin/home", { replace: true });
    } else if (userData.redirectUrl) {
      try {
        const redirectPath = new URL(userData.redirectUrl, BASE_URL).pathname;
        navigate(redirectPath, { replace: true });
      } catch (error) {
        logger.warn("Invalid redirectUrl in handleAuthSuccess", {
          redirectUrl: userData.redirectUrl,
          traceId,
        });
        navigate("/", { replace: true });
      }
    } else {
      navigate("/", { replace: true });
    }
  };

  const handleLogout = async () => {
    const traceId = crypto.randomUUID();
    const accessToken = localStorage.getItem("accessToken");
    const refreshToken = localStorage.getItem("refreshToken");

    if (accessToken || refreshToken) {
      try {
        if (accessToken && refreshToken) {
          await api.post(
            `${BASE_URL}/api/auth/logout`,
            { refreshToken },
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "x-refresh-token": refreshToken,
                "Content-Type": "application/json",
                "X-Trace-Id": traceId,
              },
            }
          );
          logger.debug("Logout request successful", { traceId });
        } else {
          logger.warn("No tokens found for logout", { traceId });
        }
      } catch (error) {
        if (error.response?.status === 401) {
          logger.debug(
            "Logout request returned 401, proceeding with client-side logout",
            { traceId }
          );
        } else {
          logger.warn("Logout request failed", {
            error: error.message,
            traceId,
          });
        }
      }
    } else {
      logger.debug("No tokens found, proceeding with client-side logout", {
        traceId,
      });
    }

    // Clear all relevant localStorage keys
    const keysToRemove = [
      "accessToken",
      "refreshToken",
      "profilePicture",
      "selectedCourse",
      "user",
    ];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key.startsWith("rating_") ||
        key.startsWith("feedback_") ||
        key.startsWith("syllabus_") ||
        key.startsWith("progress_") ||
        key.startsWith("userData_") ||
        key.startsWith("completedLessons_") ||
        key.startsWith("visitedLessons_")
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));

    setAuth({ user: null, isAuthenticated: false });
    setShowLogin(false);
    setShowSignup(false);
    navigate("/", { replace: true });
  };

  const handleAccountDeletion = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("profilePicture");
    setAuth({ user: null, isAuthenticated: false });
    setShowLogin(false);
    setShowSignup(false);
    navigate("/", { replace: true });
  };

  const handleSearch = (results) => {
    setSearchResults(results);
  };

  const handleCourseClick = (courseId, course) => {
    navigate(`/course/${courseId}`, { state: { course } });
  };

  // Render skeleton loader until auth is checked
  if (loading || !authChecked) {
    return (
      <div className="skeleton-container">
        <div className="skeleton-content">
          <div className="skeleton-navbar skeleton">
            <div className="skeleton-navbar-logo skeleton"></div>
          </div>
          <div className="skeleton-main">
            <div className="skeleton-carousel skeleton"></div>
            <div className="skeleton-course-grid">
              {Array(4)
                .fill()
                .map((_, index) => (
                  <div
                    key={index}
                    className="skeleton-course-card skeleton"
                  ></div>
                ))}
            </div>
          </div>
          <div className="skeleton-footer skeleton"></div>
        </div>
        <div className="loading-container">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <CartProvider>
      <ErrorBoundary>
        <Routes>
          <Route
            path="/"
            element={
              <Layout
                onSearch={handleSearch}
                searchResults={searchResults}
                auth={auth}
                handleLogout={handleLogout}
                handleAuthSuccess={handleAuthSuccess}
                setShowLogin={setShowLogin}
                setShowSignup={setShowSignup}
              >
                <div onCourseClick={handleCourseClick} />
              </Layout>
            }
          />
          <Route
            path="/courses"
            element={
              <Layout
                onSearch={handleSearch}
                searchResults={searchResults}
                auth={auth}
                handleLogout={handleLogout}
                handleAuthSuccess={handleAuthSuccess}
                setShowLogin={setShowLogin}
                setShowSignup={setShowSignup}
              >
                <CourseList onCourseClick={handleCourseClick} auth={auth} />
              </Layout>
            }
          />
          <Route
            path="/courses/frontend"
            element={
              <Layout
                onSearch={handleSearch}
                searchResults={searchResults}
                auth={auth}
                handleLogout={handleLogout}
                handleAuthSuccess={handleAuthSuccess}
                setShowLogin={setShowLogin}
                setShowSignup={setShowSignup}
              >
                <CourseList
                  category="Frontend"
                  onCourseClick={handleCourseClick}
                  auth={auth}
                />
              </Layout>
            }
          />
          <Route
            path="/courses/backend"
            element={
              <Layout
                onSearch={handleSearch}
                searchResults={searchResults}
                auth={auth}
                handleLogout={handleLogout}
                handleAuthSuccess={handleAuthSuccess}
                setShowLogin={setShowLogin}
                setShowSignup={setShowSignup}
              >
                <CourseList
                  category="Backend"
                  onCourseClick={handleCourseClick}
                  auth={auth}
                />
              </Layout>
            }
          />
          <Route
            path="/courses/machine-learning"
            element={
              <Layout
                onSearch={handleSearch}
                searchResults={searchResults}
                auth={auth}
                handleLogout={handleLogout}
                handleAuthSuccess={handleAuthSuccess}
                setShowLogin={setShowLogin}
                setShowSignup={setShowSignup}
              >
                <CourseList
                  category="Machine Learning"
                  onCourseClick={handleCourseClick}
                  auth={auth}
                />
              </Layout>
            }
          />
          <Route
            path="/courses/artificial-intelligence"
            element={
              <Layout
                onSearch={handleSearch}
                searchResults={searchResults}
                auth={auth}
                handleLogout={handleLogout}
                handleAuthSuccess={handleAuthSuccess}
                setShowLogin={setShowLogin}
                setShowSignup={setShowSignup}
              >
                <CourseList
                  category="Artificial Intelligence"
                  onCourseClick={handleCourseClick}
                  auth={auth}
                />
              </Layout>
            }
          />
          <Route
            path="/courses/system-design"
            element={
              <Layout
                onSearch={handleSearch}
                searchResults={searchResults}
                auth={auth}
                handleLogout={handleLogout}
                handleAuthSuccess={handleAuthSuccess}
                setShowLogin={setShowLogin}
                setShowSignup={setShowSignup}
              >
                <CourseList
                  category="System Design"
                  onCourseClick={handleCourseClick}
                  auth={auth}
                />
              </Layout>
            }
          />
          <Route
            path="/about"
            element={
              <Layout
                onSearch={handleSearch}
                searchResults={searchResults}
                auth={auth}
                handleLogout={handleLogout}
                handleAuthSuccess={handleAuthSuccess}
                setShowLogin={setShowLogin}
                setShowSignup={setShowSignup}
              >
                <AboutUs />
              </Layout>
            }
          />
          <Route
            path="/support"
            element={
              <Layout
                onSearch={handleSearch}
                searchResults={searchResults}
                auth={auth}
                handleLogout={handleLogout}
                handleAuthSuccess={handleAuthSuccess}
                setShowLogin={setShowLogin}
                setShowSignup={setShowSignup}
              >
                <Support />
              </Layout>
            }
          />
          <Route
            path="/pricing"
            element={
              <Layout
                onSearch={handleSearch}
                searchResults={searchResults}
                auth={auth}
                handleLogout={handleLogout}
                handleAuthSuccess={handleAuthSuccess}
                setShowLogin={setShowLogin}
                setShowSignup={setShowSignup}
              >
                <PricingPage auth={auth} />
              </Layout>
            }
          />
          <Route
            path="/search-results"
            element={
              <Layout
                onSearch={handleSearch}
                searchResults={searchResults}
                auth={auth}
                handleLogout={handleLogout}
                handleAuthSuccess={handleAuthSuccess}
                setShowLogin={setShowLogin}
                setShowSignup={setShowSignup}
              >
                <SearchResults
                  searchResults={searchResults}
                  onCourseClick={handleCourseClick}
                />
              </Layout>
            }
          />
          <Route
            path="/cart"
            element={
              <Layout
                onSearch={handleSearch}
                searchResults={searchResults}
                auth={auth}
                handleLogout={handleLogout}
                handleAuthSuccess={handleAuthSuccess}
                setShowLogin={setShowLogin}
                setShowSignup={setShowSignup}
              >
                <CartPage auth={auth} />
              </Layout>
            }
          />
          <Route
            path="/payment"
            element={
              <ProtectedRoute auth={auth}>
                <Layout
                  onSearch={handleSearch}
                  searchResults={searchResults}
                  auth={auth}
                  handleLogout={handleLogout}
                  handleAuthSuccess={handleAuthSuccess}
                  setShowLogin={setShowLogin}
                  setShowSignup={setShowSignup}
                >
                  <PaymentPage auth={auth} />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/success"
            element={
              <Layout
                onSearch={handleSearch}
                searchResults={searchResults}
                auth={auth}
                handleLogout={handleLogout}
                handleAuthSuccess={handleAuthSuccess}
                setShowLogin={setShowLogin}
                setShowSignup={setShowSignup}
              >
                <Success auth={auth} />
              </Layout>
            }
          />
          <Route
            path="/subscription/personal"
            element={
              <ProtectedRoute auth={auth}>
                <Layout
                  onSearch={handleSearch}
                  searchResults={searchResults}
                  auth={auth}
                  handleLogout={handleLogout}
                  handleAuthSuccess={handleAuthSuccess}
                  setShowLogin={setShowLogin}
                  setShowSignup={setShowSignup}
                >
                  <PersonalPlan auth={auth} />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/subscription/team"
            element={
              <ProtectedRoute auth={auth}>
                <Layout
                  onSearch={handleSearch}
                  searchResults={searchResults}
                  auth={auth}
                  handleLogout={handleLogout}
                  handleAuthSuccess={handleAuthSuccess}
                  setShowLogin={setShowLogin}
                  setShowSignup={setShowSignup}
                >
                  <TeamPlan auth={auth} />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/subscription/gift"
            element={
              <ProtectedRoute auth={auth}>
                <Layout
                  onSearch={handleSearch}
                  searchResults={searchResults}
                  auth={auth}
                  handleLogout={handleLogout}
                  handleAuthSuccess={handleAuthSuccess}
                  setShowLogin={setShowLogin}
                  setShowSignup={setShowSignup}
                >
                  <GiftPlan auth={auth} />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/terms-of-service"
            element={
              <Layout
                onSearch={handleSearch}
                searchResults={searchResults}
                auth={auth}
                handleLogout={handleLogout}
                handleAuthSuccess={handleAuthSuccess}
                setShowLogin={setShowLogin}
                setShowSignup={setShowSignup}
              >
                <TermsOfService />
              </Layout>
            }
          />
          <Route
            path="/privacy-policy"
            element={
              <Layout
                onSearch={handleSearch}
                searchResults={searchResults}
                auth={auth}
                handleLogout={handleLogout}
                handleAuthSuccess={handleAuthSuccess}
                setShowLogin={setShowLogin}
                setShowSignup={setShowSignup}
              >
                <PrivacyPolicy />
              </Layout>
            }
          />
          <Route
            path="/refund-policy"
            element={
              <Layout
                onSearch={handleSearch}
                searchResults={searchResults}
                auth={auth}
                handleLogout={handleLogout}
                handleAuthSuccess={handleAuthSuccess}
                setShowLogin={setShowLogin}
                setShowSignup={setShowSignup}
              >
                <RefundPolicy />
              </Layout>
            }
          />
          <Route
            path="/about-us"
            element={
              <Layout
                onSearch={handleSearch}
                searchResults={searchResults}
                auth={auth}
                handleLogout={handleLogout}
                handleAuthSuccess={handleAuthSuccess}
                setShowLogin={setShowLogin}
                setShowSignup={setShowSignup}
              >
                <AboutUs />
              </Layout>
            }
          />
          <Route
            path="/contact-us"
            element={
              <Layout
                onSearch={handleSearch}
                searchResults={searchResults}
                auth={auth}
                handleLogout={handleLogout}
                handleAuthSuccess={handleAuthSuccess}
                setShowLogin={setShowLogin}
                setShowSignup={setShowSignup}
              >
                <ContactUs />
              </Layout>
            }
          />
          <Route
            path="/careers"
            element={
              <Layout
                onSearch={handleSearch}
                searchResults={searchResults}
                auth={auth}
                handleLogout={handleLogout}
                handleAuthSuccess={handleAuthSuccess}
                setShowLogin={setShowLogin}
                setShowSignup={setShowSignup}
              >
                <Careers />
              </Layout>
            }
          />
          <Route
            path="/login"
            element={
              <Layout
                onSearch={handleSearch}
                searchResults={searchResults}
                auth={auth}
                handleLogout={handleLogout}
                handleAuthSuccess={handleAuthSuccess}
                setShowLogin={setShowLogin}
                setShowSignup={setShowSignup}
              >
                <div />
              </Layout>
            }
          />
          <Route
            path="/signup"
            element={
              <Layout
                onSearch={handleSearch}
                searchResults={searchResults}
                auth={auth}
                handleLogout={handleLogout}
                handleAuthSuccess={handleAuthSuccess}
                setShowLogin={setShowLogin}
                setShowSignup={setShowSignup}
              >
                <div />
              </Layout>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <Layout
                onSearch={handleSearch}
                searchResults={searchResults}
                auth={auth}
                handleLogout={handleLogout}
                handleAuthSuccess={handleAuthSuccess}
                setShowLogin={setShowLogin}
                setShowSignup={setShowSignup}
              >
                <ForgotPassword />
              </Layout>
            }
          />
          <Route
            path="/verify-email"
            element={
              <Layout
                onSearch={handleSearch}
                searchResults={searchResults}
                auth={auth}
                handleLogout={handleLogout}
                handleAuthSuccess={handleAuthSuccess}
                setShowLogin={setShowLogin}
                subtle={true}
                setShowSignup={setShowSignup}
              >
                <VerifyEmail onAuthSuccess={handleAuthSuccess} />
              </Layout>
            }
          />
          <Route
            path="/reset-password"
            element={
              <Layout
                onSearch={handleSearch}
                searchResults={searchResults}
                auth={auth}
                handleLogout={handleLogout}
                handleAuthSuccess={handleAuthSuccess}
                setShowLogin={setShowLogin}
                setShowSignup={setShowSignup}
              >
                <ResetPassword />
              </Layout>
            }
          />
          <Route
            path="/delete-account"
            element={
              <ProtectedRoute auth={auth}>
                <Layout
                  onSearch={handleSearch}
                  searchResults={searchResults}
                  auth={auth}
                  handleLogout={handleLogout}
                  handleAuthSuccess={handleAuthSuccess}
                  setShowLogin={setShowLogin}
                  setShowSignup={setShowSignup}
                >
                  <DeleteAccount onDeleteSuccess={handleAccountDeletion} />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/*"
            element={
              auth.isAuthenticated && auth.user ? (
                <ProtectedRoute auth={auth}>
                  {logger.debug("Rendering AdminDashboard", {
                    traceId: crypto.randomUUID(),
                    userId: auth.user?._id,
                    role: auth.user?.role,
                    path: location.pathname,
                  })}
                  <AdminDashboard user={auth.user} onLogout={handleLogout} />
                </ProtectedRoute>
              ) : (
                <Navigate
                  to="/login"
                  state={{
                    error: "Please log in to access the admin dashboard.",
                  }}
                  replace
                />
              )
            }
          />
          <Route
            path="/course/:courseId"
            element={
              <Layout
                onSearch={handleSearch}
                searchResults={searchResults}
                auth={auth}
                handleLogout={handleLogout}
                handleAuthSuccess={handleAuthSuccess}
                setShowLogin={setShowLogin}
                setShowSignup={setShowSignup}
              >
                <CourseContent setShowLogin={setShowLogin} auth={auth} />
              </Layout>
            }
          />
          <Route
            path="/lesson/:lessonId"
            element={
              <ProtectedRoute auth={auth}>
                <Layout
                  onSearch={handleSearch}
                  searchResults={searchResults}
                  auth={auth}
                  handleLogout={handleLogout}
                  handleAuthSuccess={handleAuthSuccess}
                  setShowLogin={setShowLogin}
                  setShowSignup={setShowSignup}
                >
                  <LessonPage auth={auth} />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="*"
            element={
              <Navigate to="/" state={{ from: location.pathname }} replace />
            }
          />
        </Routes>
      </ErrorBoundary>
    </CartProvider>
  );
}

// AppWrapper
export default function AppWrapper() {
  return (
    <Router basename="/">
      <App />
    </Router>
  );
}