import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from "chart.js";
import "../styles/UserManagement.css";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Simple UUID generator as a fallback for crypto.randomUUID
const generateUUID = () => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

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

// Configure Axios with base URL
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
      const traceId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : generateUUID();
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

// Debounce utility
const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userCache, setUserCache] = useState({}); // New cache state
  const [error, setError] = useState("");
  const [searchError, setSearchError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [metrics, setMetrics] = useState({
    totalUsers: 0,
    recentUsers: 0,
    totalUsersData: [],
    recentUsersData: [],
  });
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState("");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [confirmation, setConfirmation] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Dropdown options
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2024 }, (_, i) => 2025 + i);
  const months = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
  ];

  // Calculate days in a given month and year
  const getDaysInMonth = (year, month) => {
    return new Date(year, month, 0).getDate();
  };

  // Generate headers for API calls
  const getHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
    "X-Trace-Id": typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : generateUUID(),
  });

  // Generate JWT headers for metrics API calls
  const getJwtHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
    "X-Trace-Id": typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : generateUUID(),
  });

  // Date formatting function
  const formatDate = (date) => {
    if (!date) return "N/A";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "N/A";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Fetch current user
  const fetchCurrentUser = async () => {
    const traceId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : generateUUID();
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        logger.warn("No access token for current user fetch", { traceId });
        setError("Please log in to access user management.");
        return;
      }
      logger.debug("Fetching current user", { traceId });
      const response = await api.get("/api/users/current", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "X-Trace-Id": traceId,
        },
      });

      logger.debug("Current user response", {
        traceId,
        status: response.status,
        data: response.data,
        activeSubscription: response.data.user?.activeSubscription,
      });

      if (response.status === 200 && response.data.success && response.data.user) {
        const user = response.data.user;
        let subscriptionStatus = "Inactive";
        if (user.activeSubscription) {
          const { status, endDate } = user.activeSubscription;
          const currentTime = Date.now();
          if (status === "active" && endDate && new Date(endDate).getTime() > currentTime) {
            subscriptionStatus = "Active";
          } else if (status === "cancelled") {
            subscriptionStatus = "Cancelled";
          } else if (endDate && new Date(endDate).getTime() < currentTime) {
            subscriptionStatus = "Expired";
          }
        }

        const updatedUser = { ...user, subscriptionStatus };
        setCurrentUser(updatedUser);
        logger.debug("Current user fetched", {
          traceId,
          userId: user._id,
          email: user.email,
          role: user.role,
          subscriptionStatus,
          activeSubscription: user.activeSubscription,
        });

        if (user.role !== "admin") {
          setError("Admin access required for user management.");
          setCurrentUser(null);
        }
      } else {
        logger.warn("No user data in response", { traceId, response: response.data });
        setError("Failed to fetch current user data.");
        setCurrentUser(null);
      }
    } catch (err) {
      logger.error("Fetch current user error", {
        error: err.message,
        status: err.response?.status,
        data: err.response?.data,
        traceId,
      });
      setError("Failed to fetch current user data. Please try again later.");
      setCurrentUser(null);
    }
  };

  // Debug state changes
  useEffect(() => {
    logger.debug("State update", { searchQuery, searchError, searchResults, hasSearched });
  }, [searchQuery, searchError, searchResults, hasSearched]);

  // Prevent scrolling when modal is open
  useEffect(() => {
    if (selectedUser) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedUser]);

  // Fetch all users
  const fetchAllUsers = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await api.get("/api/users/admin/users", {
        withCredentials: true,
        headers: getHeaders(),
      });
      if (response.data.success && Array.isArray(response.data.users)) {
        setUsers(response.data.users);
        setError("");
      } else {
        setUsers([]);
        setError("Invalid data format received from the server.");
      }
    } catch (err) {
      const message = err.response?.data?.message || "Failed to fetch users. Please try again later.";
      setError(message);
      console.error("Error fetching users:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch metrics for total and recent users
  const fetchMetrics = useCallback(async () => {
    setMetricsLoading(true);
    setMetricsError("");
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        throw new Error("Please log in to view metrics.");
      }

      const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
      const [totalResponse, recentResponse] = await Promise.all([
        api.get(`/api/users/admin/users/total?year=${selectedYear}`, { headers: getJwtHeaders() }),
        api.get(`/api/users/admin/users/recent?year=${selectedYear}&month=${selectedMonth}`, { headers: getJwtHeaders() }),
      ]);

      if (!totalResponse.data.success || !recentResponse.data.success) {
        throw new Error("Invalid response from metrics API");
      }

      if (totalResponse.data.tokens) {
        localStorage.setItem("accessToken", totalResponse.data.tokens.accessToken);
        localStorage.setItem("refreshToken", totalResponse.data.tokens.refreshToken);
      }
      if (recentResponse.data.tokens) {
        localStorage.setItem("accessToken", totalResponse.data.tokens.accessToken);
        localStorage.setItem("refreshToken", totalResponse.data.tokens.refreshToken);
      }

      setMetrics({
        totalUsers: totalResponse.data.total || 0,
        recentUsers: recentResponse.data.recent || 0,
        totalUsersData: totalResponse.data.history || Array(12).fill(0),
        recentUsersData: recentResponse.data.daily || Array(daysInMonth).fill(0),
      });
    } catch (err) {
      const message = err.response?.data?.message || err.message || "Failed to fetch metrics. Please try again.";
      setMetricsError(message);
      console.error("Error fetching metrics:", err, {
        response: err.response?.data,
        status: err.response?.status,
      });
    } finally {
      setMetricsLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  // Fetch user details with caching and debouncing
  const fetchUserDetails = useCallback(
    debounce(async (userId) => {
      if (userCache[userId]) {
        setSelectedUser(userCache[userId]);
        setIsDetailsLoading(false);
        logger.debug("Cache hit for user details", { userId, subscriptionName: userCache[userId].activeSubscription?.subscriptionName });
        return;
      }

      setIsDetailsLoading(true);
      const startTime = performance.now();
      try {
        const response = await api.get(`/api/users/admin/users/${userId}`, {
          withCredentials: true,
          headers: getHeaders(),
        });
        const apiTime = performance.now();
        if (response.data.success && response.data.user) {
          const user = response.data.user;
          let subscriptionStatus = "Inactive";
          if (user.activeSubscription) {
            const { status, endDate } = user.activeSubscription;
            const currentTime = Date.now();
            if (status === "active" && endDate && new Date(endDate).getTime() > currentTime) {
              subscriptionStatus = "Active";
            } else if (status === "cancelled") {
              subscriptionStatus = "Cancelled";
            } else if (endDate && new Date(endDate).getTime() < currentTime) {
              subscriptionStatus = "Expired";
            }
          }
          const updatedUser = { ...user, subscriptionStatus };
          setUserCache((prev) => ({ ...prev, [userId]: updatedUser }));
          setSelectedUser(updatedUser);
          setError("");
          const endTime = performance.now();
          logger.debug("Fetched user details", {
            userId,
            subscriptionName: user.activeSubscription?.subscriptionName,
            endDate: user.activeSubscription?.endDate,
            apiDuration: (apiTime - startTime).toFixed(2) + "ms",
            totalDuration: (endTime - startTime).toFixed(2) + "ms",
          });
        } else {
          setSelectedUser(null);
          setError("Failed to fetch user details.");
        }
      } catch (err) {
        const message = err.response?.data?.message || "Failed to fetch user details. Please try again later.";
        setError(message);
        console.error("Error fetching user details:", err);
      } finally {
        setIsDetailsLoading(false);
      }
    }, 300),
    [userCache, setUserCache, setSelectedUser, setIsDetailsLoading, setError]
  );

  // Search users by name or email
  const searchUsers = async () => {
    if (!searchQuery.trim()) {
      setSearchError("Please enter a name or email to search.");
      setSearchResults([]);
      setHasSearched(true);
      logger.debug("Empty search query", { searchQuery, searchError });
      return;
    }
    setIsLoading(true);
    setSearchError("");
    setHasSearched(true);
    try {
      const response = await api.get(
        `/api/users/admin/users/search?query=${encodeURIComponent(searchQuery.trim())}`,
        {
          withCredentials: true,
          headers: getHeaders(),
        }
      );
      logger.debug("Search response", { responseData: response.data });
      if (response.data.success && Array.isArray(response.data.users)) {
        setSearchResults(response.data.users);
        setSearchError("");
        if (response.data.users.length === 0) {
          setSearchError(response.data.message || "No users found with this name/email");
        }
      } else {
        setSearchResults([]);
        setSearchError(response.data.message || "No users found with this name/email");
      }
    } catch (err) {
      const message = err.response?.data?.message || "Failed to search users. Please try again later.";
      setSearchError(message);
      logger.error("Search users error", { error: err.message, response: err.response?.data });
    } finally {
      setIsLoading(false);
      logger.debug("Post-search state", { searchQuery, searchError, searchResults, hasSearched });
    }
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSearchError("");
    setHasSearched(false);
    logger.debug("Clear search", { searchQuery, searchError, searchResults, hasSearched });
  };

  // Handle Enter key press for search
  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      searchUsers();
    }
  };

  // Remove a user by userId
  const removeUser = async (userId) => {
    setConfirmation({
      action: "remove",
      userId,
      message: "Are you sure you want to remove this user?",
    });
  };

  // Ban/Unban a user by userId
  const toggleBanUser = async (userId, isBanned) => {
    setConfirmation({
      action: isBanned ? "ban" : "unban",
      userId,
      isBanned,
      message: `Are you sure you want to ${isBanned ? "ban" : "unban"} this user?`,
    });
  };

  // Handle confirmation
  const handleConfirm = async () => {
    if (!confirmation) return;
    setIsLoading(true);
    try {
      if (confirmation.action === "remove") {
        await api.delete(`/api/users/admin/users/${confirmation.userId}`, {
          withCredentials: true,
          headers: getHeaders(),
        });
        setUsers(users.filter((user) => user._id !== confirmation.userId));
        setSearchResults(searchResults.filter((user) => user._id !== confirmation.userId));
        setUserCache((prev) => {
          const newCache = { ...prev };
          delete newCache[confirmation.userId];
          return newCache;
        });
        setSuccess("User removed successfully.");
        setError("");
        if (selectedUser?._id === confirmation.userId) {
          setSelectedUser(null);
        }
        await Promise.all([fetchAllUsers(), fetchMetrics()]);
      } else if (confirmation.action === "ban" || confirmation.action === "unban") {
        await api.patch(
          `/api/users/admin/users/${confirmation.userId}/ban`,
          { isBanned: confirmation.isBanned, sendEmail: false },
          {
            withCredentials: true,
            headers: getHeaders(),
          }
        );
        setUsers(users.map((user) => (user._id === confirmation.userId ? { ...user, isBanned: confirmation.isBanned } : user)));
        setSearchResults(
          searchResults.map((user) => (user._id === confirmation.userId ? { ...user, isBanned: confirmation.isBanned } : user))
        );
        setUserCache((prev) => ({
          ...prev,
          [confirmation.userId]: prev[confirmation.userId]
            ? { ...prev[confirmation.userId], isBanned: confirmation.isBanned }
            : prev[confirmation.userId],
        }));
        if (selectedUser?._id === confirmation.userId) {
          setSelectedUser({ ...selectedUser, isBanned: confirmation.isBanned });
        }
        setSuccess(`User ${confirmation.isBanned ? "banned" : "unbanned"} successfully.`);
        setError("");
      }
    } catch (err) {
      const message = err.response?.data?.message || `Failed to ${confirmation.action} user.`;
      setError(message);
      console.error(`Error ${confirmation.action} user:`, err);
    } finally {
      setIsLoading(false);
      setConfirmation(null);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setConfirmation(null);
  };

  // Confirmation dialog component
  const ConfirmationDialog = () => {
    if (!confirmation) return null;
    const getActionText = () => {
      switch (confirmation.action) {
        case "remove":
          return "Removing...";
        case "ban":
          return "Banning...";
        case "unban":
          return "Unbanning...";
        default:
          return "Processing...";
      }
    };
    return (
      <div className="admin-user-management-confirmation-overlay">
        <div className="admin-user-management-confirmation-dialog">
          <p className="admin-user-management-confirmation-message">{confirmation.message}</p>
          <div className="admin-user-management-confirmation-buttons">
            <button
              onClick={handleConfirm}
              className="admin-user-management-action-button confirm"
              disabled={isLoading}
              aria-label="Confirm action"
            >
              {isLoading ? (
                <span>
                  <span className="admin-user-management-spinner"></span>
                  {getActionText()}
                </span>
              ) : (
                "Confirm"
              )}
            </button>
            <button
              onClick={handleCancel}
              className="admin-user-management-action-button cancel"
              disabled={isLoading}
              aria-label="Cancel action"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Close user details card
  const closeCard = () => {
    setSelectedUser(null);
    setError("");
  };

  // Fetch data on mount and when dependencies change
  useEffect(() => {
    fetchCurrentUser();
    fetchAllUsers();
    fetchMetrics();
  }, [fetchAllUsers, fetchMetrics]);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Debug rendering path
  useEffect(() => {
    if (hasSearched) {
      logger.debug("Search results rendering", {
        searchResultsLength: searchResults.length,
        searchError,
      });
    }
  }, [hasSearched, searchResults, searchError]);

  // Chart data for Total Users (Line Chart)
  const totalUsersChartData = {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    datasets: [
      {
        label: "Total Users",
        data: metrics.totalUsersData,
        borderColor: "#3b4a68",
        backgroundColor: "rgba(59, 74, 104, 0.2)",
        fill: true,
        tension: 0.4,
      },
    ],
  };

  // Chart data for Recent Users (Bar Chart)
  const daysInMonth = getDaysInMonth(currentYear, selectedMonth);
  const recentUsersChartData = {
    labels: Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`),
    datasets: [
      {
        label: "Recent Users",
        data: metrics.recentUsersData,
        backgroundColor: "#3b4a68",
        borderColor: "#4c5e8a",
        borderWidth: 1,
      },
    ],
  };

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: "#202b3d", titleColor: "#d1d5db", bodyColor: "#d1d5db" },
    },
    scales: {
      x: { ticks: { color: "#d1d5db" }, grid: { color: "#2d3a55" } },
      y: { ticks: { color: "#d1d5db" }, grid: { color: "#2d3a55" } },
    },
  };

  return (
    <div className="admin-user-management-container">
      <h1 className="admin-user-management-title">User Management</h1>

      {/* Metric Cards */}
      <div className="admin-user-management-metrics">
        <div className="admin-user-management-metric-card">
          <div className="admin-user-management-metric-header">
            <div className="admin-user-management-metric-title">Total Registered Users</div>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="admin-user-management-dropdown"
              aria-label="Select year for total registered users"
              disabled={metricsLoading}
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          {metricsLoading ? (
            <div className="admin-user-management-metric-loading">Loading...</div>
          ) : (
            <>
              <div className="admin-user-management-metric-value">{metrics.totalUsers}</div>
              <div className="admin-user-management-metric-chart">
                <Line data={totalUsersChartData} options={chartOptions} />
              </div>
            </>
          )}
        </div>
        <div className="admin-user-management-metric-card">
          <div className="admin-user-management-metric-header">
            <div className="admin-user-management-metric-title">Recent Registered Users</div>
            <div className="admin-user-management-metric-selectors">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="admin-user-management-dropdown"
                aria-label="Select month for recent registered users"
                disabled={metricsLoading}
              >
                {months.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {metricsLoading ? (
            <div className="admin-user-management-metric-loading">Loading...</div>
          ) : (
            <>
              <div className="admin-user-management-metric-value">{metrics.recentUsers}</div>
              <div className="admin-user-management-metric-chart">
                <Bar data={recentUsersChartData} options={chartOptions} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Metrics Error and Retry */}
      {metricsError && (
        <div className="admin-user-management-error-container">
          <p className="admin-user-management-error">{metricsError}</p>
          <button
            onClick={fetchMetrics}
            className="admin-user-management-action-button retry"
            aria-label="Retry fetching metrics"
          >
            Retry
          </button>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmationDialog />

      {/* Search Section */}
      <div className="admin-user-management-search-section">
        <svg
          className="admin-user-management-search-icon"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          placeholder="Search users by name or email"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="admin-user-management-search-input"
          aria-label="Search users by name or email"
        />
        {searchQuery && (
          <button
            onClick={clearSearch}
            className="admin-user-management-action-button clear"
            aria-label="Clear search"
          >
            Clear
          </button>
        )}
      </div>

      {/* Search Results */}
      {hasSearched && (
        <div className="admin-user-management-search-results">
          <h2 className="admin-user-management-search-results-title">Search Results</h2>
          {searchError ? (
            <p className="admin-user-management-error">{searchError}</p>
          ) : searchResults.length > 0 ? (
            <table className="admin-user-management-search-results-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Is Banned</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.map((user) => (
                  <tr key={user._id}>
                    <td data-label="Name">{user.name}</td>
                    <td data-label="Email">{user.email}</td>
                    <td data-label="Role">{user.role}</td>
                    <td data-label="Is Banned">{user.isBanned ? "Yes" : "No"}</td>
                    <td data-label="Actions" className="admin-user-management-actions">
                      <button
                        onClick={() => fetchUserDetails(user._id)}
                        disabled={isLoading}
                        className="admin-user-management-action-button view"
                        aria-label={`View details for user ${user.email}`}
                      >
                        View Details
                      </button>
                       <button
                        onClick={() => toggleBanUser(user._id, !user.isBanned)}
                        disabled={isLoading}
                        className="admin-user-management-action-button ban"
                        aria-label={`${user.isBanned ? "Unban" : "Ban"} user ${user.email}`}
                      >
                        {user.isBanned ? "Unban" : "Ban"}
                      </button>
                      <button
                        onClick={() => removeUser(user._id)}
                        disabled={isLoading}
                        className="admin-user-management-action-button remove"
                        aria-label={`Remove user ${user.email}`}
                      >
                        Remove
                      </button>
                     
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="admin-user-management-empty">No results to display.</p>
          )}
        </div>
      )}

      {/* User Details Card */}
      {selectedUser && (
        <div className="admin-user-management-user-card-overlay">
          <div className="admin-user-management-user-card">
            <span
              className="admin-user-management-user-card-close"
              onClick={closeCard}
              aria-label="Close user details card"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && closeCard()}
            >
              <span className="material-icons" style={{ fontSize: "20px" }}>
                close
              </span>
            </span>
            <h2 className="admin-user-management-user-card-title">User Details</h2>
            {isDetailsLoading ? (
              <p className="admin-user-management-user-card-loading">Loading user details...</p>
            ) : (
              <div className="admin-user-management-user-card-content">
                <div className="admin-user-management-user-card-item">
                  <span className="admin-user-management-user-card-label">Name:</span>
                  <span>{selectedUser.name}</span>
                </div>
                <div className="admin-user-management-user-card-item">
                  <span className="admin-user-management-user-card-label">Email:</span>
                  <span>{selectedUser.email}</span>
                </div>
                <div className="admin-user-management-user-card-item">
                  <span className="admin-user-management-user-card-label">Role:</span>
                  <span>{selectedUser.role}</span>
                </div>
                <div className="admin-user-management-user-card-item">
                  <span className="admin-user-management-user-card-label">Purchased Courses:</span>
                  <span>
                    {selectedUser.purchasedCourses?.length > 0
                      ? selectedUser.purchasedCourses.map(course => course.courseName).join(", ")
                      : "None"}
                  </span>
                </div>
                <div className="admin-user-management-user-card-item">
                  <span className="admin-user-management-user-card-label">Subscription Name:</span>
                  <span>{selectedUser.activeSubscription?.subscriptionName || "None"}</span>
                </div>
                <div className="admin-user-management-user-card-item">
                  <span className="admin-user-management-user-card-label">Subscription Status:</span>
                  <span>{selectedUser.subscriptionStatus || "Unknown"}</span>
                </div>
                <div className="admin-user-management-user-card-item">
                  <span className="admin-user-management-user-card-label">Subscription Expiry Date:</span>
                  <span>{selectedUser.activeSubscription?.endDate ? formatDate(selectedUser.activeSubscription.endDate) : "N/A"}</span>
                </div>
                <div className="admin-user-management-user-card-item">
                  <span className="admin-user-management-user-card-label">Banned:</span>
                  <span>{selectedUser.isBanned ? "Yes" : "No"}</span>
                </div>
                <div className="admin-user-management-user-card-item">
                  <span className="admin-user-management-user-card-label">Created At:</span>
                  <span>{formatDate(selectedUser.createdAt)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Success and Error Messages */}
      {error && <p className="admin-user-management-error">{error}</p>}
      {success && <p className="admin-user-management-success">{success}</p>}

      {/* All Users Table */}
      {isLoading ? (
        <div>
          {Array(5).fill().map((_, index) => (
            <div key={index} className="admin-user-management-skeleton" />
          ))}
        </div>
      ) : users.length === 0 && !searchResults.length ? (
        <p className="admin-user-management-empty">No users found.</p>
      ) : (
        <table className="admin-user-management-user-list">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Is Banned</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user._id}>
                <td data-label="Name">{user.name}</td>
                <td data-label="Email">{user.email}</td>
                <td data-label="Role">{user.role}</td>
                <td data-label="Is Banned">{user.isBanned ? "Yes" : "No"}</td>
                <td data-label="Actions" className="admin-user-management-actions">
                  <button
                    onClick={() => fetchUserDetails(user._id)}
                    disabled={isLoading}
                    className="admin-user-management-action-button view"
                    aria-label={`View details for user ${user.email}`}
                  >
                    View Details
                  </button>

                    <button
                    onClick={() => toggleBanUser(user._id, !user.isBanned)}
                    disabled={isLoading}
                    className="admin-user-management-action-button ban"
                    aria-label={`${user.isBanned ? "Unban" : "Ban"} user ${user.email}`}
                  >
                    {user.isBanned ? "Unban" : "Ban"}
                  </button>
                  
                  <button
                    onClick={() => removeUser(user._id)}
                    disabled={isLoading}
                    className="admin-user-management-action-button remove"
                    aria-label={`Remove user ${user.email}`}
                  >
                    Remove
                  </button>
                
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default UserManagement;