import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import axios from "axios";
import "./styles/PurchasedCourses.css";

// Logger aligned with App.jsx
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

// Generate UUID fallback
const generateUUID = () => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Configure Axios with base URL and interceptor
const BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

// Axios interceptor for token refresh
api.interceptors.request.use(
  (config) => {
    const accessToken = localStorage.getItem("accessToken")?.trim();
    const traceId = crypto.randomUUID?.() || generateUUID();
    config.headers["X-Trace-Id"] = traceId;
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
      logger.debug("Request headers", {
        traceId,
        headers: {
          Authorization: `Bearer ${accessToken.substring(0, 10)}...`,
          "Content-Type": config.headers["Content-Type"],
          "X-Trace-Id": traceId,
        },
      });
    } else {
      logger.warn("No access token found", { traceId });
    }
    return config;
  },
  (error) => Promise.reject(error)
);

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
      const traceId = crypto.randomUUID?.() || generateUUID();
      try {
        const refreshToken = localStorage.getItem("refreshToken")?.trim();
        if (!refreshToken) {
          logger.warn("No refresh token for interceptor", { traceId });
          throw new Error("Missing refresh token");
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
          originalRequest.headers.Authorization = `Bearer ${refreshData.accessToken}`;
          return api(originalRequest);
        }
        logger.warn("Interceptor token refresh failed", {
          traceId,
          status: refreshResponse.status,
          data: refreshData,
        });
        throw new Error("Refresh failed");
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
              state: { error: "Session expired. Please log in again." },
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

const PurchasedCourses = ({ onBack, onCourseClick, closeDropdown }) => {
  const [courses, setCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Disable page scroll when modal is active, restore on unmount or close
  useEffect(() => {
    // Save the current overflow style to restore it later
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // Prevent scrolling

    return () => {
      // Restore the original overflow style
      document.body.style.overflow = originalOverflow || "";
    };
  }, []);

  // Handle modal close to restore scroll
  const handleClose = () => {
    document.body.style.overflow = ""; // Restore scrolling
    onBack(); // Call the original onBack function
  };

  // Format date to DD-MM-YYYY
  const formatDate = (date) => {
    if (!date) return "Unknown";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "Unknown";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Check if course is expired
  const isCourseExpired = (endDate) => {
    if (!endDate) return false; // Treat missing endDate as not expired
    const expiryDate = new Date(endDate);
    if (isNaN(expiryDate.getTime())) return false; // Invalid date treated as not expired
    return expiryDate < new Date(); // Expired if endDate is in the past
  };

  // Fetch purchased courses with localStorage caching
  useEffect(() => {
    const fetchPurchasedCourses = async () => {
      const traceId = crypto.randomUUID?.() || generateUUID();
      const cachedCourses = localStorage.getItem("purchasedCourses"); // Moved outside try
      try {
        // Check localStorage for cached courses
        if (cachedCourses) {
          const parsedCourses = JSON.parse(cachedCourses);
          logger.debug("Loaded purchased courses from localStorage", {
            traceId,
            count: parsedCourses.length,
          });
          setCourses(parsedCourses);
          setIsLoading(false); // Set loading to false immediately
        } else {
          setIsLoading(true); // Keep loading true if no cache
        }

        // Fetch fresh data from API
        logger.debug("Fetching user data from /api/users/current", { traceId });
        const response = await api.get("/api/users/current");
        logger.debug("Raw user data response", {
          traceId,
          responseData: response.data,
        });

        const userId = response.data.user?._id || "unknown";
        const purchasedCourses = response.data.user?.purchasedCourses || [];

        if (!purchasedCourses.length) {
          logger.debug("No purchased courses found", { traceId });
          setCourses([]);
          setError("No purchased courses found. Explore courses to get started!");
          localStorage.setItem("purchasedCourses", JSON.stringify([])); // Cache empty array
        } else {
          // Create metadata for each course
          const coursesWithMetadata = purchasedCourses.map((course) => {
            const metadata = {
              purchaseType: "course",
              userId,
              courseId: course.courseId.toString(),
              amount: course.amount, // Use newPrice from backend
              duration: course.duration,
              title: course.title,
            };
            logger.debug("Course metadata", { traceId, metadata });
            return { ...course, metadata };
          });

          logger.debug("Fetched purchased courses", {
            traceId,
            count: purchasedCourses.length,
          });
          setCourses(coursesWithMetadata);
          setError(null);
          // Cache the fetched courses in localStorage
          localStorage.setItem("purchasedCourses", JSON.stringify(coursesWithMetadata));
        }
      } catch (error) {
        logger.error("Error fetching purchased courses", {
          traceId,
          message: error.message,
          status: error.response?.status,
          response: error.response?.data,
        });
        setError("Failed to load purchased courses. Please try again later.");
        // Keep cached courses if available, only clear if no cache
        if (!cachedCourses) {
          setCourses([]);
        }
      } finally {
        if (!cachedCourses) {
          setIsLoading(false); // Only set loading false if no cache was used
        }
      }
    };

    const token = localStorage.getItem("accessToken")?.trim();
    if (!token) {
      logger.warn("No access token found", { traceId: generateUUID() });
      setError("Please log in to view your purchased courses.");
      setIsLoading(false);
      navigate("/login", { state: { error: "Please log in to view purchased courses." } });
      return;
    }

    fetchPurchasedCourses();
  }, [navigate]);

  // Handle click on the Continue Learning button
  const handleCourseClick = (course) => {
    const traceId = generateUUID();
    logger.debug("Continue Learning button clicked", {
      traceId,
      courseId: course.courseId,
      courseTitle: course.title,
    });
    // Map course object to match CourseContent.jsx expectations
    const courseForNavigation = {
      _id: course.courseId.toString(), // Map courseId to _id
      title: course.title || "Untitled Course",
      duration: course.duration || "1 Year",
      newPrice: course.amount !== "Unknown" ? parseFloat(course.amount) : undefined, // Use amount from backend
      purchasedAt: course.purchasedAt,
      endDate: course.endDate,
      completionStatus: course.completionStatus,
      lastAccessed: course.lastAccessed,
    };
    if (typeof onCourseClick === "function") {
      logger.debug("Calling custom onCourseClick function", { traceId });
      onCourseClick(course.courseId.toString(), course);
    } else {
      logger.debug("Navigating to course syllabus page", { traceId });
      handleClose(); // Close the modal and restore scroll before navigation
      closeDropdown(); // Close the UserProfile dropdown
      navigate(`/course/${course.courseId}`, { state: { course: courseForNavigation } });
    }
  };

  return (
    <div className="purchased-courses-modal-overlay" role="dialog" aria-labelledby="purchased-courses-title">
      <div className="purchased-courses-modal-container">
        <button
          className="purchased-courses-close-button"
          onClick={handleClose}
          aria-label="Close purchased courses"
        >
          <span className="material-icons purchased-courses-close-icon">close</span>
        </button>
        <div className="purchased-courses-header">
          <h1 className="purchased-courses-title" id="purchased-courses-title">
            Purchased Courses
          </h1>
        </div>

        {isLoading && (
          <div className="purchased-courses-loading" role="status">
            Loading purchased courses...
          </div>
        )}

        {error && (
          <div className="purchased-courses-error-message" role="alert">
            {error}
          </div>
        )}

        {!isLoading && !error && courses.length === 0 && (
          <div className="purchased-courses-empty-message">
            No purchased courses available.{" "}
            <a
              href="/courses"
              className="explore-link"
              onClick={(e) => {
                e.preventDefault();
                handleClose(); // Close modal and restore scroll
                closeDropdown(); // Close the UserProfile dropdown
                navigate("/courses");
              }}
            >
              Explore courses
            </a>.
          </div>
        )}

        {!isLoading && !error && courses.length > 0 && (
          <div className="purchased-courses-grid">
            {courses.map((course) => {
              const isExpired = isCourseExpired(course.endDate);
              return (
                <div
                  key={course.courseId.toString()}
                  className="purchased-courses-card"
                  aria-label={`Purchased course: ${course.title || "Untitled Course"}`}
                >
                  <p className="purchased-course-title">
                    Course: {course.title || "Untitled Course"}
                  </p>
                  <p className="purchased-course-date">
                    Purchased Date: {formatDate(course.purchasedAt)}
                  </p>
                  <p className="purchased-course-date">
                    Expiry Date: {formatDate(course.endDate)}
                  </p>
                  <p className="purchased-course-date">
                    Duration: {course.duration || "1 Year"} days
                  </p>
                  <button
                    className={`purchased-course-button ${isExpired ? "disabled" : ""}`}
                    onClick={() => !isExpired && handleCourseClick(course)}
                    disabled={isExpired}
                    aria-label={
                      isExpired
                        ? `Course ${course.title || "Untitled Course"} has expired`
                        : `Continue learning ${course.title || "Untitled Course"}`
                    }
                    title={isExpired ? "This course has expired" : undefined}
                  >
                    {isExpired ? "Expired" : "Continue Learning"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

PurchasedCourses.propTypes = {
  onBack: PropTypes.func,
  onCourseClick: PropTypes.func,
  closeDropdown: PropTypes.func,
};

export default PurchasedCourses;