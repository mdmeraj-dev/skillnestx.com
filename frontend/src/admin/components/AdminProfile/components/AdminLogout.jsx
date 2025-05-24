import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import axios from "axios";
import "../styles/AdminLogout.css";
import backIcon from "/assets/icons/back-white.svg";
import logoutIcon from "/assets/icons/logout-white.svg";

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
      const traceId = crypto.randomUUID();
      const isLoggingOut = localStorage.getItem("isLoggingOut") === "true";
      if (isLoggingOut) {
        logger.debug("Skipping token refresh during logout", { traceId });
        return Promise.reject(error);
      }
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
        if (!isLoggingOut) {
          window.dispatchEvent(
            new CustomEvent("navigate", {
              detail: {
                path: "/login",
                state: { error: "Your session has expired. Please log in again." },
                replace: true,
              },
            })
          );
        } else {
          logger.debug("Suppressing login redirect during logout", { traceId });
        }
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

const AdminLogout = ({ onLogout, onBack }) => {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Prevent body scrolling when modal is open
  useEffect(() => {
    document.body.classList.add("admin-logout-modal-open");
    return () => {
      document.body.classList.remove("admin-logout-modal-open");
    };
  }, []);

  const handleLogout = async () => {
    const traceId = crypto.randomUUID();
    try {
      setIsLoggingOut(true);
      setError(null);
      localStorage.setItem("isLoggingOut", "true");
      logger.debug("Starting logout process", { traceId });

      const accessToken = localStorage.getItem("accessToken");
      const refreshToken = localStorage.getItem("refreshToken");

      try {
        await api.post(
          "/api/auth/logout",
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
        logger.debug("Backend logout successful", { traceId });
      } catch (backendErr) {
        logger.error("Backend logout error", {
          status: backendErr.response?.status,
          data: backendErr.response?.data,
          traceId: backendErr.response?.data?.traceId || traceId,
        });
        // Proceed with client-side cleanup if backend logout fails
      }

      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("profilePicture");
      localStorage.removeItem("isLoggingOut");

      if (typeof onLogout === "function") {
        onLogout();
      }

      logger.debug("Navigating to homepage", { traceId });
      navigate("/", { replace: true });
    } catch (err) {
      logger.error("Logout error", {
        status: err.response?.status,
        data: err.response?.data,
        traceId: err.response?.data?.traceId || traceId,
      });
      setError(err.response?.data?.message || "Failed to log out. Please try again.");
      localStorage.removeItem("isLoggingOut");
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
    <div
      className="admin-logout-container"
      role="dialog"
      aria-modal="true"
      aria-label="Log out modal"
    >
      <div className="admin-logout-header">
        <button
          className="admin-logout-back-button"
          onClick={handleBack}
          aria-label="Go back"
          disabled={isLoggingOut}
        >
          <img src={backIcon} alt="Back" className="admin-logout-back-icon" />
        </button>
        <h2 className="admin-logout-title">Log Out</h2>
      </div>

      <div className="admin-logout-content">
        <p className="admin-logout-message">
          Are you sure you want to log out?
        </p>

        {error && <div className="admin-logout-error">{error}</div>}

        <div className="admin-logout-actions">
          <button
            className="admin-logout-confirm-button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            aria-busy={isLoggingOut}
          >
            {isLoggingOut ? (
              <>
                <div className="admin-logout-spinner" role="status" aria-hidden="true"></div>
                <span>Logging Out...</span>
              </>
            ) : (
              <>
                <img
                  src={logoutIcon}
                  alt=""
                  className="admin-logout-icon"
                  aria-hidden="true"
                />
                Log Out
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

AdminLogout.propTypes = {
  onLogout: PropTypes.func,
  onBack: PropTypes.func,
};

export default AdminLogout;