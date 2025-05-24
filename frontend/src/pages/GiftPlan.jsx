import { useState, useEffect, Suspense, lazy, memo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import PropTypes from "prop-types";
import "../styles/SubscriptionPlans.css";

// Lazy load heavy components for better performance
const TimerComponent = lazy(() => import("../components/TimerComponent"));

// Memoize TimerComponent to prevent unnecessary re-renders
const MemoizedTimer = memo(TimerComponent);

const GiftPlan = ({ auth }) => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [timeLeft, setTimeLeft] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Get backend URL from environment variables
  const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  // Calculate discount percentage from oldPrice and newPrice
  const calculateDiscountPercentage = (oldPrice, newPrice) => {
    if (!oldPrice || !newPrice || oldPrice <= 0) return "0% OFF";
    const discount = ((oldPrice - newPrice) / oldPrice) * 100;
    return `${Math.round(discount)}% OFF`;
  };

  // Normalize duration to match PersonalPlan.jsx
  const normalizeDuration = (duration) => {
    const normalized = duration?.toString().toLowerCase();
    if (normalized?.includes("1 month") || normalized === "30") {
      return "1month";
    }
    if (normalized?.includes("3 months") || normalized?.includes("90 days") || normalized === "90") {
      return "3months";
    }
    if (normalized?.includes("6 months") || normalized === "180") {
      return "6months";
    }
    if (normalized?.includes("year") || normalized?.includes("12 months") || normalized === "365" || normalized === "360") {
      return "1year";
    }
    return "3months"; // Default for Gift plans
  };

  // Function to calculate the reset time based on the plan type
  const getResetTime = (planType) => {
    const now = new Date();
    const nextReset = new Date(now);

    switch (planType.toLowerCase()) {
      case "basic":
        nextReset.setDate(now.getDate() + 7); // Reset after 7 days for Basic
        break;
      case "pro":
        nextReset.setDate(now.getDate() + 5); // Reset after 5 days for Pro
        break;
      case "premium":
        nextReset.setDate(now.getDate() + 3); // Reset after 3 days for Premium
        break;
      default:
        nextReset.setDate(now.getDate() + 5); // Default to 5 days for Gift
    }

    nextReset.setHours(23, 59, 59, 999);
    return nextReset.getTime();
  };

  // Fetch subscription templates from backend
  useEffect(() => {
    const fetchPlans = async () => {
      const cacheKey = "giftPlans";
      const cachedPlans = localStorage.getItem(cacheKey);

      try {
        // Load cached data immediately
        if (cachedPlans) {
          const parsedPlans = JSON.parse(cachedPlans);
          setPlans(parsedPlans || []);
          setLoading(false); // Render UI immediately with cached data
        } else {
          setLoading(true); // Keep loading true if no cache
        }

        const response = await axios.get(`${API_BASE_URL}/api/subscriptions/templates`);
        const metadata = Array.isArray(response.data) ? response.data : response.data.data || [];

        // Filter for Gift type
        const giftPlans = metadata.filter((plan) => plan.type === "Gift");

        if (giftPlans.length === 0) {
          throw new Error("No gift plans available. Please contact support.");
        }

        const planData = giftPlans.map((plan) => {
          const oldPriceNum = parseInt(plan.oldPrice) || 0;
          const newPriceNum = parseInt(plan.newPrice) || 0;
          const subscriptionId = plan.subscriptionId || plan._id;

          if (!subscriptionId) {
            console.error("GiftPlan - Missing subscriptionId for plan:", plan);
            throw new Error("Invalid plan data: Missing subscription ID.");
          }

          return {
            name: plan.name || "Unnamed Plan",
            type: plan.type.toLowerCase(),
            subscriptionId,
            purchase_type: "subscription",
            duration: plan.duration || 90,
            amount: newPriceNum, // Use newPrice as amount
            currency: plan.currency || "INR",
            oldPrice: `₹${oldPriceNum}`,
            newPrice: `₹${newPriceNum}`,
            discountPercentage: calculateDiscountPercentage(oldPriceNum, newPriceNum),
            features: Array.isArray(plan.features) ? plan.features : [],
            tag: plan.tag || "", // Use tag for display (e.g., "Share the Love")
          };
        });

        setPlans(planData);
        // Cache the fetched plans
        localStorage.setItem(cacheKey, JSON.stringify(planData));
        setLoading(false);
      } catch (err) {
        console.error("GiftPlan - API Error:", {
          message: err.message,
          status: err.response?.status,
          response: err.response?.data,
          url: err.config?.url,
        });
        // Only set error if no cached data was used
        if (!cachedPlans) {
          setError("Failed to load plans. Please try again later.");
          setPlans([]);
        }
        setLoading(false);
      }
    };

    fetchPlans();
  }, [API_BASE_URL]);

  // Timer logic for countdown
  useEffect(() => {
    const intervalIds = plans.map((plan) =>
      setInterval(() => {
        setTimeLeft((prev) => ({
          ...prev,
          [plan.name]: getResetTime(plan.type) - Date.now(),
        }));
      }, 1000)
    );

    return () => intervalIds.forEach((id) => clearInterval(id));
  }, [plans]);

  // Convert milliseconds to time format for timer
  const formatTime = (ms) => {
    if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    const totalSeconds = Math.floor(ms / 1000);
    return {
      days: Math.floor(totalSeconds / (24 * 3600)),
      hours: Math.floor((totalSeconds % (24 * 3600)) / 3600),
      minutes: Math.floor((totalSeconds % 3600) / 60),
      seconds: totalSeconds % 60,
    };
  };

  // Handle subscription button click
  const handleSubscribe = (plan) => {
    const userId = auth?.user?._id;
    if (!userId) {
      navigate("/login", { state: { from: "/subscription/gift" } });
      return;
    }

    // Prepare planDetails for PaymentPage compatibility
    const planDetails = {
      id: plan.subscriptionId,
      name: plan.name,
      type: "one-time",
      duration: normalizeDuration(plan.duration),
      amount: plan.amount,
    };

    // Prepare metadata for PaymentPage
    const metadata = {
      purchaseType: "one-time",
      userId,
      subscriptionId: plan.subscriptionId,
      amount: plan.amount,
    };

    // Save to localStorage for fallback
    localStorage.setItem("planDetails", JSON.stringify(planDetails));

    // Navigate to PaymentPage with planDetails and metadata
    navigate("/payment", { state: { planDetails, ...metadata } });
  };

  // Map plan type to button text
  const getButtonText = (type) => {
    switch (type.toLowerCase()) {
      case "basic":
        return "Get Basic Gift Plan";
      case "pro":
        return "Get Pro Gift Plan";
      case "premium":
        return "Get Premium Gift Plan";
      default:
        return "Get Gift Plan";
    }
  };

  if (loading) {
    return (
      <div className="loading-container" role="status">
        Loading plans...
      </div>
    );
  }

  return (
    <div className="subscription-plans-container">
      <div className="subscription-plans">
        <h2 className="plans-main-title">Give the Gift of Learning</h2>
        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}

        <div className="subscription-plans-category">
          {plans.length === 0 && !error ? (
            <div className="no-plans-message">No gift plans available at the moment.</div>
          ) : (
            plans.map((plan) => {
              const { days, hours, minutes, seconds } = formatTime(timeLeft[plan.name] || 0);
              const tagClass = plan.tag ? plan.tag.toLowerCase().replace(/\s+/g, "-") : ""; // e.g., "Share the Love" -> "share-the-love"

              return (
                <div key={plan.subscriptionId} className="subscription-card">
                  {/* Plan Tag */}
                  {plan.tag && (
                    <div className={`plan-tag ${tagClass}-tag`}>{plan.tag}</div>
                  )}

                  <h2 className="subscription-name">{plan.name}</h2>
                  <p className="subscription-duration">
                    {normalizeDuration(plan.duration) === "1month"
                      ? "1 Month Access"
                      : normalizeDuration(plan.duration) === "3months"
                      ? "90 Days Access"
                      : normalizeDuration(plan.duration) === "6months"
                      ? "6 Months Access"
                      : "1 Year Access"}
                  </p>

                  {/* Price Section */}
                  <div className="price-section">
                    <span className="old-price">{plan.oldPrice}</span>
                    <span className="new-price">{plan.newPrice}</span>
                    <span className="discount-percentage">{plan.discountPercentage}</span>
                  </div>

                  {/* Features List */}
                  <ul className="subscription-features" aria-label="Plan features">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="feature-item">
                        <span className="custom-tick-mark" aria-hidden="true"></span>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {/* Countdown Timer */}
                  <Suspense fallback={<div>Loading timer...</div>}>
                    <MemoizedTimer
                      days={days}
                      hours={hours}
                      minutes={minutes}
                      seconds={seconds}
                    />
                  </Suspense>

                  {/* Subscribe Button */}
                  <button
                    className="subscribe-button"
                    onClick={() => handleSubscribe(plan)}
                    aria-label={`Subscribe to ${plan.name}`}
                  >
                    {getButtonText(plan.type)}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

// Add prop type validation
GiftPlan.propTypes = {
  auth: PropTypes.shape({
    isAuthenticated: PropTypes.bool.isRequired,
    user: PropTypes.shape({
      _id: PropTypes.string,
    }),
  }),
};

export default GiftPlan;