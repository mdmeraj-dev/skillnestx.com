import React, { useState, useEffect, useCallback } from "react";
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
  Filler,
} from "chart.js";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "../styles/TransactionManagement.css";

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

// Logger aligned with UserManagement.jsx
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

// Generate UUID for trace IDs
const generateUUID = () => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Backend URL from environment variable
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

// Create axios instance
const api = axios.create({
  baseURL: BACKEND_URL,
});

// Generate headers for API calls
const getHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
  "X-Trace-Id":
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : generateUUID(),
});

// Axios interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const traceId =
      originalRequest?.headers["X-Trace-Id"] ||
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : generateUUID());
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      originalRequest.url !== "/api/auth/refresh-token" &&
      originalRequest.url !== "/api/auth/logout"
    ) {
      originalRequest._retry = true;
      const isLoggingOut = localStorage.getItem("isLoggingOut") === "true";
      if (isLoggingOut) {
        logger.debug("Skipping token refresh during logout", { traceId });
        return Promise.reject(error);
      }
      try {
        const refreshToken = localStorage.getItem("refreshToken");
        if (!refreshToken) {
          logger.warn("No refresh token available", { traceId });
          throw new Error("No refresh token available");
        }
        logger.debug("Attempting token refresh", { traceId });
        const response = await api.post(
          "/api/auth/refresh-token",
          { refreshToken },
          {
            headers: {
              "X-Trace-Id": traceId,
              "Content-Type": "application/json",
            },
          }
        );
        const { accessToken, refreshToken: newRefreshToken } = response.data;
        if (response.status === 200 && response.data.success) {
          localStorage.setItem("accessToken", accessToken);
          localStorage.setItem("refreshToken", newRefreshToken);
          const newPayload = JSON.parse(atob(accessToken.split(".")[1]));
          logger.debug("Tokens refreshed successfully", {
            traceId,
            role: newPayload.role,
          });
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
        logger.warn("Token refresh response invalid", {
          traceId,
          data: response.data,
        });
        throw new Error("Refresh failed");
      } catch (refreshError) {
        logger.error("Token refresh error", {
          traceId,
          error: refreshError.message,
          response: refreshError.response?.data,
        });
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        window.dispatchEvent(
          new CustomEvent("navigate", {
            detail: {
              path: "/login",
              state: {
                error: "Your authentication has expired. Please log in again.",
              },
              replace: true,
            },
          })
        );
        return Promise.reject(refreshError);
      }
    }
    logger.error("API request failed", {
      traceId,
      status: error.response?.status,
      message: error.response?.data?.message,
      url: originalRequest?.url,
    });
    return Promise.reject(error);
  }
);

const TransactionManagement = () => {
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    pages: 1,
    page: 1,
    limit: 10,
  });
  const [sort, setSort] = useState({ sortBy: "createdAt", sortOrder: "desc" });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState({ data: [], message: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const [error, setError] = useState("");
  const [metrics, setMetrics] = useState({
    totalTransactions: 0,
    recentTransactions: 0,
    totalTransactionsData: Array(12).fill(0),
    recentTransactionsData: [],
    weekLabels: [],
  });
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [currentUser, setCurrentUser] = useState(null);
  const [viewDetailsModal, setViewDetailsModal] = useState({
    isOpen: false,
    transaction: null,
  });
  const [refundConfirmModal, setRefundConfirmModal] = useState({
    isOpen: false,
    paymentId: null,
  });
  const navigate = useNavigate();

  // Dropdown options
  const years = Array.from({ length: 6 }, (_, i) => 2020 + i);
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

  // Prevent background scrolling when modals are open
  useEffect(() => {
    if (viewDetailsModal.isOpen || refundConfirmModal.isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [viewDetailsModal.isOpen, refundConfirmModal.isOpen]);

  // Fetch current user to validate admin role
  const fetchCurrentUser = async () => {
    const traceId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : generateUUID();
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        logger.warn("No access token for current user fetch", { traceId });
        setError("Please log in to access transaction management.");
        setCurrentUser(null);
        return;
      }
      logger.debug("Fetching current user", { traceId });
      const response = await api.get("/api/users/current", {
        headers: {
          "Content-Type": "application/json",
          ...getHeaders(),
        },
      });
      logger.debug("Current user response", {
        traceId,
        status: response.status,
        data: response.data,
      });
      if (
        response.status === 200 &&
        response.data.success &&
        response.data.user
      ) {
        const user = response.data.user;
        setCurrentUser(user);
        logger.debug("Current user fetched", {
          traceId,
          userId: user._id,
          email: user.email,
          role: user.role,
        });
        if (user.role !== "admin") {
          setError("Admin access required for transaction management.");
          setCurrentUser(null);
        }
      } else {
        logger.warn("No user data in response", {
          traceId,
          response: response.data,
        });
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

  // Fetch all transactions
  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    setError("");
    const traceId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : generateUUID();
    try {
      const response = await api.get("/api/transactions/all", {
        withCredentials: true,
        headers: getHeaders(),
        params: {
          page: pagination.page,
          limit: pagination.limit,
          sortBy: sort.sortBy,
          sortOrder: sort.sortOrder,
        },
      });
      const { data, pagination: newPagination } = response.data;
      if (response.data.success && Array.isArray(data)) {
        logger.debug("Transactions fetched successfully", {
          traceId,
          count: data.length,
        });
        setTransactions(data);
        setPagination(newPagination);
      } else {
        logger.warn("Invalid transaction data format", {
          traceId,
          data: response.data,
        });
        setTransactions([]); // Only clear if invalid
        setError("Invalid data format received from the server.");
      }
      if (response.data.tokens) {
        localStorage.setItem("accessToken", response.data.tokens.accessToken);
        localStorage.setItem("refreshToken", response.data.tokens.refreshToken);
      }
    } catch (err) {
      const status = err.response?.status;
      const message =
        err.response?.data?.message || "Failed to fetch transactions.";
      const errorTraceId = err.response?.data?.traceId || traceId;
      logger.error("Error fetching transactions", {
        traceId: errorTraceId,
        status,
        message,
      });
      setError(`${message} (Trace ID: ${errorTraceId})`);
      if (status === 401 || status === 403) {
        setError(
          "Access denied: Admin role required. Please log in as an admin."
        );
        toast.error(
          status === 401
            ? "Session expired. Please log in again."
            : "Access denied: Admin role required."
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, sort.sortBy, sort.sortOrder]);

  // Fetch metrics for total and recent transactions
  const fetchMetrics = useCallback(async () => {
    const traceId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : generateUUID();
    try {
      const [totalResponse, recentResponse] = await Promise.all([
        api.get(`/api/transactions/total?year=${selectedYear}`, {
          withCredentials: true,
          headers: getHeaders(),
        }),
        api.get(
          `/api/transactions/recent?year=${selectedYear}&month=${selectedMonth}`,
          {
            withCredentials: true,
            headers: getHeaders(),
          }
        ),
      ]);
      const totalData = totalResponse.data.data || {
        total: 0,
        history: Array(12).fill(0),
      };
      const recentData = recentResponse.data.data || {
        total: 0,
        daily: [],
      };
      const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
      const weeksInMonth = Math.ceil(daysInMonth / 7);
      const weeklyData = Array(weeksInMonth).fill(0);
      recentData.daily.forEach((count, index) => {
        const weekIndex = Math.floor(index / 7);
        weeklyData[weekIndex] += count;
      });
      const weekLabels = Array.from(
        { length: weeksInMonth },
        (_, i) => `Week ${i + 1}`
      );
      logger.debug("Metrics fetched successfully", {
        traceId,
        totalTransactions: totalData.total,
        recentTransactions: recentData.total,
        weeksInMonth,
      });
      setMetrics({
        totalTransactions: totalData.total || 0,
        totalTransactionsData: totalData.history || Array(12).fill(0),
        recentTransactions: recentData.total || 0,
        recentTransactionsData: weeklyData,
        weekLabels,
      });
      if (totalResponse.data.tokens) {
        localStorage.setItem(
          "accessToken",
          totalResponse.data.tokens.accessToken
        );
        localStorage.setItem(
          "refreshToken",
          totalResponse.data.tokens.refreshToken
        );
      }
      if (recentResponse.data.tokens) {
        localStorage.setItem(
          "accessToken",
          recentResponse.data.tokens.accessToken
        );
        localStorage.setItem(
          "refreshToken",
          recentResponse.data.tokens.refreshToken
        );
      }
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message || "Failed to fetch metrics.";
      const errorTraceId = err.response?.data?.traceId || traceId;
      logger.error("Error fetching metrics", {
        traceId: errorTraceId,
        status,
        message,
      });
      setError(`${message} (Trace ID: ${errorTraceId})`);
      if (status === 401 || status === 403) {
        setError(
          "Access denied: Admin role required. Please log in as an admin."
        );
        toast.error(
          status === 401
            ? "Session expired. Please log in again."
            : "Access denied: Admin role required."
        );
      }
    }
  }, [selectedYear, selectedMonth]);

  // Search transactions by query (Transaction ID, Payment ID, User Email, or Username)
  const searchTransactions = useCallback(async () => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery || trimmedQuery.length < 3) {
      setSearchResults({ data: [], message: "" });
      setError(
        trimmedQuery ? "Search query must be at least 3 characters long." : ""
      );
      return;
    }
    setIsLoading(true);
    setError("");
    const traceId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : generateUUID();
    try {
      const response = await api.get("/api/transactions/search", {
        withCredentials: true,
        headers: getHeaders(),
        params: {
          query: trimmedQuery,
        },
      });
      if (response.data.success && Array.isArray(response.data.data)) {
        logger.debug("Search results fetched", {
          traceId,
          count: response.data.data.length,
          query: trimmedQuery,
        });
        setSearchResults({
          data: response.data.data,
          message: response.data.message || "",
        });
      } else {
        logger.warn("Invalid search response", {
          traceId,
          data: response.data,
        });
        setSearchResults({
          data: [],
          message: response.data.message || "No transactions found.",
        });
      }
      if (response.data.tokens) {
        localStorage.setItem("accessToken", response.data.tokens.accessToken);
        localStorage.setItem("refreshToken", response.data.tokens.refreshToken);
      }
    } catch (err) {
      const status = err.response?.status;
      const message =
        err.response?.data?.message || "Failed to search transactions.";
      const errorTraceId = err.response?.data?.traceId || traceId;
      logger.error("Error searching transactions", {
        traceId: errorTraceId,
        status,
        message,
        query: trimmedQuery,
      });
      setError(`${message} (Trace ID: ${errorTraceId})`);
      setSearchResults({ data: [], message: message });
      if (status === 400) {
        toast.error(message); // Show validation errors (e.g., invalid characters)
      } else if (status === 401 || status === 403) {
        setError(
          "Access denied: Admin role required. Please log in as an admin."
        );
        toast.error(
          status === 401
            ? "Session expired. Please log in again."
            : "Access denied: Admin role required."
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  // Clear search
  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults({ data: [], message: "" });
    setError("");
  };

  // Handle Enter key press for search
  const handleKeyDown = (event) => {
    if (event.key === "Enter" && searchQuery.trim().length >= 3) {
      searchTransactions();
    }
  };

  // Handle pagination
  const handlePageChange = (newPage) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  // Handle sorting
  const handleSortChange = (newSortBy) => {
    setSort((prev) => ({
      sortBy: newSortBy,
      sortOrder:
        prev.sortBy === newSortBy && prev.sortOrder === "asc" ? "desc" : "asc",
    }));
  };

  // Validate paymentId format
  const validatePaymentId = (paymentId) => {
    const paymentIdRegex = /^pay_[A-Za-z0-9]+$/;
    return paymentIdRegex.test(paymentId);
  };

  // Open refund confirmation modal
  const openRefundConfirmModal = (paymentId) => {
    if (!validatePaymentId(paymentId)) {
      const traceId = crypto?.randomUUID?.() || generateUUID();
      logger.warn("Invalid paymentId format", { traceId, paymentId });
      setError(
        "Invalid Payment ID format. It must start with 'pay_' followed by alphanumeric characters."
      );
      toast.error("Invalid Payment ID format.");
      return;
    }
    setRefundConfirmModal({ isOpen: true, paymentId });
  };

  // Close refund confirmation modal
  const closeRefundConfirmModal = () => {
    setRefundConfirmModal({ isOpen: false, paymentId: null });
  };

  // Handle refund request
  const handleRefundRequest = async (paymentId) => {
    setIsRefunding(true);
    setError("");
    const traceId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : generateUUID();
    try {
      const response = await api.post(
        "/api/transactions/refund/request",
        { paymentId },
        {
          withCredentials: true,
          headers: getHeaders(),
        }
      );
      if (response.data.success) {
        logger.debug("Refund initiated", {
          traceId,
          paymentId,
          refundStatus: response.data.data.refundStatus,
          refundId: response.data.data.refundId,
        });
        toast.success(
          `Refund initiated, confirmation emailed: ${response.data.data.refundId}`
        );
        // Reset to page 1 to avoid fetching invalid page
        setPagination((prev) => ({ ...prev, page: 1 }));
        // Refresh transactions and search results
        await Promise.all([fetchTransactions(), searchTransactions()]);
      } else {
        logger.warn("Refund request failed", {
          traceId,
          message: response.data.message,
        });
        setError(response.data.message || "Failed to initiate refund.");
        toast.error(response.data.message || "Failed to initiate refund.");
      }
    } catch (err) {
      const status = err.response?.status;
      let message = err.response?.data?.message || "Failed to initiate refund.";
      const errorTraceId = err.response?.data?.traceId || traceId;

      // Extract detailed Razorpay error if available
      if (status === 400 && message.includes("Razorpay refund failed")) {
        const errorMatch = message.match(
          /Razorpay refund failed: (.+) \(Code: (.+)\)/
        );
        if (errorMatch) {
          const [, errorDescription, errorCode] = errorMatch;
          message = `Refund failed: ${errorDescription} (Code: ${errorCode})`;
        }
      }

      logger.error("Error initiating refund", {
        traceId: errorTraceId,
        status,
        message,
        paymentId,
      });
      setError(`${message} (Trace ID: ${errorTraceId})`);
      toast.error(`${message} (Trace ID: ${errorTraceId})`);
      if (status === 401 || status === 403) {
        setError(
          "Access denied: Admin role required. Please log in as an admin."
        );
        toast.error(
          status === 401
            ? "Session expired. Please log in again."
            : "Access denied: Admin role required."
        );
      } else if (status === 400) {
        toast.error(message); // Show specific validation errors
      }
    } finally {
      setIsRefunding(false);
      closeRefundConfirmModal();
    }
  };

  // Open view details modal
  const openViewDetailsModal = async (paymentId) => {
    setIsLoading(true);
    setError("");
    const traceId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : generateUUID();
    try {
      const response = await api.get(`/api/transactions/details/${paymentId}`, {
        withCredentials: true,
        headers: getHeaders(),
      });
      if (response.data.success && response.data.data) {
        logger.debug("Transaction details fetched", { traceId, paymentId });
        // Log warning if subscription name is missing
        if (
          response.data.data.purchaseType === "subscription" &&
          !response.data.data.subscription?.name
        ) {
          logger.warn("Subscription name missing in transaction details", {
            traceId,
            paymentId,
            subscriptionId: response.data.data.subscription?.subscriptionId,
          });
        }
        setViewDetailsModal({
          isOpen: true,
          transaction: response.data.data,
        });
      } else {
        logger.warn("Failed to fetch transaction details", {
          traceId,
          message: response.data.message,
        });
        setError(
          response.data.message || "Failed to fetch transaction details."
        );
        toast.error("Failed to fetch transaction details.");
      }
    } catch (err) {
      const status = err.response?.status;
      const message =
        err.response?.data?.message || "Failed to fetch transaction details.";
      const errorTraceId = err.response?.data?.traceId || traceId;
      logger.error("Error fetching transaction details", {
        traceId: errorTraceId,
        status,
        message,
      });
      setError(`${message} (Trace ID: ${errorTraceId})`);
      toast.error(`${message} (Trace ID: ${errorTraceId})`);
    } finally {
      setIsLoading(false);
    }
  };

  // Close view details modal
  const closeViewDetailsModal = () => {
    setViewDetailsModal({ isOpen: false, transaction: null });
  };

  // Check authentication and role on mount
  useEffect(() => {
    fetchCurrentUser();
  }, []);

  // Fetch data when currentUser is confirmed as admin
  useEffect(() => {
    if (currentUser && currentUser.role === "admin") {
      fetchTransactions();
      fetchMetrics();
    }
  }, [currentUser, fetchTransactions, fetchMetrics]);

  // Redirect on persistent auth error
  useEffect(() => {
    if (
      error.includes("Admin access required") ||
      error.includes("Session expired")
    ) {
      const timer = setTimeout(() => {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        window.dispatchEvent(
          new CustomEvent("navigate", {
            detail: {
              path: "/login",
              state: {
                error:
                  "Access denied: Admin role required. Please log in as an admin.",
              },
              replace: true,
            },
          })
        );
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Clear error message
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentUser && currentUser.role === "admin") {
        searchTransactions();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, searchTransactions, currentUser]);

  // Chart data for Total Transactions (Line Chart)
  const totalTransactionsChartData = {
    labels: [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ],
    datasets: [
      {
        label: "Total Transactions",
        data: metrics.totalTransactionsData,
        borderColor: "#3b4a68",
        backgroundColor: "rgba(59, 74, 104, 0.2)",
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  // Chart data for Recent Transactions (Bar Chart)
  const recentTransactionsChartData = {
    labels: metrics.weekLabels,
    datasets: [
      {
        label: "Recent Transactions",
        data: metrics.recentTransactionsData,
        backgroundColor: "#3b4a68",
        borderColor: "#4c5e8a",
        borderWidth: 1,
      },
    ],
  };

  // Chart options for Total Transactions (Line Chart)
  const totalTransactionsChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#202b3d",
        titleColor: "#d1d5db",
        bodyColor: "#d1d5db",
      },
    },
    scales: {
      x: {
        ticks: {
          color: "#d1d5db",
          maxTicksLimit: window.innerWidth <= 768 ? 6 : 12,
          callback: function (value, index) {
            const labels = [
              "Jan",
              "Feb",
              "Mar",
              "Apr",
              "May",
              "Jun",
              "Jul",
              "Aug",
              "Sep",
              "Oct",
              "Nov",
              "Dec",
            ];
            if (window.innerWidth <= 768 && index % 2 !== 0) {
              return null;
            }
            return labels[index];
          },
        },
        grid: { color: "#2d3a55" },
      },
      y: {
        ticks: {
          color: "#d1d5db",
          stepSize: 1,
          callback: (value) => (Number.isInteger(value) ? value : null),
        },
        grid: { color: "#2d3a55" },
        min: 0,
        suggestedMax:
          Math.max(
            ...metrics.totalTransactionsData,
            metrics.totalTransactions,
            1
          ) + 1,
      },
    },
  };

  // Chart options for Recent Transactions (Bar Chart)
  const recentTransactionsChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#202b3d",
        titleColor: "#d1d5db",
        bodyColor: "#d1d5db",
      },
    },
    scales: {
      x: {
        ticks: {
          color: "#d1d5db",
          font: {
            size: window.innerWidth <= 768 ? 10 : 12,
          },
           maxRotation: 45,
          minRotation: 45,
        },
        grid: { color: "#2d3a55" },
      },
      y: {
        ticks: {
          color: "#d1d5db",
          stepSize: 1,
          callback: (value) => (Number.isInteger(value) ? value : null),
        },
        grid: { color: "#2d3a55" },
        min: 0,
        suggestedMax:
          Math.max(
            ...metrics.recentTransactionsData,
            metrics.recentTransactions,
            1
          ) + 1,
      },
    },
  };

  return (
    <div className="admin-transaction-management-container">
      <h1 className="admin-transaction-management-title">
        Transaction Management
      </h1>

      {/* Metric Cards */}
      <div className="admin-transaction-management-metrics">
        <div className="admin-transaction-management-metric-card">
          <div className="admin-transaction-management-metric-header">
            <div className="admin-transaction-management-metric-title">
              Total Transactions ({selectedYear})
            </div>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="admin-transaction-management-dropdown"
              aria-label="Select year for total transactions"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-transaction-management-metric-value">
            {metrics.totalTransactions}
          </div>
          <div className="admin-transaction-management-metric-chart">
            <Line
              data={totalTransactionsChartData}
              options={totalTransactionsChartOptions}
            />
          </div>
        </div>
        <div className="admin-transaction-management-metric-card">
          <div className="admin-transaction-management-metric-header">
            <div className="admin-transaction-management-metric-title">
              Recent Transactions ({selectedYear}-
              {selectedMonth.toString().padStart(2, "0")})
            </div>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="admin-transaction-management-dropdown"
              aria-label="Select month for recent transactions"
            >
              {months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-transaction-management-metric-value">
            {metrics.recentTransactions}
          </div>
          <div className="admin-transaction-management-metric-chart">
            <Bar
              data={recentTransactionsChartData}
              options={recentTransactionsChartOptions}
            />
          </div>
        </div>
      </div>

      {/* Search Section */}
      <div className="admin-transaction-management-search-section">
        <svg
          className="admin-transaction-management-search-icon"
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
          placeholder="Search by Transaction ID, Payment ID, Email"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="admin-transaction-management-search-input"
          aria-label="Search by Transaction ID, Payment ID, Email, or Username"
        />
        {searchQuery && (
          <button
            onClick={clearSearch}
            className="admin-transaction-management-action-button clear"
            aria-label="Clear search"
          >
            Clear
          </button>
        )}
      </div>

        {error && (
        <div className="admin-transaction-management-error">
          {error}
          <button
            onClick={() => setError("")}
            className="admin-transaction-management-dismiss-button"
            aria-label="Dismiss error message"
          >
            ✕
          </button>
        </div>
      )}

      {/* Search Results */}
      {searchQuery && (
        <div className="admin-transaction-management-search-results">
          <h2 className="admin-transaction-management-search-results-title">
            Search Results
          </h2>
          {isLoading ? (
            <div className="admin-transaction-management-skeleton-table">
              {Array(5)
                .fill()
                .map((_, index) => (
                  <div
                    key={index}
                    className="admin-transaction-management-skeleton-row"
                  >
                    <div className="admin-transaction-management-skeleton-cell" />
                    <div className="admin-transaction-management-skeleton-cell" />
                    <div className="admin-transaction-management-skeleton-cell" />
                    <div className="admin-transaction-management-skeleton-cell" />
                    <div className="admin-transaction-management-skeleton-cell" />
                    <div className="admin-transaction-management-skeleton-cell" />
                    <div className="admin-transaction-management-skeleton-cell" />
                  </div>
                ))}
            </div>
          ) : searchResults.data.length > 0 ? (
            <table className="admin-transaction-management-search-results-table">
              <thead>
                <tr>
                  <th onClick={() => handleSortChange("_id")}>
                    Transaction ID
                    {sort.sortBy === "_id" &&
                      (sort.sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSortChange("userId")}>
                    User Email
                    {sort.sortBy === "userId" &&
                      (sort.sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSortChange("currency")}>
                    Currency
                    {sort.sortBy === "currency" &&
                      (sort.sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSortChange("amount")}>
                    Amount
                    {sort.sortBy === "amount" &&
                      (sort.sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSortChange("status")}>
                    Status
                    {sort.sortBy === "status" &&
                      (sort.sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSortChange("refundStatus")}>
                    Refund Status
                    {sort.sortBy === "refundStatus" &&
                      (sort.sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.data.map((txn) => (
                  <tr key={txn._id}>
                    <td data-label="Transaction ID">{txn._id}</td>
                    <td data-label="User Email">
                      {txn.userId?.email || "Unknown"}
                    </td>
                    <td data-label="Currency">{txn.currency}</td>
                    <td data-label="Amount">{txn.amount.toFixed(2)}</td>
                    <td data-label="Status">{txn.status}</td>
                    <td data-label="Refund Status">
                      {txn.refundStatus || "None"}
                    </td>
                    <td
                      data-label="Action"
                      className="admin-transaction-management-actions"
                    >
                      <button
                        onClick={() => openViewDetailsModal(txn.paymentId)}
                        disabled={isLoading || isRefunding}
                        className="admin-transaction-management-action-button view"
                        aria-label={`View details for ${txn._id}`}
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => openRefundConfirmModal(txn.paymentId)}
                        disabled={
                          isLoading ||
                          isRefunding ||
                          (txn.refundStatus !== null &&
                            txn.refundStatus !== "failed") ||
                          txn.status !== "successful"
                        }
                        className="admin-transaction-management-action-button update"
                        aria-label={`Request refund for ${txn._id}`}
                      >
                        Refund
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="admin-transaction-management-empty">
              {searchResults.message ||
                "No transactions found for this search query."}
            </p>
          )}
        </div>
      )}

      {/* View Details Modal */}
      {viewDetailsModal.isOpen && viewDetailsModal.transaction && (
        <div className="admin-transaction-management-modal">
          <div className="admin-transaction-management-modal-content">
            <span
              className="admin-transaction-management-modal-close"
              onClick={closeViewDetailsModal}
              aria-label="Close modal"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && closeViewDetailsModal()}
            >
              <span className="material-icons" style={{ fontSize: "20px" }}>
                close
              </span>
            </span>
            <h2>Transaction Details</h2>
            <div className="admin-transaction-management-details">
              <p>
                <strong>Transaction ID:</strong>{" "}
                {viewDetailsModal.transaction.transactionId}
              </p>
              <p>
                <strong>Payment ID:</strong>{" "}
                {viewDetailsModal.transaction.paymentId}
              </p>
              <p>
                <strong>User ID:</strong>{" "}
                {viewDetailsModal.transaction.user.userId}
              </p>
              <p>
                <strong>User:</strong> {viewDetailsModal.transaction.user.email}
              </p>
              <p>
                <strong>Order ID:</strong>{" "}
                {viewDetailsModal.transaction.orderId}
              </p>
              <p>
                <strong>Amount:</strong>{" "}
                {viewDetailsModal.transaction.amount.toFixed(2)}{" "}
                {viewDetailsModal.transaction.currency}
              </p>
              <p>
                <strong>Status:</strong> {viewDetailsModal.transaction.status}
              </p>
              <p>
                <strong>Purchase Type:</strong>{" "}
                {viewDetailsModal.transaction.purchaseType}
              </p>
              <p>
                <strong>
                  {viewDetailsModal.transaction.purchaseType === "course"
                    ? "Course"
                    : viewDetailsModal.transaction.purchaseType ===
                      "subscription"
                    ? "Subscription"
                    : "Courses"}
                  :
                </strong>{" "}
                {viewDetailsModal.transaction.purchaseType === "course"
                  ? viewDetailsModal.transaction.course?.title ||
                    viewDetailsModal.transaction.course?.courseId ||
                    "N/A"
                  : viewDetailsModal.transaction.purchaseType === "subscription"
                  ? viewDetailsModal.transaction.subscription?.name ||
                    viewDetailsModal.transaction.subscription?.subscriptionId ||
                    "N/A"
                  : viewDetailsModal.transaction.cartItems?.length > 0
                  ? viewDetailsModal.transaction.cartItems
                      .map((item) => item.name || item.id || "Unknown")
                      .join(", ")
                  : "No courses"}
              </p>
              <p>
                <strong>Refund Status:</strong>{" "}
                {viewDetailsModal.transaction.refundStatus || "None"}
              </p>
              {viewDetailsModal.transaction.refundId && (
                <p>
                  <strong>Refund ID:</strong>{" "}
                  {viewDetailsModal.transaction.refundId}
                </p>
              )}
              <p>
                <strong>Created At:</strong>{" "}
                {new Date(
                  viewDetailsModal.transaction.createdAt
                ).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Refund Confirmation Modal */}
      {refundConfirmModal.isOpen && (
        <div className="admin-transaction-management-refund-modal">
          <div className="admin-transaction-management-refund-modal-content">
            <span
              className="admin-transaction-management-modal-close"
              onClick={closeRefundConfirmModal}
              aria-label="Close refund confirmation modal"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && closeRefundConfirmModal()}
            ></span>
            <h2>Confirm Refund</h2>
            <p>
              Are you sure you want to initiate a refund for this transaction?
            </p>
            <div className="admin-transaction-management-refund-modal-actions">
              <button
                onClick={() =>
                  handleRefundRequest(refundConfirmModal.paymentId)
                }
                disabled={isRefunding}
                className="admin-transaction-management-action-button confirm"
                aria-label="Confirm refund"
              >
                {isRefunding ? (
                  <span>
                    <span className="transaction-spinner"></span>
                   <span> Requesting...</span>
                  </span>
                ) : (
                  "Confirm"
                )}
              </button>
              <button
                onClick={closeRefundConfirmModal}
                disabled={isRefunding}
                className="admin-transaction-management-action-button cancel"
                aria-label="Cancel refund"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transactions Table */}
      {isLoading ? (
        <div className="admin-transaction-management-skeleton-table">
          {Array(5)
            .fill()
            .map((_, index) => (
              <div
                key={index}
                className="admin-transaction-management-skeleton-row"
              >
                <div className="admin-transaction-management-skeleton-cell" />
                <div className="admin-transaction-management-skeleton-cell" />
                <div className="admin-transaction-management-skeleton-cell" />
                <div className="admin-transaction-management-skeleton-cell" />
                <div className="admin-transaction-management-skeleton-cell" />
                <div className="admin-transaction-management-skeleton-cell" />
                <div className="admin-transaction-management-skeleton-cell" />
              </div>
            ))}
        </div>
      ) : transactions.length === 0 && !searchResults.data.length ? (
        <p className="admin-transaction-management-empty">
          No transactions found.
        </p>
      ) : (
        <>
          <table className="admin-transaction-management-transaction-list">
            <thead>
              <tr>
                <th onClick={() => handleSortChange("_id")}>
                  Transaction ID
                  {sort.sortBy === "_id" &&
                    (sort.sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th onClick={() => handleSortChange("userId")}>
                  User Email
                  {sort.sortBy === "userId" &&
                    (sort.sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th onClick={() => handleSortChange("currency")}>
                  Currency
                  {sort.sortBy === "currency" &&
                    (sort.sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th onClick={() => handleSortChange("amount")}>
                  Amount
                  {sort.sortBy === "amount" &&
                    (sort.sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th onClick={() => handleSortChange("status")}>
                  Status
                  {sort.sortBy === "status" &&
                    (sort.sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th onClick={() => handleSortChange("refundStatus")}>
                  Refund Status
                  {sort.sortBy === "refundStatus" &&
                    (sort.sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((txn) => (
                <tr key={txn._id}>
                  <td data-label="Transaction ID">{txn._id}</td>
                  <td data-label="User Email">
                    {txn.userId?.email || "Unknown"}
                  </td>
                  <td data-label="Currency">{txn.currency}</td>
                  <td data-label="Amount">{txn.amount.toFixed(2)}</td>
                  <td data-label="Status">{txn.status}</td>
                  <td data-label="Refund Status">
                    {txn.refundStatus || "None"}
                  </td>
                  <td
                    data-label="Action"
                    className="admin-transaction-management-actions"
                  >
                    <button
                      onClick={() => openViewDetailsModal(txn.paymentId)}
                      disabled={isLoading || isRefunding}
                      className="admin-transaction-management-action-button view"
                      aria-label={`View details for ${txn._id}`}
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => openRefundConfirmModal(txn.paymentId)}
                      disabled={
                        isLoading ||
                        isRefunding ||
                        (txn.refundStatus !== null &&
                          txn.refundStatus !== "failed") ||
                        txn.status !== "successful"
                      }
                      className="admin-transaction-management-action-button update"
                      aria-label={`Request refund for ${txn._id}`}
                    >
                      Refund
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="admin-transaction-management-pagination">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1 || isRefunding}
              className="admin-transaction-management-action-button"
            >
              Previous
            </button>
            <span className="page-count">
              Page {pagination.page} of {pagination.pages}
            </span>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.pages || isRefunding}
              className="admin-transaction-management-action-button"
            >
              Next
            </button>
            <select
              value={pagination.limit}
              onChange={(e) =>
                setPagination((prev) => ({
                  ...prev,
                  limit: Number(e.target.value),
                  page: 1,
                }))
              }
              disabled={isRefunding}
              className="admin-transaction-management-dropdown pages-limit"
            >
              {[10, 20, 50].map((limit) => (
                <option key={limit} value={limit}>
                  {limit} per page
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <link
        href="https://fonts.googleapis.com/icon?family=Material+Icons"
        rel="stylesheet"
      />
    </div>
  );
};

export default TransactionManagement;
