import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import axios from "axios";
import "../styles/AdminDeleteAccount.css";

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

const AdminDeleteAccount = ({
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
      throw new Error("Backend URL configuration missing");
    }
  }, []);

  // Prevent body scrolling when modal is open
  useEffect(() => {
    document.body.classList.add("admin-delete-account-modal-open");
    return () => {
      document.body.classList.remove("admin-delete-account-modal-open");
    };
  }, []);

  const handleDeleteAccount = useCallback(async () => {
    const traceId = crypto.randomUUID();
    setState((prev) => ({ ...prev, isDeleting: true, error: "" }));

    try {
      const accessToken = localStorage.getItem("accessToken");
      const refreshToken = localStorage.getItem("refreshToken");
      const response = await api.delete("/api/users/delete-account", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "x-refresh-token": refreshToken,
          "X-Trace-Id": traceId,
        },
      });

      if (response.data.success) {
        localStorage.clear();
        document.cookie =
          "accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; secure; SameSite=Strict";
        document.cookie =
          "refreshToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; secure; SameSite=Strict";
        delete api.defaults.headers.common["Authorization"];
        delete api.defaults.headers.common["x-refresh-token"];
        onLogout();
        setState((prev) => ({
          ...prev,
          showSuccess: true,
          showConfirmation: false,
          isDeleting: false,
        }));
        setTimeout(() => {
          navigate("/", { replace: true });
        }, 1500);
      }
    } catch (err) {
      let errorMessage = "Failed to delete account. Please try again.";
      if (err.response) {
        const { status, data } = err.response;
        switch (status) {
          case 400:
            errorMessage = data.message || "Invalid request.";
            break;
          case 429:
            errorMessage =
              "Too many deletion attempts. Please try again later.";
            break;
          case 404:
            errorMessage = "Service unavailable. Please contact support.";
            break;
          default:
            errorMessage = data.message || errorMessage;
        }
      } else {
        errorMessage = "Network error. Please check your connection.";
      }
      logger.error("Delete account error", {
        status: err.response?.status,
        data: err.response?.data,
        traceId: err.response?.data?.traceId || traceId,
      });
      setState((prev) => ({ ...prev, error: errorMessage, isDeleting: false }));
    }
  }, [navigate, onLogout]);

  const handleBack = useCallback(() => {
    onBack();
  }, [onBack]);

  return (
    <div
      className="admin-delete-account-container"
      role="dialog"
      aria-labelledby="admin-delete-account-title"
      aria-label="Delete account modal"
    >
      <div className="admin-delete-account-header">
        <button
          className="admin-delete-account-back-button"
          onClick={handleBack}
          aria-label="Go back"
          disabled={state.isDeleting}
        >
          <img
            src="/assets/icons/back-white.svg"
            alt=""
            className="admin-delete-account-back-icon"
            aria-hidden="true"
          />
        </button>
        <h1 id="admin-delete-account-title" className="admin-delete-account-title">
          Delete Account
        </h1>
      </div>

      <div className="admin-delete-account-content">
        <div className="admin-delete-account-warning-section">
          <h2 className="admin-delete-account-warning-title">
            Read carefully:
          </h2>
          <ul className="admin-delete-account-warning-list">
            <li>
              You will immediately lose access to your account
            </li>
            <li>
              This action cannot be undone.
            </li>
          </ul>
        </div>

        <button
          className="admin-delete-account-button admin-delete-account-destructive"
          onClick={() =>
            setState((prev) => ({ ...prev, showConfirmation: true }))
          }
          disabled={state.isDeleting}
          aria-label="Initiate account deletion"
        >
          Delete My Account
        </button>

        {state.error && (
          <div className="admin-delete-account-error-message" role="alert">
            {state.error}
          </div>
        )}
      </div>

      {state.showConfirmation && (
        <div
          className="admin-delete-account-modal-overlay"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="admin-delete-account-confirmation-modal"
            aria-labelledby="admin-delete-confirmation-heading"
            tabIndex="-1"
            ref={(node) => node?.focus()}
          >
            <h2
              id="admin-delete-confirmation-heading"
              className="admin-delete-account-confirmation-title"
            >
              Confirm Account Deletion
            </h2>
            <p className="admin-delete-account-confirmation-text">
              This will permanently delete your account and all associated data.
              Are you sure?
            </p>

            <div className="admin-delete-account-confirmation-buttons">
              <button
                className="admin-delete-account-cancel-button"
                onClick={() =>
                  setState((prev) => ({ ...prev, showConfirmation: false }))
                }
                disabled={state.isDeleting}
                aria-label="Cancel account deletion"
              >
                Cancel
              </button>

              <button
                className="admin-delete-account-confirm-button admin-delete-account-destructive"
                onClick={handleDeleteAccount}
                disabled={state.isDeleting}
                aria-label="Confirm account deletion"
                aria-busy={state.isDeleting}
              >
                {state.isDeleting ? (
                  <div className="admin-delete-account-spinner-container">
                    <div
                      className="admin-delete-account-spinner"
                      role="status"
                      aria-hidden="true"
                    ></div>
                    <span className="admin-delete-account-button-loading">
                      Deleting...
                    </span>
                  </div>
                ) : (
                  "Confirm"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {state.showSuccess && (
        <div
          className="admin-delete-account-modal-overlay"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="admin-delete-account-success-modal"
            aria-labelledby="admin-success-heading"
            tabIndex="-1"
            ref={(node) => node?.focus()}
          >
            <h2 id="admin-success-heading" className="admin-delete-account-success-title">
              Account Deleted
            </h2>
            <p className="admin-delete-account-success-text">
              Your account has been deleted successfully.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

AdminDeleteAccount.propTypes = {
  onBack: PropTypes.func,
  onLogout: PropTypes.func,
};

export default AdminDeleteAccount;