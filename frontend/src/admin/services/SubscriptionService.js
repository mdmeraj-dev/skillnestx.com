import axios from 'axios';

// Use Vite environment variable for the API base URL
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000/api';

// Create a reusable axios instance with default headers
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include the token in every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

/**
 * Get all subscribed users.
 * @returns {Promise<Array>} - List of subscribed users.
 */
export const getAllSubscribedUsers = async () => {
  try {
    const response = await apiClient.get('/subscriptions/users');
    return response.data;
  } catch (error) {
    console.error('Error fetching subscribed users:', error.response?.data?.message || error.message);
    throw new Error('Failed to fetch subscribed users. Please try again later.');
  }
};

/**
 * Activate a subscription for a user.
 * @param {string} userId - The ID of the user.
 * @param {Object} subscriptionData - Subscription data (type, planDuration, etc.).
 * @returns {Promise<Object>} - Updated user data.
 */
export const activateSubscription = async (userId, subscriptionData) => {
  try {
    const response = await apiClient.post(`/subscriptions/users/${userId}/activate`, subscriptionData);
    return response.data;
  } catch (error) {
    console.error('Error activating subscription:', error.response?.data?.message || error.message);
    throw new Error('Failed to activate subscription. Please try again later.');
  }
};

/**
 * Cancel a subscription for a user.
 * @param {string} userId - The ID of the user.
 * @returns {Promise<Object>} - Updated user data.
 */
export const cancelSubscription = async (userId) => {
  try {
    const response = await apiClient.put(`/subscriptions/users/${userId}/cancel`);
    return response.data;
  } catch (error) {
    console.error('Error canceling subscription:', error.response?.data?.message || error.message);
    throw new Error('Failed to cancel subscription. Please try again later.');
  }
};

/**
 * Extend a subscription for a user.
 * @param {string} userId - The ID of the user.
 * @param {number} additionalDuration - Additional duration in days.
 * @returns {Promise<Object>} - Updated user data.
 */
export const extendSubscription = async (userId, additionalDuration) => {
  try {
    const response = await apiClient.put(`/subscriptions/users/${userId}/extend`, { additionalDuration });
    return response.data;
  } catch (error) {
    console.error('Error extending subscription:', error.response?.data?.message || error.message);
    throw new Error('Failed to extend subscription. Please try again later.');
  }
};

/**
 * Check subscription status for a user.
 * @param {string} userId - The ID of the user.
 * @returns {Promise<Object>} - Subscription status details.
 */
export const checkSubscriptionStatus = async (userId) => {
  try {
    const response = await apiClient.get(`/subscriptions/users/${userId}/status`);
    return response.data;
  } catch (error) {
    console.error('Error checking subscription status:', error.response?.data?.message || error.message);
    throw new Error('Failed to check subscription status. Please try again later.');
  }
};

/**
 * Get total count of active subscribers.
 * @returns {Promise<number>} - Total number of active subscribers.
 */
export const getTotalSubscriberCount = async () => {
  try {
    const response = await apiClient.get('/subscriptions/total/count');
    return response.data.totalSubscribers;
  } catch (error) {
    console.error('Error fetching total subscriber count:', error.response?.data?.message || error.message);
    throw new Error('Failed to fetch total subscriber count. Please try again later.');
  }
};