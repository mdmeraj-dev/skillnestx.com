import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import axios from "axios";
import "./styles/DeleteAccount.css";

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

const DeleteAccount = ({
  onBack = () => navigate(-1),
  onLogout = () => {},
}) => {
  const [state, setState] = useState({
    isDeleting: false,
    showConfirmation: false,
    showSuccess: false,
    error: "",
  });
  const navigate = useNavigate();

  // Validate BASE_URL
  useEffect(() => {
    const traceId = crypto.randomUUID();
    if (!BASE_URL && process.env.NODE_ENV !== "production") {
      logger.error("VITE_BACKEND_URL is not defined in environment variables", { traceId });
      throw new Error("Backend URL configuration missing");
    }
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    delete api.defaults.headers.common["Authorization"];
  };

  const handleDeleteAccount = useCallback(async () => {
    const traceId = crypto.randomUUID();
    setState((prev) => ({ ...prev, isDeleting: true, error: "" }));

    try {
      logger.debug("Deleting account", { traceId });
      const accessToken = localStorage.getItem("accessToken");
      const response = await api.delete(
        "/api/users/delete-account",
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            "X-Trace-Id": traceId,
          },
        }
      );

      if (response.data.success) {
        handleLogout();
        onLogout();
        setState((prev) => ({
          ...prev,
          showSuccess: true,
          showConfirmation: false,
          isDeleting: false,
        }));
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        throw new Error(response.data.message || "Failed to delete account");
      }
    } catch (err) {
      logger.error("Delete account error", {
        status: err.response?.status,
        data: err.response?.data,
        traceId: err.response?.data?.traceId || traceId,
      });
      let errorMessage = "Failed to delete account. Please try again.";
      if (err.response) {
        const { status, data } = err.response;
        if (status === 401) {
          logger.debug("Received 401, relying on interceptor for refresh", { traceId });
          // Interceptor handles refresh and retry or navigation
        } else if (status === 400 && data.code === "INVALID_REQUEST") {
          errorMessage = data.message || "Invalid request.";
        } else if (status === 429 || data.code === "RATE_LIMIT_EXCEEDED") {
          errorMessage = "Too many deletion attempts. Please try again later.";
        } else if (status === 404 && data.code === "USER_NOT_FOUND") {
          errorMessage = "Account not found. Please contact support.";
        } else {
          errorMessage = data.message || errorMessage;
        }
      } else {
        errorMessage = "Network error. Please check your connection.";
      }
      setState((prev) => ({ ...prev, error: errorMessage, isDeleting: false }));
    }
  }, [navigate, onLogout]);

  const handleBack = useCallback(() => {
    onBack();
  }, [onBack]);

  return (
    <div
      className="delete-account-container"
      role="dialog"
      aria-labelledby="delete-account-title"
    >
      <div className="delete-account-header">
        <button
          className="delete-account-back-button"
          onClick={handleBack}
          aria-label="Go back"
          disabled={state.isDeleting}
        >
          <span className="material-icons delete-account-back-icon" aria-hidden="true">arrow_back</span>
        </button>
        <h1 id="delete-account-title" className="delete-account-title">
          Delete Account
        </h1>
      </div>

      <div className="delete-account-content">
        <div className="delete-account-warning-section">
          <h2 className="delete-account-warning-title">
            Read carefully:
          </h2>
          <ul className="delete-account-warning-list">
            <li>
              All your course progress,
              certificates, and purchase history will be erased permanently .
            </li>
            <li>
             You will immediately lose access to
              all your courses and subscription.
            </li>
           
            <li>
             This action cannot be undone.
            </li>
          </ul>
        </div>

        <button
          className="delete-account-button delete-account-destructive"
          onClick={() =>
            setState((prev) => ({ ...prev, showConfirmation: true }))
          }
          disabled={state.isDeleting}
          aria-label="Initiate account deletion"
        >
          Delete My Account
        </button>

        {state.error && (
          <div className="delete-account-error-message" role="alert">
            {state.error}
          </div>
        )}
      </div>

      {state.showConfirmation && (
        <div
          className="delete-account-modal-overlay"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="delete-account-confirmation-modal"
            aria-labelledby="delete-confirmation-heading"
            tabIndex="-1"
            ref={(node) => node?.focus()}
          >
            <h2
              id="delete-confirmation-heading"
              className="delete-account-confirmation-title"
            >
              Confirm Account Deletion
            </h2>
            <p className="delete-account-confirmation-text">
              This will permanently delete your account and all associated data.
              Are you sure?
            </p>

            <div className="delete-account-confirmation-buttons">
              <button
                className="delete-account-confirm-button delete-account-destructive"
                onClick={handleDeleteAccount}
                disabled={state.isDeleting}
                aria-label="Confirm account deletion"
                aria-busy={state.isDeleting}
              >
                {state.isDeleting ? (
                  <div className="delete-account-spinner-container">
                    <div
                      className="delete-account-spinner"
                      role="status"
                      aria-hidden="true"
                    ></div>
                    <span className="delete-account-button-loading">
                      Deleting...
                    </span>
                  </div>
                ) : (
                  "Confirm"
                )}
              </button>

               <button
                className="delete-account-cancel-button"
                onClick={() =>
                  setState((prev) => ({ ...prev, showConfirmation: false }))
                }
                disabled={state.isDeleting}
                aria-label="Cancel account deletion"
              >
                Cancel
              </button>

            </div>
          </div>
        </div>
      )}

      {state.showSuccess && (
        <div
          className="delete-account-modal-overlay"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="delete-account-success-modal"
            aria-labelledby="success-heading"
            tabIndex="-1"
            ref={(node) => node?.focus()}
          >
            <h2 id="success-heading" className="delete-account-success-title">
              Account Deleted
            </h2>
            <p className="delete-account-success-text">
              Your account has been deleted successfully.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

DeleteAccount.propTypes = {
  onBack: PropTypes.func,
  onLogout: PropTypes.func,
};

export default DeleteAccount;