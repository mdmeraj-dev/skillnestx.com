import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; // Import useNavigate for navigation
import "../styles/SubscriptionPlans.css"; // Keep using existing styles

const TeamSubscription = () => {
  const navigate = useNavigate(); // Initialize useNavigate

  // Function to calculate the reset time (every 7 days)
  const getResetTime = () => {
    const now = new Date();
    const nextReset = new Date(now);
    nextReset.setDate(now.getDate() + (7 - (now.getDay() % 7))); // Reset after 7 days
    nextReset.setHours(23, 59, 59, 999);
    return nextReset.getTime();
  };

  // State for countdown
  const [timeLeft, setTimeLeft] = useState(getResetTime() - Date.now());

  // Timer logic
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getResetTime() - Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

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

  const { days, hours, minutes, seconds } = formatTime(timeLeft);

  // Features array
  const features = [
    "Access for up to 10 team members",
    "Unlimited access to all courses",
    "Early access to new courses",
    "Regular updates on courses",
    "Personalized learning roadmap",
    "Certificate of completion",
    "Priority Customer Support",
  ];

  // Function to handle subscription button click
  const handleSubscribe = () => {
    // Prepare subscription details to pass to the PaymentPage component
    const subscriptionDetails = {
      type: "subscription", // Indicates this is a subscription purchase
      name: "Team Premium Plan", // Subscription type
      validity: "1 Year Access", // Subscription validity
      price: "4999", // Subscription price (remove ₹ symbol)
    };

    // Debugging: Log the subscriptionDetails object to verify it's correct
    console.log("Subscription Details:", subscriptionDetails);

    // Navigate to the PaymentPage with subscription details
    navigate("/payment", { state: { planDetails: subscriptionDetails } });
  };

  return (
    <div className="subscription-plans-container">
       <div className="subscription-plans">
      {/* Awesome Title */}
      <h2 className="plans-main-title">
        Empower Your Team with Premium Learning
      </h2>

      {/* Team Premium Plus Plan */}
      <div className="subscription-card highlighted">
        {/* Learn Together Tag */}
        <div className="learn-together-tag">Learn Together</div>

        <h2 className="subscription-title">Team Premium Plan</h2>
        <p className="subscription-duration">1 Year Access</p>

        {/* Old Price Crossed Out and New Price */}
        <div className="price-section">
          <span className="old-price">₹9999</span>
          <span className="new-price">₹4999</span>
          <span className="discount-percentage">50% OFF</span>
        </div>

        {/* Features List */}
        <ul className="subscription-features">
          {features.map((feature, idx) => (
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
        <button className="subscribe-button" onClick={handleSubscribe}>
          Get Premium Plus
        </button>
      </div>
    </div>
   </div>
  );
};

export default TeamSubscription;