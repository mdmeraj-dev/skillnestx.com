import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PropTypes from "prop-types";
import "../styles/Success.css";

const Success = ({ auth }) => {
  const { state } = useLocation();
  const navigate = useNavigate();

  // Fallback values
  const purchaseType = state?.type || "course";
  const courseNames = state?.name || "Unknown Item";
  const duration = state?.duration || "N/A";
  const price = state?.price || 0;
  const currency = state?.currency || "INR";
  const cartItems = state?.cartItems || [];

  // Currency symbols
  const currencySymbols = {
    INR: "₹",
    USD: "$",
    EUR: "€",
    GBP: "£",
    AUD: "A$",
    CAD: "C$",
    JPY: "¥",
    SGD: "S$",
    AED: "د.إ",
    NZD: "NZ$",
  };

  // Determine display name for courses
  const displayName =
    purchaseType === "cart" && cartItems.length > 0
      ? cartItems.map((item) => item.name).join(", ")
      : courseNames;

  // Navigation handler
  const handleContinue = () => {
    navigate(purchaseType === "course" || purchaseType === "cart" ? "/courses" : "/");
  };

  // Close handler (same as continue)
  const handleClose = () => {
    navigate(purchaseType === "course" || purchaseType === "cart" ? "/courses" : "/");
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" },
    },
  };

  const checkmarkVariants = {
    hidden: { scale: 0, opacity: 0 },
    visible: {
      scale: 1,
      opacity: 1,
      transition: { duration: 0.3, ease: "easeOut" },
    },
  };

  return (
    <div className="payment-success-modal-overlay">
      <motion.div
        className="payment-success-modal"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Close Icon */}
        <button className="close-icon" onClick={handleClose} aria-label="Close">
          <svg
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Brand Header */}
        <div className="brand-header">
          <img
            src="/assets/logos/company-logo.png"
            alt="SkillnestX Logo"
            className="brand-logo"
          />
          <h1 className="brand-title">SkillnestX</h1>
        </div>

        {/* Success Checkmark */}
        <motion.div
          className="payment-checkmark-container"
          variants={checkmarkVariants}
          initial="hidden"
          animate="visible"
        >
          <svg
            className="payment-checkmark-icon"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </motion.div>

        {/* Success Message */}
        <h2 className="payment-success-title">Payment Successful!</h2>
        <h3 className="order-confirmation-title">Order Confirmation :</h3>

        {/* Order Summary */}
        <div className="order-confirmation-container">
          {purchaseType && displayName ? (
            <>
              <div className="order-confirmation-row">
                <span className="order-confirmation-label">
                  {purchaseType === "subscription" ? "Plan" : "Course"}:
                </span>
                <span className="order-confirmation-value">{displayName}</span>
              </div>
              <div className="order-confirmation-row">
                <span className="order-confirmation-label">Duration:</span>
                <span className="order-confirmation-value">{duration}</span>
              </div>
              <div className="order-confirmation-row">
                <span className="order-confirmation-label">Amount Paid:</span>
                <span className="order-confirmation-value">
                  {currencySymbols[currency] || currency}{" "}
                  {currency === "INR" ? price : price.toFixed(2)}
                </span>
              </div>
            </>
          ) : (
            <p className="order-confirmation-fallback">
              Your payment was processed successfully.
            </p>
          )}
        </div>

        {/* CTA Button */}
        <motion.button
          className="continue-button-after-payment"
          onClick={handleContinue}
        >
          {purchaseType === "course" || purchaseType === "cart"
            ? "Browse Courses"
            : "Go to Home"}
        </motion.button>
      </motion.div>
    </div>
  );
};

Success.propTypes = {
  auth: PropTypes.shape({
    isAuthenticated: PropTypes.bool.isRequired,
    user: PropTypes.object,
  }),
};

export default Success;