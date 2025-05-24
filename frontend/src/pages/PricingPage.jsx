import { useState, useEffect, memo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import PropTypes from "prop-types";
import "../styles/PricingPage.css";

// TimerComponent integrated inline
const TimerComponent = ({ days, hours, minutes, seconds }) => {
  return (
    <div className="pricing-page-countdown-container">
      <p className="pricing-page-timer-label">Offer Ends In:</p>
      <div className="pricing-page-timer-container">
        <div className="pricing-page-timer-box">
          <div className="pricing-page-timer-value">{days}</div>
          <div className="pricing-page-timer-unit">days</div>
        </div>
        <span>:</span>
        <div className="pricing-page-timer-box">
          <div className="pricing-page-timer-value">{String(hours).padStart(2, "0")}</div>
          <div className="pricing-page-timer-unit">hrs</div>
        </div>
        <span>:</span>
        <div className="pricing-page-timer-box">
          <div className="pricing-page-timer-value">{String(minutes).padStart(2, "0")}</div>
          <div className="pricing-page-timer-unit">mins</div>
        </div>
        <span>:</span>
        <div className="pricing-page-timer-box">
          <div className="pricing-page-timer-value">{String(seconds).padStart(2, "0")}</div>
          <div className="pricing-page-timer-unit">secs</div>
        </div>
      </div>
    </div>
  );
};

TimerComponent.propTypes = {
  days: PropTypes.number.isRequired,
  hours: PropTypes.number.isRequired,
  minutes: PropTypes.number.isRequired,
  seconds: PropTypes.number.isRequired,
};

// Memoize TimerComponent to prevent unnecessary re-renders
const MemoizedTimer = memo(TimerComponent);

const PricingPage = ({ auth }) => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [timeLeft, setTimeLeft] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Get backend URL from environment variables
  const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  // Calculate discount percentage
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
    return "1month"; // Default
  };

  // Calculate reset time based on plan type
  const getResetTime = (planType) => {
    const now = new Date();
    const nextReset = new Date(now);

    switch (planType.toLowerCase()) {
      case "basic":
        nextReset.setDate(now.getDate() + 7); // 7 days for Basic
        break;
      case "pro":
        nextReset.setDate(now.getDate() + 5); // 5 days for Pro
        break;
      case "premium":
        nextReset.setDate(now.getDate() + 3); // 3 days for Premium
        break;
      case "team":
        nextReset.setDate(now.getDate() + 7); // 7 days for Team
        break;
      case "gift":
        nextReset.setDate(now.getDate() + 5); // 5 days for Gift
        break;
      default:
        nextReset.setDate(now.getDate() + 7); // Default 7 days
    }

    nextReset.setHours(23, 59, 59, 999);
    return nextReset.getTime();
  };

  // Fetch all plans from backend
  useEffect(() => {
    const fetchPlans = async () => {
      const cacheKey = "subscriptionPlans";
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

        if (metadata.length === 0) {
          throw new Error("No plans available. Please contact support.");
        }

        const planData = metadata.map((plan) => {
          const oldPriceNum = parseInt(plan.oldPrice) || 0;
          const newPriceNum = parseInt(plan.newPrice) || 0;
          const subscriptionId = plan.subscriptionId || plan._id;

          if (!subscriptionId) {
            console.error("PricingPage - Missing subscriptionId for plan:", plan);
            throw new Error("Invalid plan data: Missing subscription ID.");
          }

          // Normalize plan type to match getButtonText cases
          const rawPlanType = plan.name || plan.type || "unknown";
          const normalizedPlanType = rawPlanType
            .toLowerCase()
            .replace(/\s+plan$/, "") // Remove "Plan" suffix
            .replace(/\s+/g, ""); // Remove spaces

          return {
            name: plan.name || "Unnamed Plan",
            type: normalizedPlanType,
            subscriptionId,
            purchase_type: plan.type === "Gift" ? "one-time" : "subscription",
            duration: plan.duration || (plan.type === "Gift" ? 90 : plan.type === "Team" ? 365 : 30),
            amount: newPriceNum,
            oldPrice: `₹${oldPriceNum}`,
            newPrice: `₹${newPriceNum}`,
            discountPercentage: calculateDiscountPercentage(oldPriceNum, newPriceNum),
            features: Array.isArray(plan.features) ? plan.features : [],
            tag: plan.tag || "",
          };
        });

        setPlans(planData);
        // Cache the fetched plans
        localStorage.setItem(cacheKey, JSON.stringify(planData));
        setLoading(false);
      } catch (err) {
        console.error("PricingPage - API Error:", {
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

  // Convert milliseconds to time format
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
      navigate("/login", { state: { from: "/pricing" } });
      return;
    }

    // Prepare planDetails for PaymentPage compatibility
    const planDetails = {
      id: plan.subscriptionId,
      name: plan.name,
      type: plan.purchase_type,
      duration: normalizeDuration(plan.duration),
      amount: plan.amount,
    };

    // Prepare metadata for PaymentPage
    const metadata = {
      purchaseType: plan.purchase_type,
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
  const getButtonText = (type, name) => {
    const normalizedType = type.toLowerCase();
    switch (normalizedType) {
      case "basic":
        return "Get Basic Plan";
      case "pro":
        return "Get Pro Plan";
      case "premium":
        return "Get Premium Plan";
      case "team":
        return "Get Team Plan";
      case "gift":
        return "Get Gift Plan";
      default:
        return `Get ${name} Plan`;
    }
  };

  if (loading) {
    return (
      <div className="pricing-page-plans-container">
        <div className="pricing-page-plans">
          <h1 className="pricing-page-plans-main-title">Choose Your Perfect Plan</h1>
          <div className="pricing-page-loading-container" role="status">
            Loading plans...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pricing-page-plans-container">
      <div className="pricing-page-plans">
        <h1 className="pricing-page-plans-main-title">Choose Your Perfect Plan</h1>
        {error && (
          <div className="pricing-page-error-message" role="alert">
            {error}
          </div>
        )}

        <div className="pricing-page-plans-category">
          {plans.length === 0 && !error ? (
            <div className="pricing-page-no-plans-message">No plans available at the moment.</div>
          ) : (
            plans.map((plan) => {
              const { days, hours, minutes, seconds } = formatTime(timeLeft[plan.name] || 0);
              const tagClass = plan.tag ? `pricing-page-${plan.tag.toLowerCase().replace(/\s+/g, "-")}-tag` : "";

              return (
                <div key={plan.subscriptionId} className="pricing-page-plans-card">
                  {/* Plan Tag */}
                  {plan.tag && (
                    <div className={`pricing-page-plan-tag ${tagClass}`}>{plan.tag}</div>
                  )}

                  <h2 className="pricing-page-card-title">{plan.name}</h2>
                  <p className="pricing-page-card-duration">
                    {normalizeDuration(plan.duration) === "1month"
                      ? "1 Month Access"
                      : normalizeDuration(plan.duration) === "3months"
                      ? "90 Days Access"
                      : normalizeDuration(plan.duration) === "6months"
                      ? "6 Months Access"
                      : "1 Year Access"}
                  </p>

                  {/* Price Section */}
                  <div className="pricing-page-price-section">
                    <span className="pricing-page-old-price">{plan.oldPrice}</span>
                    <span className="pricing-page-new-price">{plan.newPrice}</span>
                    <span className="pricing-page-discount-percentage">{plan.discountPercentage}</span>
                  </div>

                  {/* Features List */}
                  <ul className="pricing-page-card-features" aria-label="Plan features">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="pricing-page-feature-item">
                        <span className="pricing-page-tick-mark" aria-hidden="true"></span>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {/* Countdown Timer */}
                  <MemoizedTimer
                    days={days}
                    hours={hours}
                    minutes={minutes}
                    seconds={seconds}
                  />

                  {/* Subscribe Button */}
                  <button
                    className="pricing-page-subscribe-button"
                    onClick={() => handleSubscribe(plan)}
                    aria-label={`Subscribe to ${plan.name}`}
                  >
                    {getButtonText(plan.type, plan.name)}
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
PricingPage.propTypes = {
  auth: PropTypes.shape({
    isAuthenticated: PropTypes.bool.isRequired,
    user: PropTypes.shape({
      _id: PropTypes.string,
    }),
  }),
};

export default PricingPage;