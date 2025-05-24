import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import axios from "axios";
import "./styles/Logout.css";

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

// Configure Axios with base URL and interceptor from App.jsx
const BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
const api = axios.create({
  baseURL: BASE_URL,
});

// Axios interceptor for token refresh (same as App.jsx)
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
          originalRequest.headers["Authorization"] = `Bearer ${refreshData.accessToken}`;
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

const Logout = ({ onLogout, onBack }) => {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("profilePicture");
  };

  const handleLogoutConfirm = async () => {
    const traceId = crypto.randomUUID();
    try {
      setIsLoggingOut(true);
      setError(null);

      const accessToken = localStorage.getItem("accessToken");
      const refreshToken = localStorage.getItem("refreshToken");

      try {
        if (accessToken) {
          await api.post(
            "/api/auth/logout",
            { refreshToken },
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
                "X-Trace-Id": traceId,
              },
            }
          );
          logger.debug("Backend logout successful", { traceId });
        } else {
          logger.warn("No access token found for logout", { traceId });
        }
      } catch (backendErr) {
        logger.warn("Backend logout failed, proceeding with client-side cleanup", {
          error: backendErr.message,
          traceId,
        });
        // Proceed with client-side cleanup if backend logout fails
      }

      handleLogout();
      if (typeof onLogout === "function") {
        onLogout();
      }
      navigate("/", { replace: true });
    } catch (err) {
      logger.error("Logout error", {
        error: err.response?.data?.message || err.message,
        traceId,
      });
      let errorMessage = "Failed to log out. Please try again.";
      if (err.response) {
        const { status, data } = err.response;
        if (status === 400 && data.code === "INVALID_TOKEN") {
          errorMessage = "Invalid session. Please log in again.";
        } else if (status === 429 || data.code === "RATE_LIMIT_EXCEEDED") {
          errorMessage = "Too many logout attempts. Please try again later.";
        } else {
          errorMessage = data.message || errorMessage;
        }
      }
      setError(errorMessage);
      handleLogout();
      navigate("/", { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleBack = () => {
    if (typeof onBack === "function") {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="logout-container">
      <div className="logout-header">
        <button
          className="logout-back-button"
          onClick={handleBack}
          aria-label="Go back"
          disabled={isLoggingOut}
        >
          <span className="material-icons logout-back-icon">arrow_back</span>
        </button>
        <h2 className="logout-title">Log Out</h2>
      </div>

      <div className="logout-content">
        <p className="logout-message">
          Are you sure you want to log out?
        </p>

        {error && <div className="profile-logout-error">{error}</div>}

        <div className="logout-actions">
          <button
            className="logout-confirm-button"
            onClick={handleLogoutConfirm}
            disabled={isLoggingOut}
            aria-busy={isLoggingOut}
          >
            {isLoggingOut ? (
              <>
                <div className="logout-spinner" role="status" aria-hidden="true"></div>
                <span>Logging Out...</span>
              </>
            ) : (
              <>
                <span className="material-icons logout-icon" aria-hidden="true">logout</span>
                Log Out
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

Logout.propTypes = {
  onLogout: PropTypes.func,
  onBack: PropTypes.func,
};

export default Logout;