import { useState, useEffect, useCallback, useRef } from "react";
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
import "../styles/SubscriptionManagement.css";

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

// Simple UUID generator as a fallback for crypto.randomUUID
const generateUUID = () => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Configure Axios with base URL and interceptor
const BASE_URL = import.meta.env.VITE_BACKEND_URL;
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
      const traceId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : generateUUID();
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
        if (!isLoggingOut) {
          window.dispatchEvent(
            new CustomEvent("navigate", {
              detail: {
                path: "/login",
                state: {
                  error:
                    "Your authentication has expired. Please log in again.",
                },
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

const SubscriptionManagement = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [subscribedUsers, setSubscribedUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingSubscriptionId, setEditingSubscriptionId] = useState(null);
  const [newSubscription, setNewSubscription] = useState({
    name: "",
    type: "",
    newPrice: "",
    oldPrice: "",
    features: [],
    tag: "",
    duration: 30,
  });
  const [metrics, setMetrics] = useState({
    totalSubscribers: 0,
    recentSubscribers: 0,
    totalSubscribersData: Array(12).fill(0),
    recentSubscribersData: [],
    totalSubscribersSubtotals: Array(12).fill(0),
    recentSubscribersSubtotals: [],
  });
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [confirmationModal, setConfirmationModal] = useState({
    isOpen: false,
    message: "",
    onConfirm: null,
  });
  const [viewDetailsModal, setViewDetailsModal] = useState({
    isOpen: false,
    subscription: null,
  });
  const [viewUserDetailsModal, setViewUserDetailsModal] = useState({
    isOpen: false,
    user: null,
  });
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const featuresTextareaRef = useRef(null);

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

  // Calculate days in a given month and year
  const getDaysInMonth = (year, month) => new Date(year, month, 0).getDate();

  // Detect mobile view on resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Prevent background scrolling when any modal is open
  useEffect(() => {
    if (
      isAddEditModalOpen ||
      confirmationModal.isOpen ||
      viewDetailsModal.isOpen ||
      viewUserDetailsModal.isOpen
    ) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [
    isAddEditModalOpen,
    confirmationModal.isOpen,
    viewDetailsModal.isOpen,
    viewUserDetailsModal.isOpen,
  ]);

  // Fetch all subscription templates
  const fetchSubscriptions = useCallback(async () => {
    setLoading(true);
    setError("");
    const traceId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : generateUUID();
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        setError("Authentication required. Please log in.");
        setTimeout(
          () =>
            window.dispatchEvent(
              new CustomEvent("navigate", {
                detail: { path: "/login", replace: true },
              })
            ),
          2000
        );
        return;
      }
      const response = await api.get("/api/subscriptions/templates", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Trace-Id": traceId,
        },
        withCredentials: true,
      });
      if (response.data.success && Array.isArray(response.data.data)) {
        logger.debug("Subscription templates fetched", {
          traceId,
          data: response.data,
        });
        setSubscriptions(response.data.data);
        setError("");
      } else {
        setSubscriptions([]);
        setError("No subscription templates found.");
      }
    } catch (err) {
      logger.error("Error fetching subscription templates", {
        traceId,
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
      });
      setError(
        err.response?.data?.message || "Failed to fetch subscription templates."
      );
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch all users and filter for active subscribers
  const fetchSubscribedUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    const traceId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : generateUUID();
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        setError("Authentication required. Please log in.");
        setTimeout(
          () =>
            window.dispatchEvent(
              new CustomEvent("navigate", {
                detail: { path: "/login", replace: true },
              })
            ),
          2000
        );
        return;
      }
      const response = await api.get("/api/subscriptions/admin/users", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Trace-Id": traceId,
        },
        withCredentials: true,
      });
      if (response.data.success && Array.isArray(response.data.data)) {
        logger.debug("Subscribed users fetched", {
          traceId,
          data: response.data,
        });
        setSubscribedUsers(response.data.data);
        setError("");
      } else {
        setSubscribedUsers([]);
        setError("No users found.");
      }
    } catch (err) {
      logger.error("Error fetching subscribed users", {
        traceId,
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
      });
      setError(err.response?.data?.message || "Failed to fetch users.");
      setSubscribedUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch metrics using backend endpoints
  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    const traceId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : generateUUID();
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        setError("Authentication required. Please log in.");
        setTimeout(
          () =>
            window.dispatchEvent(
              new CustomEvent("navigate", {
                detail: { path: "/login", replace: true },
              })
            ),
          2000
        );
        return;
      }
      const totalResponse = await api.get(
        `/api/subscriptions/admin/subscribers/year?year=${selectedYear}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "X-Trace-Id": traceId,
          },
          withCredentials: true,
        }
      );
      const recentResponse = await api.get(
        `/api/subscriptions/admin/subscribers/month?year=${selectedYear}&month=${selectedMonth}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "X-Trace-Id": traceId,
          },
          withCredentials: true,
        }
      );

      const totalSubscribers = totalResponse.data.success
        ? totalResponse.data.total || 0
        : 0;
      const totalSubscribersData = totalResponse.data.success
        ? totalResponse.data.history || Array(12).fill(0)
        : Array(12).fill(0);
      const totalSubscribersSubtotals = totalResponse.data.success
        ? totalResponse.data.history || Array(12).fill(0)
        : Array(12).fill(0);
      const recentSubscribers = recentResponse.data.success
        ? recentResponse.data.recent || 0
        : 0;
      const recentSubscribersData = recentResponse.data.success
        ? recentResponse.data.weekly || Array(4).fill(0)
        : Array(4).fill(0);
      const recentSubscribersSubtotals = recentResponse.data.success
        ? recentResponse.data.weekly || Array(4).fill(0)
        : Array(4).fill(0);

      logger.debug("Metrics fetched", {
        traceId,
        totalSubscribers,
        recentSubscribers,
      });

      setMetrics({
        totalSubscribers,
        recentSubscribers,
        totalSubscribersData,
        recentSubscribersSubtotals,
        recentSubscribersData,
        totalSubscribersSubtotals,
      });
    } catch (err) {
      logger.error("Error fetching metrics", {
        traceId,
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
      });
      setMetrics({
        totalSubscribers: 0,
        recentSubscribers: 0,
        totalSubscribersData: Array(12).fill(0),
        recentSubscribersData: Array(4).fill(0),
        totalSubscribersSubtotals: Array(12).fill(0),
        recentSubscribersSubtotals: Array(4).fill(0),
      });
      setError(
        err.response?.data?.message || "Failed to fetch subscriber metrics."
      );
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  // Search subscribers client-side
  const searchSubscribers = useCallback(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const filteredUsers = subscribedUsers.filter(
        (user) =>
          user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          user.email?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setSearchResults(filteredUsers);
      setError(
        filteredUsers.length === 0
          ? "No subscribers found with this name/email."
          : ""
      );
    } catch (err) {
      logger.error("Error in client-side search", { message: err.message });
      setError("Failed to search subscribers.");
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, subscribedUsers]);

  // Clear search
  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setError("");
  };

  // Handle Enter key press for search
  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      searchSubscribers();
    }
  };

  // Open confirmation modal
  const openConfirmationModal = (message, onConfirm) => {
    setConfirmationModal({ isOpen: true, message, onConfirm });
  };

  // Close confirmation modal
  const closeConfirmationModal = () => {
    setConfirmationModal({ isOpen: false, message: "", onConfirm: null });
  };

  // Open view details modal for subscriptions
  const openViewDetailsModal = (subscription) => {
    setViewDetailsModal({ isOpen: true, subscription });
  };

  // Close view details modal for subscriptions
  const closeViewDetailsModal = () => {
    setViewDetailsModal({ isOpen: false, subscription: null });
  };

  // Open view details modal for users
  const openViewUserDetailsModal = (user) => {
    setViewUserDetailsModal({ isOpen: true, user });
  };

  // Close view details modal for users
  const closeViewUserDetailsModal = () => {
    setViewUserDetailsModal({ isOpen: false, user: null });
  };

  // Handle subscription activation/renewal
  const handleActivateSubscription = useCallback(
    async (userId, subscriptionId) => {
      if (!userId || !subscriptionId) {
        logger.error("Invalid parameters for activation", {
          userId,
          subscriptionId,
        });
        setError("Invalid user or subscription ID.");
        return;
      }
      if (typeof subscriptionId !== "string" || subscriptionId.trim() === "") {
        logger.error("subscriptionId must be a valid string", {
          subscriptionId,
        });
        setError("Invalid subscription ID format.");
        return;
      }

      openConfirmationModal(
        `Are you sure you want to activate/renew this subscription?`,
        async () => {
          setLoading(true);
          setError("");
          const traceId =
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : generateUUID();
          try {
            const accessToken = localStorage.getItem("accessToken");
            if (!accessToken) {
              setError("Authentication required. Please log in.");
              setTimeout(
                () =>
                  window.dispatchEvent(
                    new CustomEvent("navigate", {
                      detail: { path: "/login", replace: true },
                    })
                  ),
                2000
              );
              return;
            }
            const response = await api.post(
              "/api/subscriptions/admin/subscription/activate",
              { userId, subscriptionId },
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "X-Trace-Id": traceId,
                },
                withCredentials: true,
              }
            );
            if (response.data.success) {
              const updatedUser = response.data.data;
              logger.debug("Subscription activated/renewed", {
                traceId,
                userId,
                subscriptionId,
              });
              setSubscribedUsers((prev) =>
                prev.map((user) =>
                  user.userId === userId
                    ? {
                        ...user,
                        subscriptionId: updatedUser.subscriptionId,
                        subscriptionName: updatedUser.name,
                        subscriptionType: updatedUser.subscriptionType, // Updated to subscriptionType
                        subscriptionStatus: updatedUser.status,
                        startDate: updatedUser.startDate,
                        endDate: updatedUser.endDate,
                        duration:
                          subscriptions.find(
                            (sub) =>
                              sub.subscriptionId === updatedUser.subscriptionId
                          )?.duration ||
                          updatedUser.duration ||
                          null, // Fallback to updatedUser.duration
                        newPrice: updatedUser.newPrice,
                      }
                    : user
                )
              );
              setSearchResults((prev) =>
                prev.map((user) =>
                  user.userId === userId
                    ? {
                        ...user,
                        subscriptionId: updatedUser.subscriptionId,
                        subscriptionName: updatedUser.name,
                        subscriptionType: updatedUser.subscriptionType, // Updated to subscriptionType
                        subscriptionStatus: updatedUser.status,
                        startDate: updatedUser.startDate,
                        endDate: updatedUser.endDate,
                        duration:
                          subscriptions.find(
                            (sub) =>
                              sub.subscriptionId === updatedUser.subscriptionId
                          )?.duration ||
                          updatedUser.duration ||
                          null, // Fallback to updatedUser.duration
                        newPrice: updatedUser.newPrice,
                      }
                    : user
                )
              );
              setSuccess("Subscription activated/renewed successfully.");
              setError("");
              await fetchMetrics();
              window.dispatchEvent(new CustomEvent("subscription-updated")); // Notify dashboard
            } else {
              logger.error("Activation failed", {
                traceId,
                errorCode: response.data.errorCode,
                message: response.data.message,
              });
              setError(
                `${response.data.errorCode || "Error"}: ${
                  response.data.message || "Failed to activate subscription."
                }`
              );
              await fetchSubscribedUsers();
              await fetchMetrics();
            }
          } catch (err) {
            logger.error("Error activating subscription", {
              traceId,
              message: err.message,
              errorCode: err.response?.data?.errorCode,
              response: err.response?.data,
              status: err.response?.status,
            });
            setError(
              `${err.response?.data?.errorCode || "Error"}: ${
                err.response?.data?.message ||
                "Failed to activate subscription."
              }`
            );
            await fetchSubscribedUsers();
            await fetchMetrics();
          } finally {
            setLoading(false);
            closeConfirmationModal();
          }
        }
      );
    },
    [
      fetchSubscribedUsers,
      fetchMetrics,
      subscriptions,
      setError,
      setLoading,
      setSuccess,
      setSubscribedUsers,
      setSearchResults,
      openConfirmationModal,
      closeConfirmationModal,
    ]
  );

  // Handle subscription cancellation
  const handleCancelSubscription = useCallback(
    async (userId, subscriptionId) => {
      if (!userId || !subscriptionId) {
        logger.error("Invalid parameters for cancellation", {
          userId,
          subscriptionId,
        });
        setError("Invalid user or subscription ID.");
        return;
      }

      openConfirmationModal(
        `Are you sure you want to cancel this subscription?`,
        async () => {
          setLoading(true);
          setError("");
          const traceId =
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : generateUUID();
          try {
            const accessToken = localStorage.getItem("accessToken");
            if (!accessToken) {
              setError("Authentication required. Please log in.");
              setTimeout(
                () =>
                  window.dispatchEvent(
                    new CustomEvent("navigate", {
                      detail: { path: "/login", replace: true },
                    })
                  ),
                2000
              );
              return;
            }
            const response = await api.post(
              "/api/subscriptions/admin/subscription/cancel",
              { userId, subscriptionId },
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "X-Trace-Id": traceId,
                },
                withCredentials: true,
              }
            );
            if (response.data.success) {
              const updatedUser = response.data.data;
              logger.debug("Subscription canceled", {
                traceId,
                userId,
                subscriptionId,
              });
              if (!updatedUser) {
                logger.error(
                  "No updated user data returned in cancellation response",
                  { traceId }
                );
                setError(
                  "Failed to retrieve updated user data after cancellation."
                );
                await fetchSubscribedUsers();
                await fetchMetrics();
                return;
              }
              setSubscribedUsers((prev) =>
                prev.map((user) =>
                  user.userId === userId
                    ? {
                        ...user,
                        subscriptionId: updatedUser.subscriptionId || null,
                        subscriptionName: updatedUser.name || null,
                        subscriptionType: updatedUser.subscriptionType || null, // Updated to subscriptionType
                        subscriptionStatus: updatedUser.status || "cancelled",
                        startDate: updatedUser.startDate || null,
                        endDate: updatedUser.endDate || null,
                        duration: updatedUser.duration || null,
                        newPrice: updatedUser.newPrice || null,
                      }
                    : user
                )
              );
              setSearchResults((prev) =>
                prev.map((user) =>
                  user.userId === userId
                    ? {
                        ...user,
                        subscriptionId: updatedUser.subscriptionId || null,
                        subscriptionName: updatedUser.name || null,
                        subscriptionType: updatedUser.subscriptionType || null, // Updated to subscriptionType
                        subscriptionStatus: updatedUser.status || "cancelled",
                        startDate: updatedUser.startDate || null,
                        endDate: updatedUser.endDate || null,
                        duration: updatedUser.duration || null,
                        newPrice: updatedUser.newPrice || null,
                      }
                    : user
                )
              );
              setSuccess("Subscription canceled successfully.");
              setError("");
              await fetchMetrics();
              window.dispatchEvent(new CustomEvent("subscription-updated")); // Notify dashboard
            } else {
              logger.error("Cancellation failed", {
                traceId,
                errorCode: response.data.errorCode,
                message: response.data.message,
              });
              setError(
                `${response.data.errorCode || "Error"}: ${
                  response.data.message || "Failed to cancel subscription."
                }`
              );
              await fetchSubscribedUsers();
              await fetchMetrics();
            }
          } catch (err) {
            logger.error("Error canceling subscription", {
              traceId,
              message: err.message,
              errorCode: err.response?.data?.errorCode,
              response: err.response?.data,
              status: err.response?.status,
              userId,
              subscriptionId,
            });
            setError(
              `${err.response?.data?.errorCode || "Error"}: ${
                err.response?.data?.message || "Failed to cancel subscription."
              }`
            );
            await fetchSubscribedUsers();
            await fetchMetrics();
          } finally {
            setLoading(false);
            closeConfirmationModal();
          }
        }
      );
    },
    [
      fetchSubscribedUsers,
      fetchMetrics,
      subscriptions,
      setError,
      setLoading,
      setSuccess,
      setSubscribedUsers,
      setSearchResults,
      openConfirmationModal,
      closeConfirmationModal,
    ]
  );

  // Delete subscription template
  const deleteSubscription = async (subscriptionId) => {
    if (!subscriptionId) {
      logger.error("Subscription ID is undefined", { subscriptionId });
      setError("Cannot delete subscription: Invalid ID.");
      return;
    }

    openConfirmationModal(
      "Are you sure you want to delete this subscription template?",
      async () => {
        setLoading(true);
        setError("");
        const traceId =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : generateUUID();
        try {
          const accessToken = localStorage.getItem("accessToken");
          if (!accessToken) {
            setError("Authentication required. Please log in.");
            setTimeout(
              () =>
                window.dispatchEvent(
                  new CustomEvent("navigate", {
                    detail: { path: "/login", replace: true },
                  })
                ),
              2000
            );
            return;
          }
          const response = await api.delete(
            `/api/subscriptions/admin/template/${subscriptionId}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "X-Trace-Id": traceId,
              },
              withCredentials: true,
            }
          );
          if (response.data.success) {
            logger.debug("Subscription template deleted", {
              traceId,
              subscriptionId,
            });
            await fetchSubscriptions();
            setSuccess("Subscription template deleted successfully.");
            setError("");
            window.dispatchEvent(new CustomEvent("subscription-updated")); // Notify dashboard
          } else {
            logger.error("Failed to delete subscription template", {
              traceId,
              message: response.data.message,
            });
            setError(
              response.data.message || "Failed to delete subscription template."
            );
          }
        } catch (err) {
          logger.error("Error deleting subscription template", {
            traceId,
            status: err.response?.status,
            data: err.response?.data,
            message: err.message,
          });
          setError(
            err.response?.data?.message ||
              "Failed to delete subscription template."
          );
        } finally {
          setLoading(false);
          closeConfirmationModal();
        }
      }
    );
  };

  // Open modal for adding new subscription
  const openAddModal = () => {
    setIsAddEditModalOpen(true);
    setIsEditing(false);
    setNewSubscription({
      name: "",
      type: "",
      newPrice: "",
      oldPrice: "",
      features: [],
      tag: "",
      duration: 30,
    });
  };

  // Open modal for editing subscription
  const openEditModal = (subscription) => {
    if (!subscription.subscriptionId) {
      logger.error("Subscription ID is missing in edit modal", {
        subscription,
      });
      setError("Cannot edit subscription: Invalid ID.");
      return;
    }

    openConfirmationModal(
      `Are you sure you want to edit this subscription template?`,
      () => {
        setIsAddEditModalOpen(true);
        setIsEditing(true);
        setEditingSubscriptionId(subscription.subscriptionId);
        setNewSubscription({
          name: subscription.name || "",
          type: subscription.type || "",
          newPrice: subscription.newPrice
            ? String(Math.floor(subscription.newPrice))
            : "",
          oldPrice: subscription.oldPrice
            ? String(Math.floor(subscription.oldPrice))
            : "",
          features: Array.isArray(subscription.features)
            ? subscription.features
            : [],
          tag: subscription.tag || "",
          duration: subscription.duration || 30,
        });
        closeConfirmationModal();
      }
    );
  };

  // Close add/edit modal
  const closeAddEditModal = () => {
    setIsAddEditModalOpen(false);
    setIsEditing(false);
    setEditingSubscriptionId(null);
    setNewSubscription({
      name: "",
      type: "",
      newPrice: "",
      oldPrice: "",
      features: [],
      tag: "",
      duration: 30,
    });
  };

  // Handle form input change
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    if (["newPrice", "oldPrice"].includes(name)) {
      const parsedValue = value === "" ? "" : Math.floor(Number(value));
      setNewSubscription((prev) => ({ ...prev, [name]: String(parsedValue) }));
    } else {
      setNewSubscription((prev) => ({ ...prev, [name]: value }));
    }
  };

  // Handle features input change
  const handleFeaturesChange = (e) => {
    const textarea = featuresTextareaRef.current;
    const startPos = textarea.selectionStart;
    const input = e.target.value;

    const features = input
      .split(",")
      .map((feature) => feature.trim())
      .filter((feature) => feature.length > 0);

    setNewSubscription((prev) => ({ ...prev, features }));

    setTimeout(() => {
      const newValue = features.join(", ");
      const newPos = Math.min(startPos, newValue.length);
      textarea.selectionStart = newPos;
      textarea.selectionEnd = newPos;
    }, 0);
  };

  // Validate form inputs
  const validateForm = () => {
    if (!newSubscription.name.trim()) return "Name is required.";
    if (!newSubscription.type) return "Type is required.";
    if (
      !newSubscription.newPrice ||
      isNaN(newSubscription.newPrice) ||
      Number(newSubscription.newPrice) < 0 ||
      !Number.isInteger(Number(newSubscription.newPrice))
    )
      return "Valid integer new price is required.";
    if (
      !newSubscription.oldPrice ||
      isNaN(newSubscription.oldPrice) ||
      Number(newSubscription.oldPrice) < 0 ||
      !Number.isInteger(Number(newSubscription.oldPrice))
    )
      return "Valid integer old price is required.";
    if (!newSubscription.features.length)
      return "At least one feature is required.";
    if (![30, 180, 365].includes(Number(newSubscription.duration)))
      return "Duration must be 30, 180, or 365 days.";
    return null;
  };

  // Add new subscription template
  const addSubscription = async (e) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    setError("");
    const traceId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : generateUUID();
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        setError("Authentication required. Please log in.");
        setTimeout(
          () =>
            window.dispatchEvent(
              new CustomEvent("navigate", {
                detail: { path: "/login", replace: true },
              })
            ),
          2000
        );
        return;
      }
      const response = await api.post(
        "/api/subscriptions/admin/template",
        {
          name: newSubscription.name,
          type: newSubscription.type,
          newPrice: Number(newSubscription.newPrice),
          oldPrice: Number(newSubscription.oldPrice),
          features: newSubscription.features,
          tag: newSubscription.tag,
          duration: Number(newSubscription.duration),
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "X-Trace-Id": traceId,
          },
          withCredentials: true,
        }
      );
      if (response.data.success) {
        logger.debug("Subscription template added", { traceId });
        await fetchSubscriptions();
        setSuccess("Subscription template added successfully.");
        closeAddEditModal();
        window.dispatchEvent(new CustomEvent("subscription-updated")); // Notify dashboard
      } else {
        logger.error("Failed to add subscription template", {
          traceId,
          message: response.data.message,
        });
        setError(
          response.data.message || "Failed to add subscription template."
        );
      }
    } catch (err) {
      logger.error("Error adding subscription template", {
        traceId,
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
      });
      setError(
        err.response?.data?.message || "Failed to add subscription template."
      );
    } finally {
      setLoading(false);
    }
  };

  // Update existing subscription template
  const updateSubscription = async (e) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    setError("");
    const traceId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : generateUUID();
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        setError("Authentication required. Please log in.");
        setTimeout(
          () =>
            window.dispatchEvent(
              new CustomEvent("navigate", {
                detail: { path: "/login", replace: true },
              })
            ),
          2000
        );
        return;
      }
      const response = await api.put(
        `/api/subscriptions/admin/template/${editingSubscriptionId}`,
        {
          name: newSubscription.name,
          type: newSubscription.type,
          newPrice: Number(newSubscription.newPrice),
          oldPrice: Number(newSubscription.oldPrice),
          features: newSubscription.features,
          tag: newSubscription.tag,
          duration: Number(newSubscription.duration),
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "X-Trace-Id": traceId,
          },
          withCredentials: true,
        }
      );
      if (response.data.success) {
        logger.debug("Subscription template updated", {
          traceId,
          subscriptionId: editingSubscriptionId,
        });
        await fetchSubscriptions();
        setSuccess("Subscription template updated successfully.");
        closeAddEditModal();
        window.dispatchEvent(new CustomEvent("subscription-updated")); // Notify dashboard
      } else {
        logger.error("Failed to update subscription template", {
          traceId,
          message: response.data.message,
        });
        setError(
          response.data.message || "Failed to update subscription template."
        );
      }
    } catch (err) {
      logger.error("Error updating subscription template", {
        traceId,
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
      });
      setError(
        err.response?.data?.message || "Failed to update subscription template."
      );
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on mount and when dependencies change
  useEffect(() => {
    if (!BASE_URL) {
      setError("Backend URL is not configured.");
      return;
    }
    fetchSubscriptions();
    fetchSubscribedUsers();
    fetchMetrics();
  }, [fetchSubscriptions, fetchSubscribedUsers, fetchMetrics, BASE_URL]);

  // Fetch metrics when selectedYear or selectedMonth changes
  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics, selectedYear, selectedMonth]);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Chart data for Total Subscribers (Line Chart)
  const totalSubscribersChartData = {
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
        label: "Total Subscribers",
        data: metrics.totalSubscribersData,
        borderColor: "#10b981",
        backgroundColor: "rgba(16, 185, 129, 0.2)",
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  // Chart data for Recent Subscribers (Bar Chart)
  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
  const weekLabels = Array.from(
    { length: Math.ceil(daysInMonth / 7) },
    (_, i) => `Week ${i + 1}`
  );
  const recentSubscribersChartData = {
    labels: weekLabels,
    datasets: [
      {
        label: "Recent Subscribers",
        data: metrics.recentSubscribersData.slice(0, weekLabels.length),
        backgroundColor: "#10b981",
        borderColor: "#059669",
        borderWidth: 1,
      },
    ],
  };

  // Chart options for Total Subscribers (Line Chart)
  const totalSubscribersChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        mode: "index",
        intersect: false,
        backgroundColor: "#1f2937",
        titleColor: "#e5e7eb",
        bodyColor: "#e5e7eb",
        borderColor: "#374151",
        borderWidth: 1,
        callbacks: {
          label: (context) => `${context.parsed.y} subscribers`,
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: "#e5e7eb",
          maxTicksLimit: isMobile ? 6 : 12,
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
            if (isMobile) {
              if (index % 2 === 0) {
                return labels[index];
              }
              return "";
            }
            return labels[index];
          },
        },
        grid: { display: false },
      },
      y: {
        ticks: {
          color: "#e5e7eb",
          stepSize: 1,
          callback: (value) => (Number.isInteger(value) ? value : ""),
        },
        maxRotation: 45,
        minRotation: 45,
    
        grid: { color: "#374151" },
        min: 0,
        max:
          Math.max(
            ...metrics.totalSubscribersData,
            ...metrics.recentSubscribersData,
            1
          ) * 1.5,
      },
    },
    animation: {
      duration: 1000,
      easing: "easeOutQuart",
    },
  };

  // Chart options for Recent Subscribers (Bar Chart)
  const recentSubscribersChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        mode: "index",
        intersect: false,
        backgroundColor: "#1f2937",
        titleColor: "#e5e7eb",
        bodyColor: "#e5e7eb",
        borderColor: "#374151",
        borderWidth: 1,
        callbacks: {
          label: (context) => `${context.parsed.y} subscribers`,
        },
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
          color: "#e5e7eb",
          stepSize: 1,
          callback: (value) => (Number.isInteger(value) ? value : ""),
        },
        grid: { color: "#374151" },
        min: 0,
        max:
          Math.max(
            ...metrics.totalSubscribersData,
            ...metrics.recentSubscribersData,
            1
          ) * 1.5,
      },
    },
    animation: {
      duration: 1000,
      easing: "easeOutQuart",
    },
  };

  return (
    <div className="admin-subscription-management-container">
      <h1 className="admin-subscription-management-title">
        Subscription Management
      </h1>

      {success && (
        <div className="admin-subscription-management-success">
          {success}
          <button
            onClick={() => setSuccess("")}
            className="admin-subscription-management-dismiss-button"
            aria-label="Dismiss success message"
          >
            ✕
          </button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="admin-subscription-management-metrics">
        <div className="admin-subscription-management-metric-card">
          <div className="admin-subscription-management-metric-header">
            <div className="admin-subscription-management-metric-title">
              Total Subscribers
            </div>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="admin-subscription-management-dropdown"
              aria-label="Select year for total subscribers"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-subscription-management-metric-value">
            {metrics.totalSubscribers}
          </div>

          <div className="admin-subscription-management-metric-chart">
            <Line
              data={totalSubscribersChartData}
              options={totalSubscribersChartOptions}
            />
          </div>
        </div>
        <div className="admin-subscription-management-metric-card">
          <div className="admin-subscription-management-metric-header">
            <div className="admin-subscription-management-metric-title">
              Recent Subscribers
            </div>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="admin-subscription-management-dropdown"
              aria-label="Select month for recent subscribers"
            >
              {months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-subscription-management-metric-value">
            {metrics.recentSubscribers}
          </div>

          <div className="admin-subscription-management-metric-chart">
            <Bar
              data={recentSubscribersChartData}
              options={recentSubscribersChartOptions}
            />
          </div>
        </div>
      </div>

      {/* Search Section */}
      <div className="admin-subscription-management-search-section">
        <svg
          className="admin-subscription-management-search-icon"
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
          placeholder="Search user by name or email"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="admin-subscription-management-search-input"
          aria-label="Search users by name or email"
        />
        {searchQuery && (
          <button
            onClick={clearSearch}
            className="admin-subscription-management-action-button clear"
            aria-label="Clear search"
          >
            Clear
          </button>
        )}
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="admin-subscription-management-search-results">
          <h2 className="admin-subscription-management-search-results-title">
            Search Results
          </h2>
          {loading ? (
            <div className="admin-subscription-management-skeleton-table">
              {Array(5)
                .fill()
                .map((_, index) => (
                  <div
                    key={index}
                    className="admin-subscription-management-skeleton-row"
                  >
                    <div className="admin-subscription-management-skeleton-cell" />
                    <div className="admin-subscription-management-skeleton-cell" />
                    <div className="admin-subscription-management-skeleton-cell" />
                    <div className="admin-subscription-management-skeleton-cell" />
                    <div className="admin-subscription-management-skeleton-cell" />
                  </div>
                ))}
            </div>
          ) : (
            <table className="admin-subscription-management-search-results-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Subscription</th>
                  <th>Status</th>
                  <th className="action-head">Actions</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.map((user) => (
                  <tr key={user.userId}>
                    <td data-label="Name">{user.name || "N/A"}</td>
                    <td data-label="Email">{user.email || "N/A"}</td>
                    <td data-label="Subscription">
                      {user.subscriptionName || "N/A"}
                    </td>
                    <td data-label="Status">
                      {user.subscriptionStatus || "N/A"}
                    </td>
                    <td
                      data-label="Actions"
                      className="admin-subscription-management-actions"
                    >
                      <button
                        onClick={() => openViewUserDetailsModal(user)}
                        disabled={loading}
                        className="admin-subscription-management-action-button view"
                        aria-label={`View details for ${user.email}`}
                      >
                        View Details
                      </button>
                      <select
                        onChange={(e) =>
                          handleActivateSubscription(
                            user.userId,
                            e.target.value
                          )
                        }
                        className="admin-subscription-management-action-button activate"
                        aria-label={`Activate subscription for ${user.email}`}
                        disabled={loading}
                      >
                        <option value="">Activate</option>
                        {subscriptions.map((sub) => (
                          <option
                            key={sub.subscriptionId}
                            value={sub.subscriptionId}
                          >
                            {sub.name} ({sub.type})
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() =>
                          handleCancelSubscription(
                            user.userId,
                            user.subscriptionId
                          )
                        }
                        disabled={
                          loading ||
                          !user.subscriptionId ||
                          user.subscriptionStatus !== "active"
                        }
                        className="admin-subscription-management-action-button cancel"
                        aria-label={`Cancel subscription for ${user.email}`}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() =>
                          handleActivateSubscription(
                            user.userId,
                            user.subscriptionId
                          )
                        }
                        disabled={
                          loading ||
                          !user.subscriptionId ||
                          user.subscriptionStatus !== "active"
                        }
                        className="admin-subscription-management-action-button extend"
                        aria-label={`Renew subscription for ${user.email}`}
                      >
                        Renew
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Error and Success Messages */}
      {error && (
        <div className="admin-subscription-management-error">{error}</div>
      )}

      {/* Add New Subscription Button */}
      <div className="admin-subscription-management-actions add-new-template-pri">
        <button
          onClick={openAddModal}
          className="admin-subscription-management-action-button add"
          aria-label="Add new subscription template"
          disabled={loading}
        >
          Add New Subscription Template
        </button>
      </div>

      {/* Modal for Add/Edit Subscription */}
      {isAddEditModalOpen && (
        <div className="admin-subscription-management-modal">
          <div className="admin-subscription-management-modal-content">
            <link
              href="https://fonts.googleapis.com/icon?family=Material+Icons"
              rel="stylesheet"
            />
            <span
              className="admin-subscription-management-modal-close"
              onClick={closeAddEditModal}
              aria-label="Close modal"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && closeAddEditModal()}
            >
              <span className="material-icons" style={{ fontSize: "20px" }}>
                close
              </span>
            </span>
            <h2>
              {isEditing
                ? "Edit Subscription Template"
                : "Add New Subscription Template"}
            </h2>
            <form onSubmit={isEditing ? updateSubscription : addSubscription}>
              <div>
                <label htmlFor="name">Name:</label>
                <select
                  id="name"
                  name="name"
                  value={newSubscription.name}
                  onChange={handleFormChange}
                  required
                  aria-label="Subscription name"
                >
                  <option value="">Select Name</option>
                  <option value="Basic Plan">Basic Plan</option>
                  <option value="Pro Plan">Pro Plan</option>
                  <option value="Premium Plan">Premium Plan</option>
                  <option value="Team Plan">Team Plan</option>
                  <option value="Gift Plan">Gift Plan</option>
                </select>
              </div>
              <div>
                <label htmlFor="type">Type:</label>
                <select
                  id="type"
                  name="type"
                  value={newSubscription.type}
                  onChange={handleFormChange}
                  required
                  aria-label="Subscription type"
                >
                  <option value="">Select Type</option>
                  <option value="Personal">Personal</option>
                  <option value="Team">Team</option>
                  <option value="Gift">Gift</option>
                </select>
              </div>
              <div>
                <label htmlFor="oldPrice">Old Price:</label>
                <input
                  type="number"
                  id="oldPrice"
                  name="oldPrice"
                  value={newSubscription.oldPrice}
                  onChange={handleFormChange}
                  required
                  min="0"
                  step="1"
                  aria-label="Old price (integer)"
                />
              </div>
              <div>
                <label htmlFor="newPrice">New Price:</label>
                <input
                  type="number"
                  id="newPrice"
                  name="newPrice"
                  value={newSubscription.newPrice}
                  onChange={handleFormChange}
                  required
                  min="0"
                  step="1"
                  aria-label="New price (integer)"
                />
              </div>
              <div>
                <label htmlFor="features">Features (comma-separated):</label>
                <textarea
                  id="features"
                  name="features"
                  ref={featuresTextareaRef}
                  value={newSubscription.features.join(", ")}
                  onChange={handleFeaturesChange}
                  required
                  aria-label="Features"
                  aria-describedby="features-help"
                  placeholder="e.g., Unlimited Storage, Priority Support, Advanced Analytics"
                />
              </div>
              <div>
                <label htmlFor="tag">Tag (optional):</label>
                <input
                  type="text"
                  id="tag"
                  name="tag"
                  value={newSubscription.tag}
                  onChange={handleFormChange}
                  aria-label="Tag"
                />
              </div>
              <div>
                <label htmlFor="duration">Duration (days):</label>
                <select
                  id="duration"
                  name="duration"
                  value={newSubscription.duration}
                  onChange={handleFormChange}
                  required
                  aria-label="Duration in days"
                >
                  <option value="30">30 days</option>
                  <option value="180">180 days</option>
                  <option value="365">365 days</option>
                </select>
              </div>
              <div className="admin-subscription-management-actions">
                <button
                  type="submit"
                  disabled={loading}
                  className="admin-subscription-management-action-button add-new-template-sec"
                  aria-label={
                    isEditing
                      ? "Update subscription template"
                      : "Add subscription template"
                  }
                >
                  {loading ? (
                    <span className="subscription-spinner"></span>
                  ) : null}
                  {isEditing ? "Update" : "Add Template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmationModal.isOpen && (
        <div className="admin-subscription-management-confirmation-modal">
          <div className="admin-subscription-management-confirmation-modal-content">
            <p>{confirmationModal.message}</p>
            <div className="admin-subscription-management-confirmation-actions">
              <button
                onClick={confirmationModal.onConfirm}
                className="admin-subscription-management-action-button confirm"
                aria-label="Confirm action"
                disabled={loading}
              >
                {loading ? (
                  <span>
                    <span className="subscription-spinner"></span>Confirming...
                  </span>
                ) : (
                  "Confirm"
                )}
              </button>
              <button
                onClick={closeConfirmationModal}
                className="admin-subscription-management-action-button cancel"
                aria-label="Cancel action"
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal for Subscriptions */}
      {viewDetailsModal.isOpen && viewDetailsModal.subscription && (
        <div className="admin-subscription-management-modal">
          <div className="admin-subscription-management-modal-content">
            <link
              href="https://fonts.googleapis.com/icon?family=Material+Icons"
              rel="stylesheet"
            />
            <span
              className="admin-subscription-management-modal-close"
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
            <h2>Subscription Details</h2>
            <div className="admin-subscription-management-details">
              <p>
                <strong>Name:</strong> {viewDetailsModal.subscription.name}
              </p>
              <p>
                <strong>Type:</strong> {viewDetailsModal.subscription.type}
              </p>
              <p>
                <strong>New Price:</strong>{" "}
                {Math.floor(viewDetailsModal.subscription.newPrice)}
              </p>
              <p>
                <strong>Old Price:</strong>{" "}
                {Math.floor(viewDetailsModal.subscription.oldPrice)}
              </p>
              <p>
                <strong>Duration:</strong>{" "}
                {viewDetailsModal.subscription.duration} days
              </p>
              <p>
                <strong>Features:</strong>{" "}
                {viewDetailsModal.subscription.features.join(", ")}
              </p>
              <p>
                <strong>Tag:</strong>{" "}
                {viewDetailsModal.subscription.tag || "N/A"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal for Users */}
      {viewUserDetailsModal.isOpen && viewUserDetailsModal.user && (
        <div className="admin-subscription-management-modal">
          <div className="admin-subscription-management-modal-content">
            <link
              href="https://fonts.googleapis.com/icon?family=Material+Icons"
              rel="stylesheet"
            />
            <span
              className="admin-subscription-management-modal-close"
              onClick={closeViewUserDetailsModal}
              aria-label="Close modal"
              role="button"
              tabIndex={0}
              onKeyDown={(e) =>
                e.key === "Enter" && closeViewUserDetailsModal()
              }
            >
              <span className="material-icons" style={{ fontSize: "20px" }}>
                close
              </span>
            </span>
            <h2>User Subscription Details</h2>
            <div className="admin-subscription-management-details">
              <p>
                <strong>Name:</strong> {viewUserDetailsModal.user.name || "N/A"}
              </p>
              <p>
                <strong>Email:</strong>{" "}
                {viewUserDetailsModal.user.email || "N/A"}
              </p>
              <p>
                <strong>Subscription:</strong>{" "}
                {viewUserDetailsModal.user.subscriptionName || "N/A"}
              </p>
              <p>
                <strong>Status:</strong>{" "}
                {viewUserDetailsModal.user.subscriptionStatus || "N/A"}
              </p>
              <p>
                <strong>Start Date:</strong>{" "}
                {viewUserDetailsModal.user.startDate
                  ? new Date(
                      viewUserDetailsModal.user.startDate
                    ).toLocaleDateString()
                  : "N/A"}
              </p>
              <p>
                <strong>End Date:</strong>{" "}
                {viewUserDetailsModal.user.endDate
                  ? new Date(
                      viewUserDetailsModal.user.endDate
                    ).toLocaleDateString()
                  : "N/A"}
              </p>
              <p>
                <strong>Duration:</strong>{" "}
                {viewUserDetailsModal.user.duration
                  ? `${viewUserDetailsModal.user.duration} days`
                  : "N/A"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Subscriptions Table */}
      {loading ? (
        <div className="admin-subscription-management-skeleton-table">
          {Array(5)
            .fill()
            .map((_, index) => (
              <div
                key={index}
                className="admin-subscription-management-skeleton-row"
              >
                <div className="admin-subscription-management-skeleton-cell" />
                <div className="admin-subscription-management-skeleton-cell" />
                <div className="admin-subscription-management-skeleton-cell" />
                <div className="admin-subscription-management-skeleton-cell" />
                <div className="admin-subscription-management-skeleton-cell" />
                <div className="admin-subscription-management-skeleton-cell" />
                <div className="admin-subscription-management-skeleton-cell" />
              </div>
            ))}
        </div>
      ) : subscriptions.length === 0 ? (
        <p className="admin-subscription-management-empty">
          No subscription templates found.
        </p>
      ) : (
        <table className="admin-subscription-management-subscription-list">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Duration</th>
              <th>Old Price</th>
              <th>New Price</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.map((subscription) => (
              <tr key={subscription.subscriptionId}>
                <td data-label="Name">{subscription.name}</td>
                <td data-label="Type">{subscription.type}</td>
                <td data-label="Duration">{subscription.duration} days</td>

                <td data-label="Old Price">
                  {Math.floor(subscription.oldPrice)}
                </td>
                <td data-label="New Price">
                  {Math.floor(subscription.newPrice)}
                </td>
                <td
                  data-label="Actions"
                  className="admin-subscription-management-actions"
                >
                  <button
                    onClick={() => openViewDetailsModal(subscription)}
                    disabled={loading}
                    className="admin-subscription-management-action-button view"
                    aria-label={`View details of subscription ${subscription.name}`}
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => openEditModal(subscription)}
                    disabled={loading}
                    className="admin-subscription-management-action-button update"
                    aria-label={`Edit subscription ${subscription.name}`}
                  >
                    Update
                  </button>
                  <button
                    onClick={() =>
                      deleteSubscription(subscription.subscriptionId)
                    }
                    disabled={loading || !subscription.subscriptionId}
                    className="admin-subscription-management-action-button delete"
                    aria-label={`Delete subscription ${subscription.name}`}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Subscribed Users Table */}
      {loading ? (
        <div className="admin-subscription-management-skeleton-table">
          {Array(5)
            .fill()
            .map((_, index) => (
              <div
                key={index}
                className="admin-subscription-management-skeleton-row"
              >
                <div className="admin-subscription-management-skeleton-cell" />
                <div className="admin-subscription-management-skeleton-cell" />
                <div className="admin-subscription-management-skeleton-cell" />
                <div className="admin-subscription-management-skeleton-cell" />
                <div className="admin-subscription-management-skeleton-cell" />
              </div>
            ))}
        </div>
      ) : subscribedUsers.length === 0 && !searchResults.length ? (
        <p className="admin-subscription-management-empty">
          No active subscribers found.
        </p>
      ) : (
        <table className="admin-subscription-management-user-list">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Subscription</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {subscribedUsers.map((user) => (
              <tr key={user.userId}>
                <td data-label="Name">{user.name || "N/A"}</td>
                <td data-label="Email">{user.email || "N/A"}</td>
                <td data-label="Subscription">
                  {user.subscriptionName || "N/A"}
                </td>
                <td data-label="Status">{user.subscriptionStatus || "N/A"}</td>
                <td
                  data-label="Actions"
                  className="admin-subscription-management-actions"
                >
                  <button
                    onClick={() => openViewUserDetailsModal(user)}
                    disabled={loading}
                    className="admin-subscription-management-action-button view"
                    aria-label={`View details for ${user.email}`}
                  >
                    View Details
                  </button>
                  <select
                    onChange={(e) =>
                      handleActivateSubscription(user.userId, e.target.value)
                    }
                    className="admin-subscription-management-action-button activate"
                    aria-label={`Activate subscription for ${user.email}`}
                    disabled={loading}
                  >
                    <option value="">Activate</option>
                    {subscriptions.map((sub) => (
                      <option
                        key={sub.subscriptionId}
                        value={sub.subscriptionId}
                      >
                        {sub.name} ({sub.type})
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() =>
                      handleActivateSubscription(
                        user.userId,
                        user.subscriptionId
                      )
                    }
                    disabled={
                      loading ||
                      !user.subscriptionId ||
                      user.subscriptionStatus !== "active"
                    }
                    className="admin-subscription-management-action-button extend"
                    aria-label={`Renew subscription for ${user.email}`}
                  >
                    Renew
                  </button>
                  <button
                    onClick={() =>
                      handleCancelSubscription(user.userId, user.subscriptionId)
                    }
                    disabled={
                      loading ||
                      !user.subscriptionId ||
                      user.subscriptionStatus !== "active"
                    }
                    className="admin-subscription-management-action-button cancel"
                    aria-label={`Cancel subscription for ${user.email}`}
                  >
                    Cancel
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

export default SubscriptionManagement;
