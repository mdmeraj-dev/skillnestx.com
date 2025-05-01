import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom"; // Import useNavigate for navigation
import "../styles/SubscriptionPlans.css"; // Use existing styles

// Lazy load heavy components for better performance
const TimerComponent = lazy(() => import("../components/TimerComponent"));

const PricingPage = () => {
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
      case "Team":
        nextReset.setDate(now.getDate() + (7 - (now.getDay() % 7))); // Reset after 7 days for Team Plan
        break;
      case "Gift":
        nextReset.setDate(now.getDate() + (5 - (now.getDay() % 5))); // Reset after 5 days for Gift Plan
        break;
      default:
        nextReset.setDate(now.getDate() + 7); // Default to 7 days
    }

    nextReset.setHours(23, 59, 59, 999);
    return nextReset.getTime();
  };

  // Combined plans data
  const plans = useMemo(
    () => [
      // Personal Plans
      {
        title: "Basic Plan",
        duration: "1 Month Access",
        oldPrice: "₹1499",
        newPrice: "₹499",
        discountPercentage: "50% OFF",
        features: [
          "Unlimited access to all courses",
          "Regular updates on courses",
          "Certificate of completion",
        ],
        isKickstart: true,
      },
      {
        title: "Pro Plan",
        duration: "6 Months Access",
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
        isRecommended: true,
      },
      // Team Plan
      {
        title: "Team Premium Plan",
        duration: "1 Year Access",
        oldPrice: "₹9999",
        newPrice: "₹4999",
        discountPercentage: "50% OFF",
        features: [
          "Access for up to 10 team members",
          "Unlimited access to all courses",
          "Early access to new courses",
          "Regular updates on courses",
          "Personalized learning roadmap",
          "Certificate of completion",
          "Priority Customer Support",
        ],
        isHighlighted: true,
        tag: "Learn Together",
      },
      // Gift Plan
      {
        title: "Gift Premium Plan",
        duration: "1 Year Access",
        oldPrice: "₹1999",
        newPrice: "₹999",
        discountPercentage: "50% OFF",
        features: [
          "Unlimited access to all courses",
          "Early access to new courses",
          "Regular updates on courses",
          "Certificate of completion",
          "Priority Customer Support",
        ],
        tag: "Share the Love",
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
      type: "subscription", // Indicates this is a subscription purchase
      name: plan.title, // Subscription type
      validity: plan.duration, // Subscription validity
      price: plan.newPrice.replace("₹", ""), // Subscription price (remove ₹ symbol)
    };

    // Navigate to the PaymentPage with subscription details
    navigate("/payment", { state: { planDetails: subscriptionDetails } });
  };

  return (
    <div className="subscription-plans-container">
       <div className="subscription-plans">
      <h2 className="plans-main-title">Choose the plan that suits you best</h2>

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
              } ${plan.isHighlighted ? "highlighted" : ""}`}
            >
              {/* Plan Tags */}
              {plan.tag && <div className="plan-tag">{plan.tag}</div>}
              {plan.isRecommended && (
                <div className="recommended-tag">Recommended</div>
              )}
              {plan.isKickstart && (
                <div className="kickstart-tag">Kickstart</div>
              )}

              <h2 className="subscription-title">{plan.title}</h2>
              <p className="subscription-duration">{plan.duration}</p>

              {/* Price Section */}
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

              {/* Countdown Timer */}
              <Suspense fallback={<div>Loading timer...</div>}>
                <TimerComponent
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

export default PricingPage;