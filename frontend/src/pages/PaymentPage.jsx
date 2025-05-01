import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { number } from "card-validator";
import InputMask from "react-input-mask";
import axios from "axios";
import "../styles/PaymentPage.css";

// Import all payment method icons
import visaIcon from "/assets/icons/visa.svg";
import mastercardIcon from "/assets/icons/mastercard.svg";
import amexIcon from "/assets/icons/amex.svg";
import rupayIcon from "/assets/icons/rupay.svg";
import discoverIcon from "/assets/icons/discover.svg";
import dinersClubIcon from "/assets/icons/diners.svg";
import jcbIcon from "/assets/icons/jcb.svg";
import unionPayIcon from "/assets/icons/unionpay.svg";
import maestroIcon from "/assets/icons/maestro.svg";
import mirIcon from "/assets/icons/mir.svg";
import unknownCardIcon from "/assets/icons/unknown.svg";
import upiLogo from "/assets/logos/upi.svg";
import cardLogo from "/assets/logos/card.svg";
import gpayLogo from "/assets/logos/gpay.svg";
import phonePeLogo from "/assets/logos/phonepe.svg";
import paytmLogo from "/assets/logos/paytm.svg";
import amazonLogo from "/assets/logos/amazon.svg";
import arrowDown from "/assets/icons/arrow-down.svg";

const BASE_URL = import.meta.env.VITE_BASE_URL;
const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID ?? "rzp_test_jeqtNdw6W3SEyz";

const PaymentPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [previousEmails, setPreviousEmails] = useState([]);
  const [previousPhones, setPreviousPhones] = useState([]);

  // Format duration for display
  const formatDuration = (duration) => {
    if (!duration) return "1 Year Access";
    
    if (duration === "1month") return "1 Month Access";
    if (duration === "6months") return "6 Months Access";
    if (duration === "1year") return "1 Year Access";
    
    return duration; // Fallback for custom durations
  };

  // Load payment details and previous inputs from localStorage
  useEffect(() => {
    const savedCourseDetails = JSON.parse(localStorage.getItem("selectedCourse"));
    const savedPlanDetails = JSON.parse(localStorage.getItem("planDetails"));
    const savedEmails = JSON.parse(localStorage.getItem("previousEmails")) || [];
    const savedPhones = JSON.parse(localStorage.getItem("previousPhones")) || [];

    if (location.state?.courseDetails) {
      const details = {
        ...location.state.courseDetails,
        type: "course",
        displayDuration: "1 Year Access" // Courses typically have lifetime access
      };
      localStorage.setItem("selectedCourse", JSON.stringify(details));
      setPaymentDetails(details);
    } else if (location.state?.planDetails) {
      const details = {
        ...location.state.planDetails,
        type: "subscription",
        displayDuration: formatDuration(location.state.planDetails.validity)
      };
      localStorage.setItem("planDetails", JSON.stringify(details));
      setPaymentDetails(details);
    } else if (savedCourseDetails) {
      setPaymentDetails(savedCourseDetails);
    } else if (savedPlanDetails) {
      setPaymentDetails(savedPlanDetails);
    } else {
      navigate("/");
    }

    setPreviousEmails(savedEmails);
    setPreviousPhones(savedPhones);
  }, [location.state, navigate]);

  const [selectedMethod, setSelectedMethod] = useState("");
  const [upiOption, setUpiOption] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [validThru, setValidThru] = useState("");
  const [cvv, setCvv] = useState("");
  const [isUpiExpanded, setIsUpiExpanded] = useState(false);
  const [isCardExpanded, setIsCardExpanded] = useState(false);
  const [cardType, setCardType] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Enhanced card detection logic
  const detectCardType = (cardNumber) => {
    const cleanedCardNumber = cardNumber.replace(/\s/g, "");

    if (/^3[47]/.test(cleanedCardNumber)) return "amex"; // American Express
    if (/^(60|6521|6522|81)/.test(cleanedCardNumber)) return "rupay"; // RuPay
    if (/^(6011|65|64[4-9]|622(12[6-9]|1[3-9][0-9]|[2-8][0-9]{2}|9[0-1][0-9]|92[0-5]))/.test(cleanedCardNumber))
      return "discover"; // Discover

    const cardInfo = number(cleanedCardNumber);
    return cardInfo.card?.type || null;
  };

  useEffect(() => {
    setCardType(cardNumber ? detectCardType(cardNumber) : null);
  }, [cardNumber]);

  const getCardIcon = () => {
    switch (cardType) {
      case "visa": return visaIcon;
      case "mastercard": return mastercardIcon;
      case "amex": return amexIcon;
      case "discover": return discoverIcon;
      case "diners-club": return dinersClubIcon;
      case "jcb": return jcbIcon;
      case "rupay": return rupayIcon;
      case "unionpay": return unionPayIcon;
      case "maestro": return maestroIcon;
      case "mir": return mirIcon;
      default: return unknownCardIcon;
    }
  };

  const handleEmailChange = (e) => {
    const newEmail = e.target.value;
    setEmail(newEmail);
    setError("");
    
    if (newEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      const updatedEmails = Array.from(new Set([newEmail, ...previousEmails])).slice(0, 5);
      setPreviousEmails(updatedEmails);
      localStorage.setItem('previousEmails', JSON.stringify(updatedEmails));
    }
  };

  const handlePhoneChange = (phone) => {
    setPhoneNumber(phone);
    setError("");
    
    if (phone && phone.length >= 12) {
      const updatedPhones = Array.from(new Set([phone, ...previousPhones])).slice(0, 5);
      setPreviousPhones(updatedPhones);
      localStorage.setItem('previousPhones', JSON.stringify(updatedPhones));
    }
  };

  const validateInputs = () => {
    if (!email) {
      setError("Please enter your email address");
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address");
      return false;
    }

    if (!phoneNumber) {
      setError("Please enter your phone number");
      return false;
    }

    if (phoneNumber.length < 10) {
      setError("Please enter a valid phone number");
      return false;
    }

    if (!selectedMethod) {
      setError("Please select a payment method");
      return false;
    }

    if (selectedMethod === "UPI" && !upiOption) {
      setError("Please select a UPI option");
      return false;
    }

    if (selectedMethod === "Card") {
      if (!cardNumber) {
        setError("Please enter your card number");
        return false;
      }

      if (!number(cardNumber).isValid) {
        setError("Please enter a valid card number");
        return false;
      }

      if (!validThru) {
        setError("Please enter card expiry date");
        return false;
      }

      if (!cvv) {
        setError("Please enter card CVV");
        return false;
      }

      if (cvv.length < 3) {
        setError("Please enter a valid CVV");
        return false;
      }
    }

    return true;
  };

  const handlePayment = async () => {
    if (!validateInputs()) return;

    setIsLoading(true);
    setError("");

    try {
      const orderResponse = await axios.post(
        `${BASE_URL}/api/create-razorpay-order`,
        {
          amount: paymentDetails.price * 100,
          currency: "INR",
          receipt: `receipt_${Date.now()}`,
          notes: {
            type: paymentDetails.type,
            duration: paymentDetails.validity || "lifetime",
            productName: paymentDetails.title || paymentDetails.name
          }
        }
      );

      const { id: orderId } = orderResponse.data;

      const options = {
        key: RAZORPAY_KEY_ID,
        amount: paymentDetails.price * 100,
        currency: "INR",
        name: "SkillNestX",
        description: `Payment for ${paymentDetails.title || paymentDetails.name}`,
        order_id: orderId,
        handler: async (response) => {
          try {
            const verificationResponse = await axios.post(
              `${BASE_URL}/api/verify-razorpay-payment`,
              {
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                email,
                phone: phoneNumber,
                productType: paymentDetails.type,
                productId: paymentDetails.id,
                duration: paymentDetails.validity || "1 Year Access",
                paymentMethod: selectedMethod,
                amount: paymentDetails.price,
              }
            );

            if (verificationResponse.data.success) {
              localStorage.removeItem("selectedCourse");
              localStorage.removeItem("planDetails");
              navigate("/success", {
                state: {
                  type: paymentDetails.type,
                  name: paymentDetails.title || paymentDetails.name,
                  duration: paymentDetails.displayDuration,
                  price: paymentDetails.price
                }
              });
            } else {
              setError("Payment verification failed. Please contact support.");
            }
          } catch (verificationError) {
            console.error("Verification error:", verificationError);
            setError("Payment verification failed. Please contact support.");
          }
        },
        prefill: {
          name: "User Name",
          email: email,
          contact: phoneNumber,
        },
        theme: {
          color: "#F37254",
        },
        modal: {
          ondismiss: () => {
            setError("Payment was cancelled. Please try again if you want to proceed.");
          },
        },
      };

      if (window.Razorpay) {
        const razorpayInstance = new window.Razorpay(options);
        razorpayInstance.on("payment.failed", (response) => {
          setError(`Payment failed: ${response.error.description}`);
        });
        razorpayInstance.open();
      } else {
        setError("Razorpay SDK failed to load. Please refresh and try again.");
      }
    } catch (error) {
      console.error("Payment error:", error);
      setError(
        error.response?.data?.message || 
        "Payment processing failed. Please try again or contact support."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpiSelection = () => {
    setSelectedMethod("UPI");
    setIsUpiExpanded((prev) => !prev);
    setIsCardExpanded(false);
    setError("");
  };

  const handleCardSelection = () => {
    setSelectedMethod("Card");
    setIsCardExpanded((prev) => !prev);
    setIsUpiExpanded(false);
    setError("");
  };

  const handleClose = () => {
    if (!isLoading) {
      navigate(-1); // Go back to the previous page
    }
  };

  return (
    <div className="payment-page-container">
      <div className="payment-page">
        <button
          className="payment-close-button"
          onClick={handleClose}
          aria-label="Close"
          disabled={isLoading}
        >
          <img src="/assets/icons/close.svg" alt="Close" />
        </button>
        <h1 className="brand-title">SkillNestX</h1>

        <h3>Order Summary</h3>
        <div className="order-summary">
          {paymentDetails ? (
            <>
              <p>
                <strong>
                  {paymentDetails.type === "course" ? "Course" : "Plan"}:
                </strong>{" "}
                {paymentDetails.title || paymentDetails.name}
              </p>
              <p>
                <strong>Duration:</strong> {paymentDetails.displayDuration}
              </p>
              <p>
                <strong>Total Amount:</strong> ₹{paymentDetails.price}
              </p>
            </>
          ) : (
            <p>No payment details found. Please go back and select a course or plan.</p>
          )}
        </div>

        <h3>Account Details</h3>
        <div className="account-details">
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={handleEmailChange}
            autoComplete="email"
            required
          />
          <datalist id="emailSuggestions">
            {previousEmails.map((email, index) => (
              <option key={index} value={email} />
            ))}
          </datalist>

          <div className="phone-input-section">
            <PhoneInput
              country={"in"}
              value={phoneNumber}
              onChange={handlePhoneChange}
              inputClass="phone-input"
              containerClass="phone-input-container"
              inputProps={{
                required: true,
                autoComplete: "tel",
              }}
            />
            <datalist id="phoneSuggestions">
              {previousPhones.map((phone, index) => {
                const formatted = `+${phone.substring(0, 2)} ${phone.substring(2, 5)} ${phone.substring(5, 8)} ${phone.substring(8)}`;
                return <option key={index} value={phone} label={formatted} />;
              })}
            </datalist>
          </div>
        </div>

        <h3>Payment Method</h3>
        <div className="payment-method">
          <div className="payment-section">
            <label className="payment-option">
              <div className="upi-left">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="UPI"
                  checked={selectedMethod === "UPI"}
                  onChange={handleUpiSelection}
                />
                <span>UPI</span>
              </div>
              <img src={upiLogo} alt="UPI" className="payment-logo" />
              <button
                className="toggle-button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleUpiSelection();
                }}
              >
                <img
                  src={isUpiExpanded ? arrowDown : arrowDown}
                  alt={isUpiExpanded ? "Collapse" : "Expand"}
                  className={isUpiExpanded ? "icon-rotated" : ""}
                />
              </button>
            </label>

            {isUpiExpanded && (
              <div className="upi-options">
                <label className="upi-option">
                  <div className="upi-left">
                    <input
                      type="radio"
                      name="upi"
                      value="Google Pay"
                      onChange={() => {
                        setUpiOption("Google Pay");
                        setError("");
                      }}
                    />
                    <span>Google Pay</span>
                  </div>
                  <img src={gpayLogo} alt="Google Pay" className="payment-logo" />
                </label>
                <label className="upi-option">
                  <div className="upi-left">
                    <input
                      type="radio"
                      name="upi"
                      value="PhonePe"
                      onChange={() => {
                        setUpiOption("PhonePe");
                        setError("");
                      }}
                    />
                    <span>PhonePe</span>
                  </div>
                  <img src={phonePeLogo} alt="PhonePe" className="payment-logo" />
                </label>
                <label className="upi-option">
                  <div className="upi-left">
                    <input
                      type="radio"
                      name="upi"
                      value="Paytm"
                      onChange={() => {
                        setUpiOption("Paytm");
                        setError("");
                      }}
                    />
                    <span>Paytm</span>
                  </div>
                  <img src={paytmLogo} alt="Paytm" className="payment-logo" />
                </label>
                <label className="upi-option">
                  <div className="upi-left">
                    <input
                      type="radio"
                      name="upi"
                      value="Amazon"
                      onChange={() => {
                        setUpiOption("Amazon");
                        setError("");
                      }}
                    />
                    <span>Amazon Pay</span>
                  </div>
                  <img src={amazonLogo} alt="Amazon" className="payment-logo" />
                </label>
              </div>
            )}
          </div>

          <div className="payment-section">
            <label className="payment-option">
              <div className="upi-left">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="Card"
                  checked={selectedMethod === "Card"}
                  onChange={handleCardSelection}
                />
                <span>Credit / Debit Card</span>
              </div>
              <img src={cardLogo} alt="Card" className="payment-logo" />
              <button
                className="toggle-button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCardSelection();
                }}
              >
                <img
                  src={arrowDown}
                  alt={isCardExpanded ? "Collapse" : "Expand"}
                  className={isCardExpanded ? "icon-rotated" : ""}
                />
              </button>
            </label>

            {isCardExpanded && (
              <div className="card-details">
                <p className="card-note">
                  Note: Please ensure your card can be used for online transactions.
                </p>

                <label>Card Number</label>
                <div className="card-number-input">
                  <InputMask
                    mask="9999 9999 9999 9999"
                    maskChar=""
                    placeholder="XXXX XXXX XXXX XXXX"
                    value={cardNumber}
                    onChange={(e) => {
                      setCardNumber(e.target.value);
                      setError("");
                    }}
                  />
                  <img
                    src={cardType ? getCardIcon() : unknownCardIcon}
                    alt={cardType || "Unknown Card"}
                    className={`card-icon ${!cardType ? "default-card-icon" : ""}`}
                    onError={(e) => {
                      e.target.src = unknownCardIcon;
                    }}
                  />
                </div>

                <div className="card-expiry-cvv">
                  <div>
                    <label>Valid Thru</label>
                    <InputMask
                      mask="99/99"
                      placeholder="MM/YY"
                      value={validThru}
                      onChange={(e) => {
                        setValidThru(e.target.value);
                        setError("");
                      }}
                    />
                  </div>
                  <div>
                    <label>CVV</label>
                    <InputMask
                      mask="999"
                      placeholder="CVV"
                      value={cvv}
                      onChange={(e) => {
                        setCvv(e.target.value);
                        setError("");
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {error && <p className="payment-error-message">{error}</p>}

        <button
          className="pay-button"
          onClick={handlePayment}
          disabled={isLoading}
        >
          {isLoading
            ? "Processing..."
            : `Pay ₹${paymentDetails ? paymentDetails.price : "0.00"}`}
        </button>
      </div>
    </div>
  );
};

export default PaymentPage;