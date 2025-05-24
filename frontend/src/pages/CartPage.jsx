import { useEffect } from "react";
import { useCart } from "../hooks/useCart";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import "../styles/CartPage.css";

// Directly import all icons
import EmptyCartImage from "/assets/icons/add-cart.svg";
import RemoveIcon from "/assets/icons/remove.svg";
import PercentIcon from "/assets/icons/percent.png";

// Generate a dynamic cartId based on userId
const generateCartId = (userId) => {
  // Ensure 24-character ID
  const timestamp = Date.now().toString(16);
  const baseId = (userId || "guest").slice(0, 12);
  return baseId + timestamp.padStart(12, "0").slice(0, 12);
};

const CartPage = ({ auth }) => {
  const { cart, removeFromCart } = useCart();
  const navigate = useNavigate();
  const userId = auth?.user?._id;

  // Normalize duration to match PaymentPage.jsx expectations
  const normalizeDuration = (duration) => {
    const normalized = duration?.toLowerCase();
    if (normalized?.includes("1 month")) {
      return "1month";
    }
    if (normalized?.includes("6 months")) {
      return "6months";
    }
    if (normalized?.includes("year") || normalized?.includes("12 months")) {
      return "1year";
    }
    return "1year"; // Default for cart
  };

  // Calculate all price-related values as integers
  const originalTotal = Math.round(
    cart.reduce((total, course) => total + (course.oldPrice || 0), 0)
  );
  const subtotal = Math.round(
    cart.reduce(
      (total, course) => total + (course.newPrice || course.price || 0),
      0
    )
  );
  const discount = originalTotal - subtotal;
  const discountPercentage =
    originalTotal > 0 ? Math.round((discount / originalTotal) * 100) : 0;
  const taxRate = 0.1; // 10% tax
  const taxAmount = Math.round(subtotal * taxRate);
  const couponValue = taxAmount; // Coupon equals tax amount
  const totalSavings = discount + couponValue;
  const totalAmount = subtotal; // Final amount is subtotal (tax and coupon cancel out)

  // Scroll to the top of the page when the component mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Navigate to the payment page
  const handleProceedToBuy = () => {
    if (cart.length === 0) {
      console.error("Cart is empty");
      alert("Your cart is empty. Please add courses before proceeding.");
      return;
    }

    if (isNaN(totalAmount) || totalAmount <= 0) {
      console.error("Invalid total amount:", totalAmount);
      alert("Invalid cart total. Please try again.");
      return;
    }

    if (!userId) {
      navigate("/login", { state: { from: "/cart" } });
      return;
    }

    // Generate dynamic cartId
    const cartId = generateCartId(userId);

    // Set sessionToken
    const sessionToken =
      localStorage.getItem("sessionToken") || `session_${Date.now()}`;
    localStorage.setItem("sessionToken", sessionToken);

    // Prepare cart details to pass to PaymentPage
    const planDetails = {
      id: cartId,
      courses: cart.map((course) => ({
        id: course._id || course.id,
        title: course.title || course.name,
        price: course.newPrice || course.price,
        duration: normalizeDuration(course.duration || "1 Year"),
      })),
      amount: totalAmount,
      duration: normalizeDuration("1 Year Access"),
    };

    // Prepare metadata for payment
    const metadata = {
      purchaseType: "cart",
      userId,
      amount: totalAmount,
      planDetails,
    };

    // Save to localStorage for fallback
    localStorage.setItem("planDetails", JSON.stringify(planDetails));

    // Navigate to PaymentPage
    navigate("/payment", { state: metadata });
  };

  // Close the cart page and navigate back
  const handleCloseCart = () => {
    navigate(-1);
  };

  return (
    <div className="cart-page-container">
      <div className="cart-page">
        {/* Close Button */}

        {/* Close Icon */}
        <button
          className="cart-close-icon"
          onClick={handleCloseCart}
          aria-label="Close"
        >
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

        {cart.length === 0 ? (
          <>
            <img src={EmptyCartImage} alt="Empty Cart" />
            <h2>Your cart is empty.</h2>
          </>
        ) : (
          <div className="cart-layout">
            <h2>Your Cart</h2>
            <div className="cart-items">
              {cart.map((course) => (
                <div key={course._id || course.id} className="cart-item">
                  {/* Section 1: Image */}
                  <div className="cart-item-image-section">
                    <img
                      src={course.image || course.imageUrl}
                      alt={course.title || course.name}
                      className="cart-item-image"
                      loading="lazy"
                    />
                  </div>

                  {/* Section 2: Cart Details */}
                  <div className="cart-item-details-section">
                    <h3 className="cart-item-title">
                      {course.title || course.name}
                    </h3>
                    <div className="cart-item-prices">
                      <span className="old-price">₹{course.oldPrice || 0}</span>
                      <span className="new-price">
                        ₹{course.newPrice || course.price}
                      </span>
                    </div>
                  </div>

                  {/* Section 3: Remove Button */}
                  <div className="cart-item-remove-section">
                    <button
                      className="remove-button"
                      onClick={() => removeFromCart(course._id || course.id)}
                    >
                      <img
                        src={RemoveIcon}
                        alt="Remove"
                        className="remove-icon"
                      />
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="price-details">
              <h3>Price Details</h3>
              <div className="price-row">
                <span>
                  Price ({cart.length}{" "}
                  {cart.length === 1 ? "course" : "courses"}):
                </span>
                <span>₹{originalTotal}</span>
              </div>
              <div className="price-row discount-row">
                <span>Discount ({discountPercentage}% off):</span>
                <span className="savings-value">-₹{discount}</span>
              </div>
              <div className="price-row">
                <span>Tax (10%):</span>
                <span>₹{taxAmount}</span>
              </div>
              <div className="price-row coupon-row">
                <span>Coupons for you:</span>
                <span className="savings-value">-₹{couponValue}</span>
              </div>
              <div className="divider"></div>
              <div className="price-row total">
                <span>Total Amount</span>
                <span>₹{totalAmount}</span>
              </div>
              <div className="savings-message">
                <img src={PercentIcon} alt="Percent" className="percent-icon" />
                You'll save{" "}
                <span className="total-saving">₹{totalSavings}</span> on this
                purchase!
              </div>
              <button className="proceed-to-buy" onClick={handleProceedToBuy}>
                Proceed to Pay
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Add prop type validation
CartPage.propTypes = {
  auth: PropTypes.shape({
    isAuthenticated: PropTypes.bool.isRequired,
    user: PropTypes.shape({
      _id: PropTypes.string,
    }),
  }),
};

export default CartPage;
