import { useState, useEffect, useCallback, useMemo } from "react";
import {
  getAllSubscribedUsers,
  activateSubscription,
  cancelSubscription,
  extendSubscription,
  checkSubscriptionStatus,
} from "../services/SubscriptionService.js"; // Import utility functions
import "../styles/SubscriptionManagement.css"; // Import styles
import LoadingSpinner from "./LoadingSpinner"; // Import a loading spinner component

const SubscriptionManagement = () => {
  const [subscribedUsers, setSubscribedUsers] = useState([]); // All subscribed users
  const [filteredUsers, setFilteredUsers] = useState([]); // Filtered users based on search
  const [searchQuery, setSearchQuery] = useState(""); // Search query state
  const [subscriptionStatus, setSubscriptionStatus] = useState(null); // Subscription status of selected user
  const [error, setError] = useState(""); // Error state
  const [loading, setLoading] = useState(false); // Loading state

  // Fetch all subscribed users on component mount
  useEffect(() => {
    const fetchSubscribedUsers = async () => {
      setLoading(true);
      try {
        const response = await getAllSubscribedUsers();
        if (response.success) {
          setSubscribedUsers(response.data);
          setFilteredUsers(response.data); // Initialize filtered users with all users
          setError(""); // Clear any previous errors
        } else {
          setError(response.message || "Failed to fetch subscribed users.");
        }
      } catch (error) {
        console.error("Error fetching subscribed users:", error);
        setError("Failed to fetch subscribed users. Please try again."); // Display error to user
      } finally {
        setLoading(false);
      }
    };

    fetchSubscribedUsers();
  }, []);

  // Handle search functionality
  const handleSearch = useCallback(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) {
      setFilteredUsers(subscribedUsers); // Reset to all users if search query is empty
      return;
    }

    // Filter users by name or email
    const filtered = subscribedUsers.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
    );
    setFilteredUsers(filtered);
  }, [searchQuery, subscribedUsers]);

  // Handle search on pressing Enter key
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        handleSearch();
      }
    },
    [handleSearch]
  );

  // Refresh the list of subscribed users
  const refreshUserList = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getAllSubscribedUsers();
      if (response.success) {
        setSubscribedUsers(response.data);
        setFilteredUsers(response.data); // Update filtered users
        setError(""); // Clear any previous errors
      } else {
        setError(response.message || "Failed to refresh user list.");
      }
    } catch (error) {
      console.error("Error refreshing user list:", error);
      setError("Failed to refresh user list. Please try again."); // Display error to user
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle subscription activation
  const handleActivateSubscription = useCallback(
    async (email) => {
      setLoading(true);
      try {
        const response = await activateSubscription(email, {
          type: "basic",
          planDuration: 30,
        });
        if (response.success) {
          await refreshUserList(); // Refresh the list of subscribed users
          setError(""); // Clear any previous errors
        } else {
          setError(response.message || "Failed to activate subscription.");
        }
      } catch (error) {
        console.error("Error activating subscription:", error);
        setError("Failed to activate subscription. Please try again."); // Display error to user
      } finally {
        setLoading(false);
      }
    },
    [refreshUserList]
  );

  // Handle subscription cancellation
  const handleCancelSubscription = useCallback(
    async (email) => {
      setLoading(true);
      try {
        const response = await cancelSubscription(email);
        if (response.success) {
          await refreshUserList(); // Refresh the list of subscribed users
          setError(""); // Clear any previous errors
        } else {
          setError(response.message || "Failed to cancel subscription.");
        }
      } catch (error) {
        console.error("Error canceling subscription:", error);
        setError("Failed to cancel subscription. Please try again."); // Display error to user
      } finally {
        setLoading(false);
      }
    },
    [refreshUserList]
  );

  // Handle subscription extension
  const handleExtendSubscription = useCallback(
    async (email) => {
      setLoading(true);
      try {
        const response = await extendSubscription(email, 30); // Extend by 30 days
        if (response.success) {
          await refreshUserList(); // Refresh the list of subscribed users
          setError(""); // Clear any previous errors
        } else {
          setError(response.message || "Failed to extend subscription.");
        }
      } catch (error) {
        console.error("Error extending subscription:", error);
        setError("Failed to extend subscription. Please try again."); // Display error to user
      } finally {
        setLoading(false);
      }
    },
    [refreshUserList]
  );

  // Handle subscription status check
  const handleCheckSubscriptionStatus = useCallback(async (email) => {
    setLoading(true);
    try {
      const response = await checkSubscriptionStatus(email);
      if (response.success) {
        setSubscriptionStatus(response.subscription);
        setError(""); // Clear any previous errors
      } else {
        setError(response.message || "Failed to check subscription status.");
      }
    } catch (error) {
      console.error("Error checking subscription status:", error);
      setError("Failed to check subscription status. Please try again."); // Display error to user
    } finally {
      setLoading(false);
    }
  }, []);

  // Memoize filtered users to avoid unnecessary recalculations
  const displayedUsers = useMemo(() => {
    return filteredUsers.length > 0 ? filteredUsers : subscribedUsers;
  }, [filteredUsers, subscribedUsers]);

  return (
    <div className="subscription-management">
      <h1>Subscription Management</h1>

      {/* Error Message */}
      {error && <p className="error">{error}</p>}

      {/* Loading Spinner */}
      {loading && <LoadingSpinner />}

      {/* Search Bar */}
      <div className="search-bar">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button onClick={handleSearch} disabled={loading}>
          Search
        </button>
      </div>

      {/* Search Results Container */}
      <div className="search-results">
        <h2>Search Results</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Subscription Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayedUsers.map((user) => (
              <tr key={user._id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{user.subscription?.status || "N/A"}</td>
                <td>
                  <button
                    onClick={() => handleActivateSubscription(user.email)}
                    disabled={loading}
                  >
                    Activate
                  </button>
                  <button
                    onClick={() => handleCancelSubscription(user.email)}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleExtendSubscription(user.email)}
                    disabled={loading}
                  >
                    Extend
                  </button>
                  <button
                    onClick={() => handleCheckSubscriptionStatus(user.email)}
                    disabled={loading}
                  >
                    Check Status
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Subscription Status Display */}
      {subscriptionStatus && (
        <div className="subscription-status">
          <h2>Subscription Status</h2>
          <p>Status: {subscriptionStatus.status}</p>
          <p>Type: {subscriptionStatus.type}</p>
          <p>Start Date: {new Date(subscriptionStatus.startDate).toLocaleDateString()}</p>
          <p>End Date: {new Date(subscriptionStatus.endDate).toLocaleDateString()}</p>
          <p>Plan Duration: {subscriptionStatus.planDuration} days</p>
        </div>
      )}
    </div>
  );
};

export default SubscriptionManagement;