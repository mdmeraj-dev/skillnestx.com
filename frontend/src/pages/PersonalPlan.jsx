import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom"; // Import useNavigate for navigation
import "../styles/SubscriptionPlans.css"; // Use existing styles

const PersonalPlan = () => {
  const navigate = useNavigate(); // Initialize useNavigate

  // Function to calculate the reset time based on the plan type
  const getResetTime = (planType) => {
    const now = new Date();
    const nextReset = new Date(now);

    switch (planType) {
      case "Basic":
        nextReset.setDate(now.getDate() + 7); // Reset after 7 days for Basic Plan
        break;
      case "Pro":
        nextReset.setDate(now.getDate() + 5); // Reset after 5 days for Pro Plan
        break;
      case "Premium":
        nextReset.setDate(now.getDate() + 3); // Reset after 3 days for Premium Plan
        break;
      default:
        nextReset.setDate(now.getDate() + 7); // Default to 7 days
    }

    nextReset.setHours(23, 59, 59, 999);
    return nextReset.getTime();
  };

  // Plans data
  const plans = useMemo(
    () => [
      {
        title: "Basic Plan",
        duration: "1 Month Access",
        durationValue: "1month", // Added for consistent duration value
        oldPrice: "₹1499",
        newPrice: "₹499",
        discountPercentage: "50% OFF",
        features: [
          "Unlimited access to all courses",
          "Regular updates on courses",
          "Certificate of completion",
        ],
        isKickstart: true, // Add a flag for the Kickstart plan
      },
      {
        title: "Pro Plan",
        duration: "6 Months Access",
        durationValue: "6months", // Added for consistent duration value
        oldPrice: "₹1999",
        newPrice: "₹999",
        discountPercentage: "50% OFF",
        features: [
          "Unlimited access to all courses",
          "Early access to new courses",
          "Regular updates on courses",
          "Personalized learning roadmap",
          "Certificate of completion",
        ],
      },
      {
        title: "Premium Plan",
        duration: "1 Year Access",
        durationValue: "1year", // Added for consistent duration value
        oldPrice: "₹2999",
        newPrice: "₹1499",
        discountPercentage: "50% OFF",
        features: [
          "Unlimited access to all courses",
          "Early access to new courses",
          "Regular updates on courses",
          "Personalized learning roadmap",
          "Certificate of completion",
          "Priority Customer Support",
        ],
        isRecommended: true, // Flag for the recommended plan
      },
    ],
    []
  );

  // State for countdown
  const [timeLeft, setTimeLeft] = useState({});

  // Timer logic
  useEffect(() => {
    const intervals = plans.map((plan) => {
      return setInterval(() => {
        setTimeLeft((prev) => ({
          ...prev,
          [plan.title]: getResetTime(plan.title.split(" ")[0]) - Date.now(),
        }));
      }, 1000);
    });

    return () => intervals.forEach((interval) => clearInterval(interval));
  }, [plans]); // Use `plans` as a dependency

  // Convert milliseconds to time format
  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    return {
      days: Math.floor(totalSeconds / (24 * 3600)),
      hours: Math.floor((totalSeconds % (24 * 3600)) / 3600),
      minutes: Math.floor((totalSeconds % 3600) / 60),
      seconds: totalSeconds % 60,
    };
  };

  // Function to handle subscription button click
  const handleSubscribe = (plan) => {
    // Prepare subscription details to pass to the PaymentPage component
    const subscriptionDetails = {
      type: "subscription", // Fixed typo in "subscription"
      name: plan.title, // Subscription type
      validity: plan.durationValue, // Use the consistent duration value
      price: plan.newPrice.replace("₹", ""), // Subscription price (remove ₹ symbol)
      displayDuration: plan.duration, // Keep the display version for UI if needed
    };

    // Navigate to the PaymentPage with subscription details
    navigate("/payment", { state: { planDetails: subscriptionDetails } });
  };

  return (
    <div className="subscription-plans-container">
      <div className="subscription-plans">
        <h2 className="plans-main-title">
          Choose the perfect plan that suits you best
        </h2>

        <div className="subscription-plans-category">
          {plans.map((plan, index) => {
            const { days, hours, minutes, seconds } = formatTime(
              timeLeft[plan.title] || 0
            );

            return (
              <div
                key={index}
                className={`subscription-card ${
                  plan.isRecommended ? "recommended" : ""
                } ${plan.isKickstart ? "kickstart" : ""}`}
              >
                {/* Recommended Tag */}
                {plan.isRecommended && (
                  <div className="recommended-tag">Recommended</div>
                )}

                {/* Kickstart Tag */}
                {plan.isKickstart && (
                  <div className="kickstart-tag">Kickstart</div>
                )}

                <h2 className="subscription-title">{plan.title}</h2>
                <p className="subscription-duration">{plan.duration}</p>

                {/* Old Price Crossed Out and New Price */}
                <div className="price-section">
                  <span className="old-price">{plan.oldPrice}</span>
                  <span className="new-price">{plan.newPrice}</span>
                  <span className="discount-percentage">
                    {plan.discountPercentage}
                  </span>
                </div>

                {/* Features List */}
                <ul className="subscription-features">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="feature-item">
                      <span className="custom-tick-mark"></span>
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* Countdown Timer (Redesigned) */}
                <div className="countdown-container">
                  <p className="timer-label">Offer Ends In:</p>
                  <div className="timer-container">
                    <div className="timer-box">
                      <div className="timer-value">{days}</div>
                      <div className="timer-unit">days</div>
                    </div>
                    <span>:</span>
                    <div className="timer-box">
                      <div className="timer-value">
                        {String(hours).padStart(2, "0")}
                      </div>
                      <div className="timer-unit">hrs</div>
                    </div>
                    <span>:</span>
                    <div className="timer-box">
                      <div className="timer-value">
                        {String(minutes).padStart(2, "0")}
                      </div>
                      <div className="timer-unit">mins</div>
                    </div>
                    <span>:</span>
                    <div className="timer-box">
                      <div className="timer-value">
                        {String(seconds).padStart(2, "0")}
                      </div>
                      <div className="timer-unit">secs</div>
                    </div>
                  </div>
                </div>

                {/* Subscribe Button */}
                <button
                  className="subscribe-button"
                  onClick={() => handleSubscribe(plan)}
                >
                  Get {plan.title}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PersonalPlan;