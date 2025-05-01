import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import axios from "axios";
import "./styles/DeleteAccount.css";

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
  const BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  // Validate BASE_URL
  useEffect(() => {
    const traceId = Math.random().toString(36).substring(2);
    if (!BASE_URL && process.env.NODE_ENV !== "production") {
      throw new Error("Backend URL configuration missing");
    }
  }, []);

  const handleDeleteAccount = useCallback(async () => {
    const traceId = Math.random().toString(36).substring(2);
    setState((prev) => ({ ...prev, isDeleting: true, error: "" }));

    try {
      const accessToken = localStorage.getItem("accessToken");
      const sessionToken = localStorage.getItem("sessionToken");
      if (!accessToken || !sessionToken) {
        setState((prev) => ({
          ...prev,
          error: "Authentication required. Please log in.",
          isDeleting: false,
        }));
        setTimeout(() => navigate("/login"), 3000);
        return;
      }

      const response = await axios.delete(
        `${BASE_URL}/api/user/delete-account`,
        {
          withCredentials: true,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            "X-Session-Token": sessionToken,
            "X-Trace-Id": traceId,
          },
        }
      );

      if (response.data.success) {
        localStorage.clear();
        sessionStorage.clear();
        // Clear cookies
        document.cookie =
          "accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; secure; SameSite=Strict";
        document.cookie =
          "sessionToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; secure; SameSite=Strict";
        document.cookie =
          "refreshToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; secure; SameSite=Strict";
        delete axios.defaults.headers.common["Authorization"];
        delete axios.defaults.headers.common["X-Session-Token"];
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
          case 401:
            if (
              data.code === "INVALID_SESSION_TOKEN" ||
              data.code === "UNAUTHORIZED"
            ) {
              try {
                const refreshTraceId = Math.random().toString(36).substring(2);
                const refreshResponse = await axios.post(
                  `${BASE_URL}/api/auth/refresh-token`,
                  {},
                  {
                    withCredentials: true,
                    headers: { "X-Trace-Id": refreshTraceId },
                  }
                );
                if (
                  refreshResponse.data.accessToken &&
                  refreshResponse.data.sessionToken
                ) {
                  localStorage.setItem(
                    "accessToken",
                    refreshResponse.data.accessToken
                  );
                  localStorage.setItem(
                    "sessionToken",
                    refreshResponse.data.sessionToken
                  );
                  setState((prev) => ({
                    ...prev,
                    error: "Session refreshed. Please try again.",
                    isDeleting: false,
                  }));
                  setTimeout(
                    () => setState((prev) => ({ ...prev, error: "" })),
                    3000
                  );
                  return;
                }
              } catch (refreshError) {
                errorMessage = "Session expired. Please log in again.";
                setTimeout(() => navigate("/login"), 3000);
              }
            } else {
              errorMessage = "Unauthorized. Please log in again.";
              setTimeout(() => navigate("/login"), 3000);
            }
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
      setState((prev) => ({ ...prev, error: errorMessage, isDeleting: false }));
    }
  }, [navigate, onLogout, BASE_URL]);

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
          <img
            src="/assets/icons/back.svg"
            alt=""
            className="delete-account-back-icon"
            aria-hidden="true"
          />
        </button>
        <h1 id="delete-account-title" className="delete-account-title">
          Delete Account
        </h1>
      </div>

      <div className="delete-account-content">
        <div className="delete-account-warning-section">
          <h2 className="delete-account-warning-title">
            Before You Delete Your Account
          </h2>
          <ul className="delete-account-warning-list">
            <li>
              <strong>Permanent Deletion:</strong> All course progress,
              certificates, and purchase history will be permanently erased.
            </li>
            <li>
              <strong>Access Loss:</strong> You will immediately lose access to
              all courses and subscription content.
            </li>
            <li>
              <strong>No Refunds:</strong> Active subscriptions will be canceled
              without reimbursement.
            </li>
            <li>
              <strong>Irreversible:</strong> This action cannot be undone.
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
                className="delete-account-cancel-button"
                onClick={() =>
                  setState((prev) => ({ ...prev, showConfirmation: false }))
                }
                disabled={state.isDeleting}
                aria-label="Cancel account deletion"
              >
                Cancel
              </button>

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