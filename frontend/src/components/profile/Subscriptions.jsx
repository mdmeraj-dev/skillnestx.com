import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import axios from "axios";
import "./styles/Subscription.css";

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

const Subscriptions = ({ onBack, closeDropdown }) => {
  const [subscription, setSubscription] = useState(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

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

  const fetchUserSubscription = async () => {
    const traceId = crypto.randomUUID?.() || generateUUID();
    const cachedSubscription = localStorage.getItem("subscription"); // Moved outside try
    try {
      // Check localStorage for cached subscription
      if (cachedSubscription) {
        const parsedSubscription = JSON.parse(cachedSubscription);
        logger.debug("Loaded subscription from localStorage", {
          traceId,
          subscriptionName: parsedSubscription?.subscriptionName,
        });
        setSubscription(parsedSubscription);
        setIsSubscribed(!!parsedSubscription); // Set isSubscribed based on presence of subscription
      }

      logger.debug("Fetching user data from /api/users/current", { traceId });
      const response = await api.get("/api/users/current");
      logger.debug("Raw user data response", {
        traceId,
        responseData: response.data,
      });

      const activeSubscription = response.data.user?.activeSubscription;
      if (!activeSubscription || !activeSubscription.subscriptionId) {
        logger.debug("No active subscription found", { traceId });
        setSubscription(null);
        setIsSubscribed(false);
        localStorage.setItem("subscription", JSON.stringify(null)); // Cache null
        return;
      }

      // Validate subscription
      const { status, endDate, subscriptionName } = activeSubscription;
      const parsedEndDate = endDate ? new Date(endDate) : null;

      if (
        !status ||
        status !== "active" ||
        !parsedEndDate ||
        parsedEndDate < new Date()
      ) {
        logger.debug("Invalid or expired subscription", {
          traceId,
          activeSubscription,
          status,
          endDate: parsedEndDate,
        });
        setSubscription(null);
        setIsSubscribed(false);
        localStorage.setItem("subscription", JSON.stringify(null)); // Cache null
      } else {
        logger.debug("Valid subscription found", {
          traceId,
          status,
          endDate: parsedEndDate,
          subscriptionName,
        });
        setSubscription(activeSubscription);
        setIsSubscribed(true);
        // Cache the fetched subscription in localStorage
        localStorage.setItem("subscription", JSON.stringify(activeSubscription));
      }
    } catch (error) {
      logger.error("Error fetching user data", {
        traceId,
        message: error.message,
        status: error.response?.status,
        response: error.response?.data,
      });
      setError("Failed to load subscription data. Please try again or contact support.");
      // Keep cached subscription if available, only clear if no cache
      if (!cachedSubscription) {
        setSubscription(null);
        setIsSubscribed(false);
      }
    }
  };

  useEffect(() => {
    fetchUserSubscription();
  }, []);

  const handleBack = () => {
    const traceId = generateUUID();
    logger.debug("Back button clicked, navigating to previous page", { traceId });
    if (typeof onBack === "function") {
      logger.debug("Calling custom onBack function", { traceId });
      onBack();
    } else {
      logger.debug("Navigating back using React Router", { traceId });
      navigate(-1);
    }
  };

  return (
    <div className="subscriptions-container">
      <div className="subscriptions-header">
        <button
          className="back-button"
          onClick={handleBack}
          aria-label="Go back"
        >
          <span className="material-icons back-icon">arrow_back</span>
        </button>
        <h1>Subscription Status</h1>
      </div>
      {error && <p className="error-message">{error}</p>}
      {isSubscribed ? (
        <div className="subscription-details">
          <h2>Active Subscription</h2>
          <p>Plan: {subscription?.subscriptionName || "No Plan"}</p>
          <p>Status: {subscription?.status || "Inactive"}</p>
          <p>
            Expiry date: {subscription?.endDate ? formatDate(subscription.endDate) : "Unknown"}
          </p>
        </div>
      ) : (
        <div className="no-subscription">
          <p>
            No active subscription.{" "}
            <a
              href="/pricing"
              onClick={(e) => {
                e.preventDefault();
                handleBack();
                closeDropdown();
                navigate("/pricing");
              }}
            >
              Subscribe now
            </a>.
          </p>
        </div>
      )}
    </div>
  );
};

Subscriptions.propTypes = {
  onBack: PropTypes.func,
  closeDropdown: PropTypes.func,
};

export default Subscriptions;