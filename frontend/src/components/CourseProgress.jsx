import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import axios from "axios";
import "../styles/CourseProgress.css";
import LikeIcon from "/assets/icons/like.svg";
import DislikeIcon from "/assets/icons/dislike.svg";
import DownloadIcon from "/assets/icons/download.svg";

const BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

// Logger aligned with Certificate.jsx
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
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Configure Axios instance
const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const accessToken = localStorage.getItem("accessToken")?.trim();
    const traceId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : generateUUID();
    config.headers["X-Trace-Id"] = traceId;
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      originalRequest.url !== '/api/auth/refresh-token' &&
      originalRequest.url !== '/api/auth/logout'
    ) {
      originalRequest._retry = true;
      const traceId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : generateUUID();
      const isLoggingOut = localStorage.getItem('isLoggingOut') === 'true';
      if (isLoggingOut) {
        logger.debug('Skipping token refresh during logout', { traceId });
        return Promise.reject(error);
      }
      try {
        const refreshToken = localStorage.getItem("refreshToken")?.trim();
        if (!refreshToken) {
          logger.warn("No refresh token available", { traceId });
          throw new Error("No refresh token available");
        }
        const response = await api.post(
          '/api/auth/refresh-token',
          { refreshToken },
          {
            headers: {
              'X-Trace-Id': traceId,
              'Content-Type': 'application/json',
            },
          }
        );
        const { accessToken, refreshToken: newRefreshToken } = response.data;
        if (response.status === 200 && response.data.success) {
          localStorage.setItem("accessToken", accessToken);
          localStorage.setItem("refreshToken", newRefreshToken);
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
        throw new Error('Refresh failed');
      } catch (refreshError) {
        logger.error('Token refresh error', {
          error: refreshError.message,
          traceId,
          response: refreshError.response?.data,
        });
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        window.location.href = '/login?error=Your authentication has expired. Please log in again.';
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

const UserProgress = ({
  syllabus = [],
  userName = "User name",
  courseTitle = "Course title",
  progressColor = "#4CAF50",
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState({ liked: null });
  const [error, setError] = useState(null);

  // Load rating and feedback from localStorage on mount
  useEffect(() => {
    try {
      const savedRating = localStorage.getItem(`rating_${courseTitle}`);
      const savedFeedback = localStorage.getItem(`feedback_${courseTitle}`);
      if (savedRating) {
        setRating(parseInt(savedRating, 10));
      }
      if (savedFeedback) {
        setFeedback(JSON.parse(savedFeedback));
      }
    } catch (error) {
      logger.error("Error loading rating/feedback from localStorage", {
        error: error.message,
        traceId: generateUUID(),
      });
    }
  }, [courseTitle]);

  // Save rating to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem(`rating_${courseTitle}`, rating.toString());
    } catch (error) {
      logger.error("Error saving rating to localStorage", {
        error: error.message,
        traceId: generateUUID(),
      });
    }
  }, [rating, courseTitle]);

  // Save feedback to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem(`feedback_${courseTitle}`, JSON.stringify(feedback));
    } catch (error) {
      logger.error("Error saving feedback to localStorage", {
        error: error.message,
        traceId: generateUUID(),
      });
    }
  }, [feedback, courseTitle]);

  // Validate props
  useEffect(() => {
    if (userName === "User name" || courseTitle === "Course title") {
      logger.warn("UserProgress received default props", { userName, courseTitle });
      setError("Invalid user or course details. Please ensure course is properly selected.");
    } else {
      setError(null);
    }
  }, [userName, courseTitle]);

  // Calculate progress
  const totalLessons = syllabus.reduce(
    (total, section) => total + section.lessons.length,
    0
  );
  const completedLessons = syllabus.reduce(
    (total, section) =>
      total + section.lessons.filter((lesson) => lesson.isCompleted).length,
    0
  );
  const progressPercentage = totalLessons
    ? Math.round((completedLessons / totalLessons) * 100)
    : 0;

  // Check if the course is completed
  const isCourseCompleted = completedLessons === totalLessons && totalLessons > 0;

  // Function to handle certificate download
  const handleDownloadCertificate = async () => {
    if (userName === "User name" || courseTitle === "Course title") {
      logger.error("Invalid user or course details", { userName, courseTitle });
      setError("Invalid user or course details. Please try again.");
      return;
    }

    const traceId = generateUUID();
    logger.debug("Initiating certificate download", { traceId, userName, courseTitle });

    setIsDownloading(true);
    try {
      // Format the completion date as DD-MM-YYYY
      const completedAt = new Date();
      const formattedDate = `${String(completedAt.getDate()).padStart(2, "0")}-${String(completedAt.getMonth() + 1).padStart(2, "0")}-${completedAt.getFullYear()}`;

      const response = await api.post(
        '/api/certificates/generate',
        {
          userName,
          courseTitle,
          completedAt: formattedDate,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Trace-Id': traceId,
          },
        }
      );

      logger.debug("Certificate response", {
        traceId,
        status: response.status,
        data: response.data,
      });

      if (!response.data.success || !response.data.data?.certificateUrl) {
        throw new Error("Failed to generate certificate");
      }

      const certificateUrl = response.data.data.certificateUrl;
      const fullCertificateUrl = `${BASE_URL}${
        certificateUrl.startsWith("/") ? certificateUrl : `/${certificateUrl}`
      }`;

      logger.debug("Downloading certificate from", { traceId, fullCertificateUrl });

      const link = document.createElement("a");
      link.href = fullCertificateUrl;
      link.download = `${userName.replace(/\s+/g, '_')}_certificate.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setError(null);
    } catch (error) {
      logger.error("Error downloading certificate", {
        traceId,
        message: error.message,
        response: error.response?.data,
      });
      setError("Failed to generate certificate. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  // Function to handle rating
  const handleRating = (selectedRating) => {
    setRating(selectedRating);
  };

  // Function to handle like/dislike feedback
  const handleFeedback = (isLiked) => {
    if (feedback.liked === isLiked) {
      setFeedback({ liked: null });
    } else {
      setFeedback({ liked: isLiked });
    }
  };

  return (
    <div className="course-progress-container">
      <h2 className="progress-title">Course Progress</h2>

      {/* Progress Bar */}
      <div className="progress-bar">
        <div
          className="progress-bar-fill"
          style={{
            width: `${progressPercentage}%`,
            backgroundColor: progressColor,
            transition: "width 0.5s ease, background-color 0.5s ease",
          }}
        ></div>
      </div>

      {/* Progress Percentage */}
      <p className="progress-percentage">
        {progressPercentage}% Completed ({completedLessons}/{totalLessons}{" "}
        Lessons)
      </p>

      {/* Error Message */}
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}

      {/* Certificate Section */}
      {isCourseCompleted && (
        <div className="certificate-section">
          <h3 className="certificate-title">🎉 Course Completed! 🎉</h3>
          <p className="certificate-message">
            Congratulations! You have successfully completed the course.
            Download your certificate below.
          </p>

          {/* Download Certificate Button with Icon */}
          <button
            className="download-certificate-button"
            onClick={handleDownloadCertificate}
            disabled={isDownloading || userName === "User name" || courseTitle === "Course title"}
          >
            <div className="download-button-content">
              <img
                src={DownloadIcon}
                alt="Download"
                className="download-icon"
              />
              <span>{isDownloading ? "Generating..." : "Download Certificate"}</span>
            </div>
          </button>

          {/* Rate This Course Section */}
          <div className="rate-course-section">
            <h3 className="rate-course-title">
              Your Feedback Impacts Millions of Learners
            </h3>
            <p className="rate-course-subtitle">
              Please share your experience to help others choose the right
              course
            </p>

            {/* Like/Dislike Feedback Section */}
            <div className="feedback-section">
              <h4 className="feedback-title">Was this course helpful?</h4>
              <div className="feedback-buttons">
                <button
                  className={`feedback-button like-button ${
                    feedback.liked === true ? "active" : ""
                  }`}
                  onClick={() => handleFeedback(true)}
                  aria-label={
                    feedback.liked === true ? "Remove like" : "Like this course"
                  }
                >
                  <img src={LikeIcon} alt="Like" />
                  <span>{feedback.liked === true ? "Liked" : "Like"}</span>
                </button>
                <button
                  className={`feedback-button dislike-button ${
                    feedback.liked === false ? "active" : ""
                  }`}
                  onClick={() => handleFeedback(false)}
                  aria-label={
                    feedback.liked === false
                      ? "Remove dislike"
                      : "Dislike this course"
                  }
                >
                  <img src={DislikeIcon} alt="Dislike" />
                  <span>
                    {feedback.liked === false ? "Disliked" : "Dislike"}
                  </span>
                </button>
              </div>
              {feedback.liked !== null && (
                <p className="feedback-thank-you">
                  Thank you for your feedback!
                </p>
              )}
            </div>

            {/* Star Rating Section */}
            <h3 className="rate-course-star-title">Please rate this course</h3>
            <div className="star-rating">
              {[...Array(5)].map((star, index) => {
                index += 1;
                return (
                  <button
                    type="button"
                    key={index}
                    className={index <= (hoverRating || rating) ? "on" : "off"}
                    onClick={() => handleRating(index)}
                    onMouseEnter={() => setHoverRating(index)}
                    onMouseLeave={() => setHoverRating(rating)}
                  >
                    <span className="star">★</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

UserProgress.propTypes = {
  syllabus: PropTypes.arrayOf(
    PropTypes.shape({
      title: PropTypes.string.isRequired,
      lessons: PropTypes.arrayOf(
        PropTypes.shape({
          _id: PropTypes.string.isRequired,
          title: PropTypes.string.isRequired,
          isCompleted: PropTypes.bool.isRequired,
        })
      ).isRequired,
    })
  ).isRequired,
  userName: PropTypes.string,
  courseTitle: PropTypes.string,
  progressColor: PropTypes.string,
};

export default UserProgress;