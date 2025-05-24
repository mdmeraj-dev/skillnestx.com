import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import axios from "axios";
import "./styles/Certificate.css";

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

// Global traceId generator
const getTraceId = () => {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : generateUUID();
};

// Configure Axios with base URL and interceptor from App.jsx
const BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

// Axios interceptor for token refresh
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
      const traceId = getTraceId();
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
          originalRequest.headers[
            "Authorization"
          ] = `Bearer ${refreshData.accessToken}`;
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

const Certificate = ({ onBack }) => {
  const [certificates, setCertificates] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Format date as DD-MM-YYYY
  const formatDate = (date) => {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Fetch user data and completed courses to generate certificates
  useEffect(() => {
    const fetchCertificates = async () => {
      const traceId = getTraceId();
      const cachedCertificates = localStorage.getItem("certificates"); // Moved outside try
      try {
        // Check localStorage for cached certificates
        if (cachedCertificates) {
          const parsedCertificates = JSON.parse(cachedCertificates);
          logger.debug("Loaded certificates from localStorage", {
            traceId,
            count: parsedCertificates.length,
          });
          setCertificates(parsedCertificates);
          setIsLoading(false); // Set loading to false immediately
        } else {
          setIsLoading(true); // Keep loading true if no cache
        }

        // Fetch user data to get userId and name
        logger.debug("Fetching user data from /api/users/current", { traceId });
        const userResponse = await api.get("/api/users/current", {
          headers: {
            Authorization: `Bearer ${localStorage
              .getItem("accessToken")
              ?.trim()}`,
            "X-Trace-Id": traceId,
          },
        });

        if (!userResponse.data.success || !userResponse.data.user) {
          throw new Error("Failed to fetch user data");
        }

        const userData = userResponse.data.user;
        const userId = userData._id;
        const userName = userData.name || "User";
        logger.debug("Fetched user data", { traceId, userId, userName });

        // Fetch completed courses
        let completedCourses = [];
        try {
          logger.debug(
            `Fetching completed courses from /api/progress/completed/${userId}`,
            { traceId }
          );
          const completedResponse = await api.get(
            `/api/progress/completed/${userId}`,
            {
              headers: {
                Authorization: `Bearer ${localStorage
                  .getItem("accessToken")
                  ?.trim()}`,
                "X-Trace-Id": traceId,
              },
            }
          );

          logger.debug("Completed courses response", {
            traceId,
            status: completedResponse.status,
            data: completedResponse.data,
          });

          if (
            completedResponse.data.success &&
            Array.isArray(completedResponse.data.data)
          ) {
            completedCourses = completedResponse.data.data.map((course) => ({
              courseId: course.courseId,
              title: course.title || "Untitled Course",
              completedAt: course.completedAt
                ? new Date(course.completedAt)
                : new Date(),
            }));
          } else {
            logger.warn("Invalid completed courses response", {
              traceId,
              data: completedResponse.data,
            });
            throw new Error("Invalid completed courses response");
          }
        } catch (completedError) {
          logger.warn("Failed to fetch completed courses", {
            traceId,
            userId,
            error: completedError.message,
            status: completedError.response?.status,
            host: window.location.host,
            response: completedError.response?.data,
          });
          if (completedError.response?.status === 404) {
            setError(
              "No progress recorded. Complete lessons to earn certificates."
            );
          } else {
            throw new Error(
              `Failed to fetch completed courses: ${completedError.message}`
            );
          }
          setCertificates([]);
          localStorage.setItem("certificates", JSON.stringify([])); // Cache empty array
          return;
        }

        logger.debug("Fetched completed courses", {
          traceId,
          count: completedCourses.length,
        });

        if (!completedCourses.length) {
          logger.warn("No completed courses found", { traceId });
          setCertificates([]);
          setError(
            "No courses completed. Complete a course to earn certificates."
          );
          localStorage.setItem("certificates", JSON.stringify([])); // Cache empty array
          return;
        }

        // Generate certificates for each completed course
        const certificatePromises = completedCourses.map(async (course) => {
          try {
            logger.debug(
              `Generating certificate for course ${course.courseId}`,
              { traceId }
            );
            const certResponse = await api.post(
              "/api/certificates/generate",
              {
                courseId: course.courseId,
                userId: userId,
                userName: userName,
                courseTitle: course.title,
                completedAt: course.completedAt.toISOString(),
              },
              {
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${localStorage
                    .getItem("accessToken")
                    ?.trim()}`,
                  "X-Trace-Id": traceId,
                },
              }
            );

            logger.debug("Certificate generation response", {
              traceId,
              courseId: course.courseId,
              data: certResponse.data,
            });

            if (
              !certResponse.data.success ||
              !certResponse.data.data?.certificateUrl
            ) {
              throw new Error("Failed to generate certificate");
            }

            const certificateUrl = certResponse.data.data.certificateUrl;
            return {
              id: course.courseId,
              courseTitle: course.title,
              completedAt: course.completedAt,
              thumbnail: `${BASE_URL}${
                certificateUrl.startsWith("/")
                  ? certificateUrl
                  : `/${certificateUrl}`
              }`,
              downloadUrl: `${BASE_URL}${
                certificateUrl.startsWith("/")
                  ? certificateUrl
                  : `/${certificateUrl}`
              }`,
            };
          } catch (certError) {
            logger.error("Failed to generate certificate for course", {
              traceId,
              courseId: course.courseId,
              error: certError.message,
              response: certError.response?.data,
            });
            return null;
          }
        });

        const certificates = (await Promise.all(certificatePromises)).filter(
          (cert) => cert !== null
        );
        logger.debug("Generated certificates", {
          traceId,
          count: certificates.length,
        });

        if (!certificates.length) {
          logger.warn("No valid certificates generated", { traceId });
          setError("No certificates available. Try again later.");
          localStorage.setItem("certificates", JSON.stringify([])); // Cache empty array
          return;
        }

        setCertificates(certificates);
        setError(null);
        // Cache the generated certificates in localStorage
        localStorage.setItem("certificates", JSON.stringify(certificates));
      } catch (err) {
        logger.error("Fetch certificates error", {
          traceId,
          status: err.response?.status,
          data: err.response?.data,
          message: err.message,
        });
        setError("Failed to load certificates. Please try again later.");
        // Keep cached certificates if available, only clear if no cache
        if (!cachedCertificates) {
          setCertificates([]);
        }
      } finally {
        if (!cachedCertificates) {
          setIsLoading(false); // Only set loading false if no cache was used
        }
      }
    };

    const token = localStorage.getItem("accessToken")?.trim();
    if (!token) {
      setError("Please log in to view your certificates.");
      setIsLoading(false);
      window.dispatchEvent(
        new CustomEvent("navigate", {
          detail: {
            path: "/login",
            state: { error: "Please log in to view certificates." },
            replace: true,
          },
        })
      );
      return;
    }

    fetchCertificates();

    // Prevent background scrolling
    document.body.classList.add("login-modal-open");
    return () => {
      document.body.classList.remove("login-modal-open");
    };
  }, []);

  const handleDownload = (downloadUrl, courseTitle) => {
    const traceId = getTraceId();
    logger.debug("Downloading certificate", {
      traceId,
      courseTitle,
      downloadUrl,
    });
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `${courseTitle.replace(/\s+/g, "_")}_Certificate.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="cert-modal-overlay"
      role="dialog"
      aria-labelledby="cert-title"
    >
      <div className="cert-modal-container">
        <button
          className="cert-close-button"
          onClick={onBack}
          aria-label="Close certificates"
        >
          <span className="material-icons cert-close-icon">close</span>
        </button>

        <div className="cert-header">
          <h2 id="cert-title" className="cert-title">
            Certificates
          </h2>
        </div>

        {isLoading && (
          <div className="cert-loading" role="status">
            Loading certificates...
          </div>
        )}

        {error && (
          <div className="cert-error-message" role="alert">
            {error}
          </div>
        )}

        {!isLoading && !error && certificates.length === 0 && (
          <div className="cert-empty-message">
            No certificates available. Complete a course to earn one!
          </div>
        )}

        {!isLoading && !error && certificates.length > 0 && (
          <div className="cert-list">
            {certificates.map((certificate) => (
              <div
                key={certificate.id}
                className="cert-item"
                aria-label={`Certificate for ${certificate.courseTitle}`}
              >
                <div className="cert-details">
                  <p className="cert-name">
                    Course: {certificate.courseTitle}
                  </p>
                  <p className="cert-date">
                    Completion: {formatDate(certificate.completedAt)}
                  </p>
                  <button
                    className="cert-download-button"
                    onClick={() =>
                      handleDownload(
                        certificate.downloadUrl,
                        certificate.courseTitle
                      )
                    }
                    aria-label={`Download ${certificate.courseTitle} Certificate`}
                  >
                    <span className="material-icons cert-download-icon">download</span>
                    Download
                  </button>
                </div>
                <div className="certificate-preview">
                  <img
                    src={certificate.thumbnail}
                    alt={certificate.courseTitle}
                    className="cert-thumbnail"
                    onError={() =>
                      logger.error("Failed to load certificate thumbnail", {
                        traceId: getTraceId(),
                        url: certificate.thumbnail,
                      })
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

Certificate.propTypes = {
  onBack: PropTypes.func.isRequired,
};

export default Certificate;