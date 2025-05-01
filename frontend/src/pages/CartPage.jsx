import { useEffect } from "react";
import { useCart } from "../hooks/useCart";
import { useNavigate } from "react-router-dom";
import "../styles/CartPage.css";

// Directly import all icons
import EmptyCartImage from "/assets/icons/add-cart.svg";
import RemoveIcon from "/assets/icons/remove.svg";
import PercentIcon from "/assets/icons/percent.png";

const CartPage = () => {
  const { cart, removeFromCart } = useCart();
  const navigate = useNavigate();

  // Calculate all price-related values as integers
  const originalTotal = Math.round(cart.reduce((total, course) => total + course.oldPrice, 0));
  const subtotal = Math.round(cart.reduce((total, course) => total + course.newPrice, 0));
  const discount = originalTotal - subtotal;
  const discountPercentage = Math.round((discount / originalTotal) * 100);
  const taxRate = 0.10; // 10% tax
  const taxAmount = Math.round(subtotal * taxRate);
  const couponValue = taxAmount; // Coupon equals tax amount
  const totalSavings = discount + couponValue;
  const totalAmount = subtotal; // Final amount is subtotal (tax and coupon cancel out)

  // Persist cart items to localStorage whenever cart changes
  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart));
  }, [cart]);

  // Scroll to the top of the page when the component mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Navigate to the payment page
  const handleProceedToBuy = () => {
    const cartDetails = {
      type: "course",
      name: cart.map((course) => course.title).join(", "),
      validity: "1 Year Access",
      price: totalAmount, // No decimal places
    };

    console.log("Cart Details:", cartDetails);
    navigate("/payment", { state: { planDetails: cartDetails } });
  };

  // Close the cart page and navigate back
  const handleCloseCart = () => {
    navigate(-1);
  };

  return (
    <div className="cart-page-container">
      <div className="cart-page">
        {/* Close Button */}
        <button className="close-button" onClick={handleCloseCart}>
          <img
            src="/assets/icons/close.svg"
            alt="Close"
            className="close-icon"
          />
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
                <div key={course._id} className="cart-item">
                  {/* Section 1: Image */}
                  <div className="cart-item-image-section">
                    <img
                      src={course.image}
                      alt={course.title}
                      className="cart-item-image"
                      loading="lazy"
                    />
                  </div>

                  {/* Section 2: Cart Details */}
                  <div className="cart-item-details-section">
                    <h3 className="cart-item-title">{course.title}</h3>
                    <div className="cart-item-prices">
                      <span className="old-price">₹{course.oldPrice}</span>
                      <span className="new-price">₹{course.newPrice}</span>
                    </div>
                  </div>

                  {/* Section 3: Remove Button */}
                  <div className="cart-item-remove-section">
                    <button
                      className="remove-button"
                      onClick={() => removeFromCart(course._id)}
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
                <span>Price ({cart.length} {cart.length === 1 ? 'course' : 'courses'}):</span>
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
                You&apos;ll save <span className="total-saving">₹{totalSavings}</span> on this purchase!
              </div>
              
              <button
                className="proceed-to-buy"
                onClick={handleProceedToBuy}
              >
                Proceed to Pay
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CartPage;