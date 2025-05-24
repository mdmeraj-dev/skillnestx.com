import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import '../styles/Dashboard.css';
import usersIcon from '../assets/icons/users.svg';
import subscribersIcon from '../assets/icons/subscribers.svg';
import coursesIcon from '../assets/icons/courses.svg';
import testimonialsIcon from '../assets/icons/testimonials.svg';
import LoadingSpinner from './LoadingSpinner';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
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

// Configure Axios with base URL and interceptor
const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
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

const DashboardOverview = () => {
  const [metrics, setMetrics] = useState({
    users: 0,
    subscribers: 0,
    courses: 0,
    testimonials: 0,
    usersData: [],
    subscribersData: [],
    coursesData: [],
    testimonialsData: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [refreshTrigger, setRefreshTrigger] = useState(Date.now());

  // Format current date as DD-MM-YYYY
  const currentDate = new Date();
  const formattedDate = `${String(currentDate.getDate()).padStart(2, '0')}-${String(
    currentDate.getMonth() + 1
  ).padStart(2, '0')}-${currentDate.getFullYear()}`;

  // Update mobile state on resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch dashboard data with retry
  const fetchWithRetry = async (url, options, retries = 3, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await api.get(url, options);
        return response;
      } catch (err) {
        if (i < retries - 1 && err.message === 'Network Error') {
          logger.warn(`Retrying request to ${url}, attempt ${i + 1}`, { error: err.message });
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw err;
      }
    }
  };

  // Fetch dashboard data for current year
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError('');

    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) {
      setError('Authentication required. Please log in.');
      setLoading(false);
      return;
    }

    const traceId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : generateUUID();
    const requestOptions = {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Trace-Id': traceId,
      },
      withCredentials: true,
    };

    try {
      // Fetch dashboard data for users, courses, and testimonials
      logger.debug('Fetching dashboard data', { traceId, url: `${BASE_URL}/api/admin/dashboard` });
      const dashboardResponse = await fetchWithRetry('/api/admin/dashboard', requestOptions);

      // Fetch subscriber data
      let subscribersData = { total: 0, history: Array(12).fill(0) };
      const subscriberEndpoint = `/api/subscriptions/admin/subscribers/year?year=${currentDate.getFullYear()}&_t=${Date.now()}`;
      try {
        logger.debug('Fetching subscriber data', { traceId, url: `${BASE_URL}${subscriberEndpoint}` });
        const subscribersResponse = await fetchWithRetry(subscriberEndpoint, requestOptions);
        logger.debug('Subscriber data fetched', { traceId, data: subscribersResponse.data });
        if (subscribersResponse.data.success) {
          subscribersData = {
            total: subscribersResponse.data.total || 0,
            history: subscribersResponse.data.history || Array(12).fill(0),
          };
        } else {
          logger.warn('Subscriber endpoint returned unsuccessful response', {
            traceId,
            data: subscribersResponse.data,
          });
          setError('Failed to fetch subscriber data. Please check the backend response.');
        }
      } catch (subError) {
        logger.error('Failed to fetch subscriber data', {
          traceId,
          status: subError.response?.status,
          data: subError.response?.data,
          message: subError.message,
        });
        setError('Unable to fetch subscriber data. Please check backend endpoint: /api/subscriptions/admin/subscribers/year');
        subscribersData = { total: 0, history: Array(12).fill(0) };
      }

      logger.debug('Dashboard data fetched', { traceId, dashboard: dashboardResponse.data, subscribers: subscribersData });

      const { users, courses, testimonials } = dashboardResponse.data.data;

      setMetrics({
        users: users.total || 0,
        subscribers: subscribersData.total || 0,
        courses: courses.data.recent || 0,
        testimonials: testimonials.total || 0,
        usersData: users.history || Array(12).fill(0),
        subscribersData: subscribersData.history || Array(12).fill(0),
        coursesData: courses.data.history || Array(12).fill(0),
        testimonialsData: testimonials.history || Array(12).fill(0),
      });

      // Update tokens if provided in dashboard response
      if (dashboardResponse.data.tokens) {
        localStorage.setItem('accessToken', dashboardResponse.data.tokens.accessToken);
        localStorage.setItem('refreshToken', dashboardResponse.data.tokens.refreshToken);
        logger.debug('Tokens updated from dashboard response', { traceId });
      }

      setError('');
    } catch (err) {
      logger.error('Error fetching dashboard data', {
        traceId,
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
      });
      let errorMessage = 'Failed to fetch dashboard data. Please try again.';
      if (err.message === 'Network Error') {
        errorMessage = `Unable to connect to the server at ${BASE_URL}. Please check if the backend is running.`;
      } else if (err.response?.status === 404) {
        errorMessage = 'Dashboard endpoint not found. Please check backend route: /api/admin/dashboard';
      } else if (err.response?.status === 401) {
        errorMessage = 'Unauthorized access to dashboard data. Please check authentication.';
      }
      setError(errorMessage);
      // Fallback data
      setMetrics({
        users: 1000,
        subscribers: 0,
        courses: 100,
        testimonials: 50,
        usersData: Array.from({ length: 12 }, () => Math.floor(Math.random() * 100)),
        subscribersData: Array(12).fill(0),
        coursesData: Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)),
        testimonialsData: Array.from({ length: 12 }, () => Math.floor(Math.random() * 5)),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch data on mount and when refreshTrigger changes
  useEffect(() => {
    fetchDashboardData();
    const pollingInterval = setInterval(() => {
      logger.debug('Polling for dashboard data', { timestamp: Date.now() });
      fetchDashboardData();
    }, 1800000); // Poll every 60 seconds
    return () => clearInterval(pollingInterval);
  }, [fetchDashboardData, refreshTrigger]);

  // Listen for subscription updates
  useEffect(() => {
    const handleSubscriptionUpdate = () => {
      logger.debug('Subscription update event received, refreshing data');
      setRefreshTrigger(Date.now());
      fetchDashboardData(); // Force immediate refresh
    };
    window.addEventListener('subscription-updated', handleSubscriptionUpdate);
    return () => window.removeEventListener('subscription-updated', handleSubscriptionUpdate);
  }, [fetchDashboardData]);

  // Refresh data when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        logger.debug('Page visible, refreshing dashboard data');
        setRefreshTrigger(Date.now());
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Chart data for Total Users
  const usersChartData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    datasets: [
      {
        label: 'Total Users',
        data: metrics.usersData,
        borderColor: '#3b4a68',
        backgroundColor: 'rgba(59, 74, 104, 0.2)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  // Chart data for Total Subscribers
  const subscribersChartData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    datasets: [
      {
        label: 'Total Subscribers',
        data: metrics.subscribersData,
        borderColor: '#3b4a68',
        backgroundColor: 'rgba(59, 74, 104, 0.2)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  // Chart data for Total Courses
  const coursesChartData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    datasets: [
      {
        label: 'Total Courses',
        data: metrics.coursesData,
        borderColor: '#3b4a68',
        backgroundColor: 'rgba(59, 74, 104, 0.2)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  // Chart data for Total Testimonials
  const testimonialsChartData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    datasets: [
      {
        label: 'Total Testimonials',
        data: metrics.testimonialsData,
        borderColor: '#3b4a68',
        backgroundColor: 'rgba(59, 74, 104, 0.2)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  // Chart options with dynamic x-axis ticks
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: '#202b3d', titleColor: '#d1d5db', bodyColor: '#d1d5db' },
    },
    scales: {
      x: {
        ticks: {
          color: '#d1d5db',
          maxTicksLimit: isMobile ? 6 : 12,
          callback: function (value, index) {
            const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            if (isMobile) {
              // Show Jan, Mar, Jun, Sep on mobile
              if (index === 0 || index === 2 || index === 5 || index === 8 || index === 11) {
                return labels[index];
              }
              return null;
            }
            return labels[index];
          },
        },
        grid: { color: '#2d3a55' },
      },
      y: {
        ticks: { color: '#d1d5db' },
        grid: { color: '#2d3a55' },
      },
    },
  };

  // Display loading state
  if (loading) {
    return (
      <div className="dashboard-container">
        <LoadingSpinner />
      </div>
    );
  }

  // Display error state
  if (error) {
    return (
      <div className="dashboard-container error">
        {error}
        <button
          onClick={fetchDashboardData}
          className="dashboard-retry-button"
          aria-label="Retry fetching dashboard data"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <h1 className="dashboard-title">Dashboard Overview</h1>
      <div className="dashboard-metrics">
        <div className="dashboard-metric-card">
          <div className="dashboard-metric-header">
            <div className="dashboard-metric-title">
              <img src={usersIcon} alt="Users" className="icon" />
              Total Users <span className="date">({formattedDate})</span>
            </div>
            <div className="dashboard-metric-value-header">{metrics.users}</div>
          </div>
          <div className="dashboard-metric-chart">
            <Line data={usersChartData} options={chartOptions} />
          </div>
        </div>
        <div className="dashboard-metric-card">
          <div className="dashboard-metric-header">
            <div className="dashboard-metric-title">
              <img src={subscribersIcon} alt="Subscribers" className="icon" />
              Total Subscribers <span className="date">({formattedDate})</span>
            </div>
            <div className="dashboard-metric-value-header">{metrics.subscribers}</div>
          </div>
          <div className="dashboard-metric-chart">
            <Line data={subscribersChartData} options={chartOptions} />
          </div>
        </div>
        <div className="dashboard-metric-card">
          <div className="dashboard-metric-header">
            <div className="dashboard-metric-title">
              <img src={coursesIcon} alt="Courses" className="icon" />
              Total Courses <span className="date">({formattedDate})</span>
            </div>
            <div className="dashboard-metric-value-header">{metrics.courses}</div>
          </div>
          <div className="dashboard-metric-chart">
            <Line data={coursesChartData} options={chartOptions} />
          </div>
        </div>
        <div className="dashboard-metric-card">
          <div className="dashboard-metric-header">
            <div className="dashboard-metric-title">
              <img src={testimonialsIcon} alt="Testimonials" className="icon" />
              Total Testimonials <span className="date">({formattedDate})</span>
            </div>
            <div className="dashboard-metric-value-header">{metrics.testimonials}</div>
          </div>
          <div className="dashboard-metric-chart">
            <Line data={testimonialsChartData} options={chartOptions} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;