import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import axios from "axios";
import "../styles/AdminAccountSettings.css";

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

const AdminAccountSettings = ({ onBack, onAuthUpdate = () => {} }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [originalEmail, setOriginalEmail] = useState("");
  const [originalMobile, setOriginalMobile] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [mobileError, setMobileError] = useState("");
  const [globalError, setGlobalError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const navigate = useNavigate();

  // Validate BASE_URL
  useEffect(() => {
    if (!BASE_URL && process.env.NODE_ENV !== "production") {
      logger.error("VITE_BACKEND_URL is not defined in environment variables", {});
      throw new Error("Backend URL configuration missing");
    }
  }, []);

  useEffect(() => {
    document.body.classList.add("admin-account-settings-modal-open");
    return () => {
      document.body.classList.remove("admin-account-settings-modal-open");
    };
  }, []);

  useEffect(() => {
    const fetchUserData = async () => {
      const traceId = crypto.randomUUID();
      try {
        const accessToken = localStorage.getItem("accessToken");
        const refreshToken = localStorage.getItem("refreshToken");
        const config = {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            "x-refresh-token": refreshToken,
            "X-Trace-Id": traceId,
          },
        };

        const response = await api.get("/api/users/current", config);
        if (response.data.success && response.data.user) {
          const { name, email, mobileNumber } = response.data.user;
          setName(name || "");
          setEmail(email || "");
          setMobile(mobileNumber || "");
          setOriginalName(name || "");
          setOriginalEmail(email || "");
          setOriginalMobile(mobileNumber || "");
          localStorage.setItem("userName", name || "");
          localStorage.setItem("userEmail", email || "");
          localStorage.setItem("userMobile", mobileNumber || "");
        } else {
          logger.error("Failed to load profile", { data: response.data, traceId });
          setGlobalError("Failed to load profile. Please try again.");
        }
      } catch (error) {
        logger.error("Fetch user error", {
          status: error.response?.status,
          data: error.response?.data,
          traceId: error.response?.data?.traceId || traceId,
        });
        setGlobalError("Failed to load profile. Please try again.");
      }
    };
    fetchUserData();
  }, [navigate]);

  const validateName = () => {
    if (!name.trim()) return "Please enter your name";
    if (name.length > 50) return "Name cannot exceed 50 characters";
    return "";
  };

  const validateEmail = () => {
    if (!email.trim()) return "";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return "Please enter a valid email address";
    return "";
  };

  const validateMobile = () => {
    const mobileRegex = /^\+?[1-9]\d{6,14}$/;
    if (mobile.trim() && !mobileRegex.test(mobile))
      return "Please enter a valid mobile number (7-15 digits)";
    return "";
  };

  const handleCancel = () => {
    setName(originalName);
    setEmail(originalEmail);
    setMobile(originalMobile);
    setNameError("");
    setEmailError("");
    setMobileError("");
    setGlobalError("");
    setSuccessMessage("");
    setShowErrors(false);
    setIsEditing(false);
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    setShowErrors(true);
    setGlobalError("");
    setSuccessMessage("");

    const nameValidation = validateName();
    const emailValidation = validateEmail();
    const mobileValidation = validateMobile();

    setNameError(nameValidation);
    setEmailError(emailValidation);
    setMobileError(mobileValidation);

    if (nameValidation || emailValidation || mobileValidation) {
      return;
    }

    const payload = {};
    if (name.trim() !== originalName) payload.name = name.trim();
    if (email.trim().toLowerCase() !== originalEmail.toLowerCase() && email.trim())
      payload.email = email.trim().toLowerCase();
    if (mobile.trim() !== originalMobile) payload.mobileNumber = mobile.trim() || undefined;

    if (Object.keys(payload).length === 0) {
      setSuccessMessage("No changes to save.");
      setTimeout(() => {
        setSuccessMessage("");
        setIsEditing(false);
      }, 2000);
      return;
    }

    setIsUpdating(true);

    const traceId = crypto.randomUUID();
    try {
      const accessToken = localStorage.getItem("accessToken");
      const refreshToken = localStorage.getItem("refreshToken");
      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "x-refresh-token": refreshToken,
          "X-Trace-Id": traceId,
        },
      };

      const response = await api.patch("/api/users/update-profile", payload, config);

      const { user, emailStatus } = response.data;
      localStorage.setItem("userName", user.name || "");
      localStorage.setItem("userEmail", user.email || "");
      localStorage.setItem("userMobile", user.mobileNumber || "");
      setOriginalName(user.name || "");
      setOriginalEmail(user.email || "");
      setOriginalMobile(user.mobileNumber || "");
      onAuthUpdate(user);
      setSuccessMessage("Profile updated successfully");
      setTimeout(() => setSuccessMessage(""), 2000);
      setIsEditing(false);

      if (emailStatus && !emailStatus.success) {
        setGlobalError("Profile updated, but email notification failed.");
        setTimeout(() => setGlobalError(""), 3000);
      }
    } catch (error) {
      logger.error("Update profile error", {
        status: error.response?.status,
        data: error.response?.data,
        traceId: error.response?.data?.traceId || traceId,
      });
      if (error.response) {
        const { status, data } = error.response;
        if (status === 400) {
          if (data.code === "INVALID_EMAIL") {
            setEmailError(data.message);
          } else if (data.code === "INVALID_MOBILE") {
            setMobileError(data.message);
          } else if (data.code === "INVALID_NAME") {
            setNameError(data.message);
          } else {
            setGlobalError(data.message || "Invalid input. Please try again.");
          }
        } else if (status === 404) {
          setGlobalError("Profile update endpoint not found. Please check server configuration.");
        } else if (status === 409) {
          setEmailError(data.message || "This email is already in use.");
        } else if (status === 429) {
          setGlobalError("Too many update attempts. Please try again later.");
        } else {
          setGlobalError("Failed to update profile. Please try again.");
        }
      } else {
        setGlobalError("Network error. Please check your connection and try again.");
      }
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="admin-account-settings-modal-overlay">
      <div
        className="admin-account-settings-container"
        role="dialog"
        aria-modal="true"
        aria-label="Account settings modal"
      >
        <button
          className="admin-account-settings-close-button"
          onClick={onBack}
          aria-label="Close account settings"
          disabled={isUpdating}
        >
          <img
            src="/assets/icons/close-white.svg"
            alt="Close"
            onError={() => logger.error("Failed to load /assets/icons/close.svg", {})}
          />
        </button>

        <form
          id="accountSettingsForm"
          className="admin-account-settings-form"
          onSubmit={handleSaveProfile}
          noValidate
        >
          <h1 className="admin-account-settings-title">Account Settings</h1>

          <div className="admin-account-settings-form-group">
            <input
              type="text"
              id="name"
              className={`admin-account-settings-input-field ${
                nameError ? "admin-account-settings-input-error" : ""
              } ${name.trim() ? "admin-account-settings-input-field-has-content" : ""}`}
              aria-label="Name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (showErrors) setNameError("");
              }}
              disabled={!isEditing || isUpdating}
              aria-describedby={nameError ? "nameError" : undefined}
              aria-invalid={nameError ? "true" : "false"}
            />
            <label
              htmlFor="name"
              className={`admin-account-settings-input-label ${
                nameError ? "admin-account-settings-input-label-error" : ""
              }`}
            >
              Name
            </label>
            {nameError && (
              <span
                id="nameError"
                className="admin-account-settings-error-message"
                role="alert"
              >
                {nameError}
              </span>
            )}
          </div>

          <div className="admin-account-settings-form-group">
            <input
              type="email"
              id="email"
              className={`admin-account-settings-input-field ${
                emailError ? "admin-account-settings-input-error" : ""
              } ${email.trim() ? "admin-account-settings-input-field-has-content" : ""}`}
              aria-label="Email address"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (showErrors) setEmailError("");
                setGlobalError("");
              }}
              disabled={!isEditing || isUpdating}
              aria-describedby={emailError ? "emailError" : undefined}
              aria-invalid={emailError ? "true" : "false"}
            />
            <label
              htmlFor="email"
              className={`admin-account-settings-input-label ${
                emailError ? "admin-account-settings-input-label-error" : ""
              }`}
            >
              Email
            </label>
            {emailError && (
              <span
                id="emailError"
                className="admin-account-settings-error-message"
                role="alert"
              >
                {emailError}
              </span>
            )}
          </div>

          <div className="admin-account-settings-form-group">
            <input
              type="tel"
              id="mobile"
              className={`admin-account-settings-input-field ${
                mobileError ? "admin-account-settings-input-error" : ""
              } ${mobile.trim() ? "admin-account-settings-input-field-has-content" : ""}`}
              aria-label="Mobile number"
              value={mobile}
              onChange={(e) => {
                setMobile(e.target.value);
                if (showErrors) setMobileError("");
              }}
              disabled={!isEditing || isUpdating}
              aria-describedby={mobileError ? "mobileError" : undefined}
              aria-invalid={mobileError ? "true" : "false"}
            />
            <label
              htmlFor="mobile"
              className={`admin-account-settings-input-label ${
                mobileError ? "admin-account-settings-input-label-error" : ""
              }`}
            >
              Mobile Number
            </label>
            {mobileError && (
              <span
                id="mobileError"
                className="admin-account-settings-error-message"
                role="alert"
              >
                {mobileError}
              </span>
            )}
          </div>

          {globalError && (
            <div className="admin-account-settings-global-error" role="alert">
              {globalError}
            </div>
          )}
          {successMessage && (
            <div className="admin-account-settings-success-message" role="alert">
              {successMessage}
            </div>
          )}

          <div className="admin-account-settings-form-actions">
            {!isEditing ? (
              <button
                type="button"
                className="admin-account-settings-edit-button"
                onClick={() => setIsEditing(true)}
                aria-label="Edit profile"
                disabled={isUpdating}
              >
                <img
                  src="/assets/icons/pencil.svg"
                  alt="Edit"
                  className="admin-account-settings-edit-icon"
                  onError={() => logger.error("Failed to load /assets/icons/pencil.svg", {})}
                />
                Edit Profile
              </button>
            ) : (
              <div className="admin-account-settings-edit-actions">
                <button
                  type="button"
                  className="admin-account-settings-cancel-button"
                  onClick={handleCancel}
                  aria-label="Cancel editing"
                  disabled={isUpdating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-account-settings-save-button"
                  disabled={isUpdating}
                  aria-label="Save profile"
                  aria-busy={isUpdating}
                >
                  {isUpdating ? (
                    <div className="admin-account-settings-spinner-container">
                      <div className="admin-account-settings-spinner"></div>
                      <span className="admin-account-settings-button-loading">
                        Updating...
                      </span>
                    </div>
                  ) : (
                    "Save"
                  )}
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

AdminAccountSettings.propTypes = {
  onBack: PropTypes.func.isRequired,
  onAuthUpdate: PropTypes.func,
};

export default AdminAccountSettings;