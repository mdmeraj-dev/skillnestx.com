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
  Filler,
} from "chart.js";
import "../styles/TestimonialManagement.css";
import { lazy, Suspense } from "react";

// Lazy load TestimonialForm
const TestimonialForm = lazy(() => import("../forms/TestimonialForm"));

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
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[WARN] ${msg}`, meta);
    }
  },
  debug: (msg, meta) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[DEBUG] ${msg}`, meta);
    }
  },
};

// Simple UUID generator as a fallback for crypto.randomUUID
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Backend URL from environment or fallback
const BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

// Configure Axios with base URL and interceptor
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
      originalRequest.url !== '/api/auth/refresh-token' &&
      originalRequest.url !== '/api/auth/logout'
    ) {
      originalRequest._retry = true;
      const traceId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : generateUUID();
      const isLoggingOut = localStorage.getItem('isLoggingOut') === 'true';
      if (isLoggingOut) {
        logger.debug('Skipping token refresh during logout', { traceId });
        return Promise.reject(error);
      }
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          logger.warn('No refresh token for interceptor', { traceId });
          throw new Error('Missing refresh token');
        }
        logger.debug('Attempting token refresh in interceptor', { traceId });
        const refreshResponse = await api.post(
          '/api/auth/refresh-token',
          { refreshToken },
          {
            headers: {
              'X-Trace-Id': traceId,
              'Content-Type': 'application/json',
            },
          }
        );
        const refreshData = refreshResponse.data;
        if (refreshResponse.status === 200 && refreshData.success) {
          localStorage.setItem('accessToken', refreshData.accessToken);
          localStorage.setItem('refreshToken', refreshData.refreshToken);
          logger.debug('Interceptor refreshed tokens', { traceId });
          originalRequest.headers['Authorization'] = `Bearer ${refreshData.accessToken}`;
          return api(originalRequest);
        }
        logger.warn('Interceptor token refresh failed', {
          traceId,
          status: refreshResponse.status,
          data: refreshData,
        });
        throw new Error('Refresh failed');
      } catch (refreshError) {
        logger.error('Interceptor refresh error', {
          error: refreshError.message,
          traceId,
          response: refreshError.response?.data,
        });
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('profilePicture');
        if (!isLoggingOut) {
          window.dispatchEvent(
            new CustomEvent('navigate', {
              detail: {
                path: '/login',
                state: { error: 'Your authentication has expired. Please log in again.' },
                replace: true,
              },
            })
          );
        } else {
          logger.debug('Suppressing login redirect during logout', { traceId });
        }
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

const TestimonialManagement = () => {
  const [testimonials, setTestimonials] = useState([]);
  const [filteredTestimonials, setFilteredTestimonials] = useState([]);
  const [courseFilter, setCourseFilter] = useState("");
  const [platformFilter, setPlatformFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [selectedTestimonial, setSelectedTestimonial] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  // Initialize metrics with dynamic weeks based on selected month
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const weeksInMonth = Math.ceil(daysInMonth / 7);
  const [metrics, setMetrics] = useState({
    totalTestimonials: 0,
    recentTestimonials: 0,
    totalTestimonialsData: Array(12).fill(0),
    recentTestimonialsData: Array(weeksInMonth).fill(0),
    weekLabels: Array.from(
      { length: weeksInMonth },
      (_, i) => `Week ${i + 1}`
    ),
  });

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
  const platforms = [
    "twitter",
    "linkedin",
    "facebook",
    "instagram",
    "email",
    "github",
    "other",
  ];

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isAdding || selectedTestimonial || deleteConfirmId || isViewing) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isAdding, selectedTestimonial, deleteConfirmId, isViewing]);

  // Detect mobile view on resize
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Fetch all testimonials with optional filters
  const fetchTestimonials = useCallback(async () => {
    setLoading(true);
    setError("");
    const traceId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : generateUUID();
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        setError("Authentication required. Please log in.");
        setTimeout(() => window.dispatchEvent(
          new CustomEvent('navigate', {
            detail: { path: '/login', replace: true },
          })
        ), 2000);
        return;
      }
      const query = new URLSearchParams();
      if (courseFilter) query.append("courseName", courseFilter);
      if (platformFilter) query.append("platform", platformFilter);
      if (roleFilter) query.append("userRole", roleFilter);
      const response = await api.get(`/api/testimonials?${query.toString()}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Trace-Id': traceId,
        },
        withCredentials: true,
      });
      if (response.data.success) {
        logger.debug('Testimonials fetched', { traceId, data: response.data });
        setTestimonials(response.data.data);
        setFilteredTestimonials(response.data.data);
        setError("");
      } else {
        logger.warn('Failed to fetch testimonials', { traceId, message: response.data.message });
        setError(response.data.message || "Failed to fetch testimonials.");
      }
    } catch (err) {
      logger.error('Error fetching testimonials', {
        traceId,
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
      });
      setError(err.response?.data?.message || "Failed to fetch testimonials.");
    } finally {
      setLoading(false);
    }
  }, [courseFilter, platformFilter, roleFilter]);

  // Fetch metrics for total and recent testimonials
  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError("");
    const traceId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : generateUUID();
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        setError("Authentication required. Please log in.");
        setTimeout(() => window.dispatchEvent(
          new CustomEvent('navigate', {
            detail: { path: '/login', replace: true },
          })
        ), 2000);
        return;
      }
      const [totalResponse, recentResponse] = await Promise.all([
        api.get(`/api/testimonials/total?year=${selectedYear}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Trace-Id': traceId,
          },
          withCredentials: true,
        }),
        api.get(`/api/testimonials/recent?year=${selectedYear}&month=${selectedMonth}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Trace-Id': traceId,
          },
          withCredentials: true,
        }),
      ]);

      if (!totalResponse.data.success || !recentResponse.data.success) {
        logger.warn('Invalid metrics response', { traceId, total: totalResponse.data, recent: recentResponse.data });
        throw new Error("Failed to fetch metrics: Invalid response format");
      }

      const totalData = totalResponse.data.data;
      const recentData = recentResponse.data.data;

      // Calculate weeks for the selected month
      const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
      const weeksInMonth = Math.ceil(daysInMonth / 7);
      const weekLabels = Array.from(
        { length: weeksInMonth },
        (_, i) => `Week ${i + 1}`
      );
      // Map weekly data, padding with zeros if backend provides fewer weeks
      const weeklyData = Array(weeksInMonth).fill(0);
      if (recentData.weekly && Array.isArray(recentData.weekly)) {
        recentData.weekly.forEach((count, index) => {
          if (index < weeksInMonth) {
            weeklyData[index] = count;
          }
        });
      }

      logger.debug('Metrics fetched', { traceId, total: totalData, recent: recentData });

      setMetrics({
        totalTestimonials: totalData.total || 0,
        recentTestimonials: recentData.recent || 0,
        totalTestimonialsData: totalData.history || Array(12).fill(0),
        recentTestimonialsData: weeklyData,
        weekLabels: recentData.weekLabels && recentData.weekLabels.length >= weeksInMonth
          ? recentData.weekLabels.slice(0, weeksInMonth)
          : weekLabels,
      });
    } catch (err) {
      logger.error('Error fetching metrics', {
        traceId,
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
        url: err.config?.url,
      });
      if (err.response?.status === 404) {
        setError(`Metrics endpoints not found. Check server routes: ${err.config?.url}`);
      } else {
        setError(err.response?.data?.message || `Failed to fetch metrics: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  // Add a new testimonial
  const handleAddTestimonial = async (testimonialData) => {
    setLoading(true);
    const traceId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : generateUUID();
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        setError("Authentication required. Please log in.");
        setTimeout(() => window.dispatchEvent(
          new CustomEvent('navigate', {
            detail: { path: '/login', replace: true },
          })
        ), 2000);
        return;
      }
      const response = await api.post('/api/testimonials', testimonialData, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Trace-Id': traceId,
        },
        withCredentials: true,
      });
      if (response.data.success) {
        logger.debug('Testimonial added', { traceId, data: response.data });
        setTestimonials((prev) => [...prev, response.data.data]);
        setFilteredTestimonials((prev) => [...prev, response.data.data]);
        setIsAdding(false);
        setSuccess("Testimonial added successfully.");
        setError("");
        fetchMetrics();
      } else {
        logger.warn('Failed to add testimonial', { traceId, message: response.data.message });
        setError(response.data.message || "Failed to add testimonial.");
      }
    } catch (err) {
      logger.error('Error adding testimonial', {
        traceId,
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
      });
      setError(err.response?.data?.message || "Failed to add testimonial.");
    } finally {
      setLoading(false);
    }
  };

  // Update a testimonial
  const handleSaveTestimonial = async (testimonialData) => {
    setLoading(true);
    const traceId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : generateUUID();
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        setError("Authentication required. Please log in.");
        setTimeout(() => window.dispatchEvent(
          new CustomEvent('navigate', {
            detail: { path: '/login', replace: true },
          })
        ), 2000);
        return;
      }
      const response = await api.put(`/api/testimonials/${selectedTestimonial._id}`, testimonialData, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Trace-Id': traceId,
        },
        withCredentials: true,
      });
      if (response.data.success) {
        logger.debug('Testimonial updated', { traceId, id: selectedTestimonial._id });
        setTestimonials((prev) =>
          prev.map((t) =>
            t._id === selectedTestimonial._id ? response.data.data : t
          )
        );
        setFilteredTestimonials((prev) =>
          prev.map((t) =>
            t._id === selectedTestimonial._id ? response.data.data : t
          )
        );
        setSelectedTestimonial(null);
        setSuccess("Testimonial updated successfully.");
        setError("");
        fetchMetrics();
      } else {
        logger.warn('Failed to update testimonial', { traceId, message: response.data.message });
        setError(response.data.message || "Failed to update testimonial.");
      }
    } catch (err) {
      logger.error('Error updating testimonial', {
        traceId,
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
      });
      setError(err.response?.data?.message || "Failed to update testimonial.");
    } finally {
      setLoading(false);
    }
  };

  // Delete a testimonial
  const handleDeleteTestimonial = async (id) => {
    setIsDeleting(true);
    const traceId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : generateUUID();
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        setError("Authentication required. Please log in.");
        setTimeout(() => window.dispatchEvent(
          new CustomEvent('navigate', {
            detail: { path: '/login', replace: true },
          })
        ), 2000);
        return;
      }
      const response = await api.delete(`/api/testimonials/${id}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Trace-Id': traceId,
        },
        withCredentials: true,
      });
      if (response.data.success) {
        logger.debug('Testimonial deleted', { traceId, id });
        setTestimonials((prev) => prev.filter((t) => t._id !== id));
        setFilteredTestimonials((prev) => prev.filter((t) => t._id !== id));
        setSuccess("Testimonial deleted successfully.");
        setError("");
        fetchMetrics();
      } else {
        logger.warn('Failed to delete testimonial', { traceId, message: response.data.message });
        setError(response.data.message || "Failed to delete testimonial.");
      }
    } catch (err) {
      logger.error('Error deleting testimonial', {
        traceId,
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
      });
      setError(err.response?.data?.message || "Failed to delete testimonial.");
    } finally {
      setIsDeleting(false);
      setDeleteConfirmId(null);
    }
  };

  // Handle view details
  const handleViewDetails = (testimonial) => {
    setSelectedTestimonial(testimonial);
    setIsViewing(true);
  };

  // Close view details modal and reset selectedTestimonial
  const handleCloseViewDetails = () => {
    setIsViewing(false);
    setSelectedTestimonial(null);
  };

  // Format createdAt date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });
  };

  // Fetch data on mount and when filters or dropdowns change
  useEffect(() => {
    fetchTestimonials();
    fetchMetrics();
  }, [fetchTestimonials, fetchMetrics]);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Chart data for Total Testimonials (Line Chart)
  const totalTestimonialsChartData = {
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
        label: "Total Testimonials",
        data: metrics.totalTestimonialsData,
        borderColor: "#3b4a68",
        backgroundColor: "rgba(59, 74, 104, 0.2)",
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  // Chart data for Recent Testimonials (Bar Chart)
  const recentTestimonialsChartData = {
    labels: metrics.weekLabels,
    datasets: [
      {
        label: "Recent Testimonials",
        data: metrics.recentTestimonialsData,
        backgroundColor: "#3b4a68",
        borderColor: "#4c5e8a",
        borderWidth: 1,
      },
    ],
  };

  // Chart options for Total Testimonials
  const totalTestimonialsChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#202b3d",
        titleColor: "#d1d5db",
        bodyColor: "#d1d5db",
        callbacks: {
          label: (context) => `${context.parsed.y} testimonials`,
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: "#d1d5db",
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
            if (isMobile && index % 2 !== 0) return "";
            return labels[index];
          },
        },
        grid: { color: "#2d3a55", display: false },
      },
      y: {
        ticks: {
          color: "#d1d5db",
          stepSize: 1,
          callback: (value) => (Number.isInteger(value) ? value : ""),
        },
        grid: { color: "#2d3a55" },
        min: 0,
        suggestedMax:
          Math.max(
            ...metrics.totalTestimonialsData,
            metrics.totalTestimonials,
            1
          ) + 1,
      },
    },
    animation: {
      duration: 1000,
      easing: "easeOutQuart",
    },
  };

  // Chart options for Recent Testimonials
  const recentTestimonialsChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#202b3d",
        titleColor: "#d1d5db",
        bodyColor: "#d1d5db",
        callbacks: {
          label: (context) => `${context.parsed.y} testimonials`,
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: "#d1d5db",
          font: { size: isMobile ? 10 : 12 },
          maxRotation: 45,
          minRotation: 45,
        },
        grid: { color: "#2d3a55", display: false },
      },
      y: {
        ticks: {
          color: "#d1d5db",
          stepSize: 1,
          callback: (value) => (Number.isInteger(value) ? value : ""),
        },
        grid: { color: "#2d3a55" },
        min: 0,
        suggestedMax:
          Math.max(
            ...metrics.recentTestimonialsData,
            metrics.recentTestimonials,
            1
          ) + 1,
      },
    },
    animation: {
      duration: 1000,
      easing: "easeOutQuart",
    },
  };

  return (
    <div className="admin-testimonial-management-container">
      <link
        href="https://fonts.googleapis.com/icon?family=Material+Icons"
        rel="stylesheet"
      />
      <h1 className="admin-testimonial-management-title">
        Testimonial Management
      </h1>

      {/* Metric Cards */}
      <div className="admin-testimonial-management-metrics">
        <div className="admin-testimonial-management-metric-card">
          <div className="admin-testimonial-management-metric-header">
            <div className="admin-testimonial-management-metric-title">
              Total Testimonials
            </div>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="admin-testimonial-management-dropdown"
              aria-label="Select year for total testimonials"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-testimonial-management-metric-value">
            {metrics.totalTestimonials}
          </div>
          <div className="admin-testimonial-management-metric-chart">
            <Line
              data={totalTestimonialsChartData}
              options={totalTestimonialsChartOptions}
            />
          </div>
        </div>
        <div className="admin-testimonial-management-metric-card">
          <div className="admin-testimonial-management-metric-header">
            <div className="admin-testimonial-management-metric-title">
              Recent Testimonials
            </div>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="admin-testimonial-management-dropdown"
              aria-label="Select month for recent testimonials"
            >
              {months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-testimonial-management-metric-value">
            {metrics.recentTestimonials}
          </div>
          <div className="admin-testimonial-management-metric-chart">
            <Bar
              data={recentTestimonialsChartData}
              options={recentTestimonialsChartOptions}
            />
          </div>
        </div>
      </div>

      {/* Filter Section */}
      <div className="admin-testimonial-management-filter-section">
        <div className="admin-testimonial-management-filter-group">
          <label htmlFor="course-filter">Filter by Course:</label>
          <input
            id="course-filter"
            type="text"
            placeholder="Enter course name"
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="admin-testimonial-management-filter-input"
            aria-label="Filter testimonials by course name"
          />
        </div>
        <div className="admin-testimonial-management-filter-group">
          <label htmlFor="platform-filter">Filter by Platform:</label>
          <select
            id="platform-filter"
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="admin-testimonial-management-filter-select"
            aria-label="Filter testimonials by platform"
          >
            <option value="">All Platforms</option>
            {platforms.map((platform) => (
              <option key={platform} value={platform}>
                {platform.charAt(0).toUpperCase() + platform.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-testimonial-management-filter-group">
          <label htmlFor="role-filter">Filter by Role:</label>
          <input
            id="role-filter"
            type="text"
            placeholder="Enter user role"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="admin-testimonial-management-filter-input"
            aria-label="Filter testimonials by user role"
          />
        </div>
      </div>

      {/* Add Testimonial Button */}
      <button
        className="admin-testimonial-management-action-button add"
        onClick={() => setIsAdding(true)}
        aria-label="Add new testimonial"
      >
        Add New Testimonial
      </button>

      {/* Testimonials Table */}
      {loading && !testimonials.length ? (
        <div>
          {Array(5)
            .fill()
            .map((_, index) => (
              <div
                key={index}
                className="admin-testimonial-management-skeleton"
              />
            ))}
        </div>
      ) : filteredTestimonials.length === 0 ? (
        <p className="admin-testimonial-management-empty">
          No testimonials found.
        </p>
      ) : (
        <table className="admin-testimonial-management-testimonial-list">
          <thead>
            <tr>
              <th>User Name</th>
              <th>Course Name</th>
              <th>Platform</th>
              <th>User Role</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTestimonials.map((testimonial) => (
              <tr key={testimonial._id}>
                <td data-label="User Name">{testimonial.userName}</td>
                <td data-label="Course Name">{testimonial.courseName}</td>
                <td data-label="Platform">{testimonial.platform}</td>
                <td data-label="User Role">{testimonial.userRole || "N/A"}</td>
                <td
                  data-label="Actions"
                  className="admin-testimonial-management-actions"
                >
                  <button
                    className="admin-testimonial-management-action-button view"
                    onClick={() => handleViewDetails(testimonial)}
                    aria-label={`View details of testimonial by ${testimonial.userName}`}
                  >
                    View Details
                  </button>
                  <button
                    className="admin-testimonial-management-action-button update"
                    onClick={() => setSelectedTestimonial(testimonial)}
                    aria-label={`Update testimonial by ${testimonial.userName}`}
                  >
                    Update
                  </button>
                  <button
                    className="admin-testimonial-management-action-button delete"
                    onClick={() => setDeleteConfirmId(testimonial._id)}
                    aria-label={`Delete testimonial by ${testimonial.userName}`}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Add/Edit Testimonial Modal */}
      <Suspense fallback={<div>Loading form...</div>}>
        {(isAdding || (selectedTestimonial && !isViewing)) && (
          <div className="admin-testimonial-management-content-modal">
            <div className="admin-testimonial-management-content-modal-content">
              <button
                type="button"
                className="admin-testimonial-management-modal-close"
                onClick={() => {
                  setIsAdding(false);
                  setSelectedTestimonial(null);
                }}
                aria-label="Close modal"
              >
                <span className="material-icons" style={{ fontSize: "20px" }}>
                  close
                </span>
              </button>
              <TestimonialForm
                testimonial={selectedTestimonial}
                onSave={isAdding ? handleAddTestimonial : handleSaveTestimonial}
              />
            </div>
          </div>
        )}
      </Suspense>

      {/* View Details Modal */}
      {isViewing && selectedTestimonial && (
        <div className="admin-testimonial-management-content-modal">
          <div className="admin-testimonial-management-content-modal-content">
            <button
              type="button"
              className="admin-testimonial-management-modal-close"
              onClick={handleCloseViewDetails}
              aria-label="Close modal"
            >
              <span className="material-icons" style={{ fontSize: "20px" }}>
                close
              </span>
            </button>
            <div className="admin-testimonial-management-view-details">
              <h2>Testimonial Details</h2>
              <p>
                <strong>User Name:</strong> {selectedTestimonial.userName}
              </p>
              <p>
                <strong>Course Name:</strong> {selectedTestimonial.courseName}
              </p>
              <p>
                <strong>Platform:</strong> {selectedTestimonial.platform}
              </p>
              <p>
                <strong>User Role:</strong>{" "}
                {selectedTestimonial.userRole || "N/A"}
              </p>
              <p>
                <strong>Created At:</strong>{" "}
                {formatDate(selectedTestimonial.createdAt)}
              </p>
              <p>
                <strong>Content:</strong> {selectedTestimonial.content}
              </p>
              {selectedTestimonial.userImage && (
                <p>
                  <strong>Image:</strong>{" "}
                  <a
                    href={selectedTestimonial.userImage}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View Image
                  </a>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="admin-testimonial-management-confirmation-modal">
          <div className="admin-testimonial-management-confirmation-modal-content">
            <div className="admin-testimonial-management-delete-confirm">
              <h2>Confirm Deletion</h2>
              <p>Are you sure you want to delete this testimonial?</p>
              <div className="admin-testimonial-management-delete-confirm-actions">
                <button
                  className="admin-testimonial-management-action-button confirm"
                  onClick={() => handleDeleteTestimonial(deleteConfirmId)}
                  aria-label="Confirm deletion"
                >
                  {isDeleting ? (
                    <span>
                      <span className="admin-testimonial-spinner"></span>
                      Deleting...
                    </span>
                  ) : (
                    "Confirm"
                  )}
                </button>
                <button
                  className="admin-testimonial-management-action-button cancel"
                  onClick={() => setDeleteConfirmId(null)}
                  aria-label="Cancel deletion"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success and Error Messages */}
      {error && <p className="admin-testimonial-management-error">{error}</p>}
      {success && (
        <p className="admin-testimonial-management-success">{success}</p>
      )}
    </div>
  );
};

export default TestimonialManagement;