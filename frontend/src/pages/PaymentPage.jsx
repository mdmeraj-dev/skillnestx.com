import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import PropTypes from "prop-types";
import "../styles/PaymentPage.css";

const BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_hrcaRzb7maJB9z";

// Currency symbols mapping
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

// Static exchange rates (INR as base currency)
const exchangeRates = {
  INR: 1,
  USD: 0.012,
  EUR: 0.011,
  GBP: 0.009,
  AUD: 0.018,
  CAD: 0.016,
  JPY: 1.8,
  SGD: 0.016,
  AED: 0.044,
  NZD: 0.02,
};

// Currency multipliers (to smallest unit, e.g., paise for INR, cents for USD)
const currencyMultipliers = {
  INR: 100, // Paise
  USD: 100, // Cents
  EUR: 100, // Cents
  GBP: 100, // Pence
  AUD: 100, // Cents
  CAD: 100, // Cents
  JPY: 1, // Yen (no decimal places)
  SGD: 100, // Cents
  AED: 100, // Fils
  NZD: 100, // Cents
};

const PaymentPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [previousEmails, setPreviousEmails] = useState([]);
  const [previousPhones, setPreviousPhones] = useState([]);
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [convertedPrice, setConvertedPrice] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isTermsAgreed, setIsTermsAgreed] = useState(true);
  const [userId, setUserId] = useState(null);
  const [notes, setNotes] = useState({});

  const supportedCurrencies = [
    "INR",
    "USD",
    "EUR",
    "GBP",
    "AUD",
    "CAD",
    "JPY",
    "SGD",
    "AED",
    "NZD",
  ];
  const validDurations = ["1month", "6months", "1year"];

  const isValidObjectId = (id) => /^[0-9a-fA-F]{24}$/.test(id);

  const formatDuration = (duration) => {
    if (!duration || !validDurations.includes(duration)) return "1 Year Access";
    switch (duration.toLowerCase()) {
      case "1month":
        return "1 Month Access";
      case "6months":
        return "6 Months Access";
      case "1year":
        return "1 Year Access";
      default:
        return "1 Year Access";
    }
  };

  const normalizeDuration = (duration) => {
    const normalized = duration?.toLowerCase();
    if (validDurations.includes(normalized)) {
      return normalized;
    }
    if (normalized?.includes("year") || normalized?.includes("12 months")) {
      return "1year";
    }
    if (normalized?.includes("6 months")) {
      return "6months";
    }
    if (normalized?.includes("month")) {
      return "1month";
    }
    return "1year";
  };

  const getItemTypeLabel = (type) => {
    switch (type) {
      case "course":
        return "Course";
      case "subscription":
        return "Subscription";
      case "cart":
        return "Course";
      default:
        return "Item";
    }
  };

  useEffect(() => {
    const accessToken = localStorage.getItem("accessToken");
    const refreshToken = localStorage.getItem("refreshToken");

    if (!accessToken || !refreshToken) {
      console.warn("PaymentPage - Missing tokens, redirecting to login");
      setError("Please log in to proceed with payment.");
      setTimeout(
        () =>
          navigate("/login", { state: { from: location.pathname, error: "Authentication required" } }),
        2000
      );
      return;
    }

    try {
      const decoded = jwtDecode(accessToken);
      if (decoded.userId) {
        setUserId(decoded.userId);
        setEmail(decoded.email || "");
      } else {
        console.warn("PaymentPage - Invalid token, no userId found");
        setError("Invalid authentication token. Please log in again.");
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        setTimeout(
          () =>
            navigate("/login", { state: { from: location.pathname, error: "Invalid token" } }),
          2000
        );
      }
    } catch (decodeError) {
      console.error("PaymentPage - Token decode error:", decodeError);
      setError("Failed to validate authentication. Please log in again.");
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      setTimeout(
        () =>
          navigate("/login", { state: { from: location.pathname, error: "Token validation failed" } }),
        2000
      );
    }
  }, [navigate, location.pathname]);

  useEffect(() => {
    const savedPaymentDetails =
      JSON.parse(localStorage.getItem("selectedCourse")) ||
      JSON.parse(localStorage.getItem("planDetails"));
    const savedEmails = JSON.parse(localStorage.getItem("previousEmails")) || [];
    const savedPhones = JSON.parse(localStorage.getItem("previousPhones")) || [];

    let details = null;
    let cart = [];
    let metadataNotes = {};

    if (!location.state) {
      console.warn("PaymentPage - No location.state received. Falling back to localStorage.");
    }

    if (location.state?.purchaseType) {
      const { purchaseType, userId: metadataUserId, amount, planDetails, courseDetails } =
        location.state;
      if (purchaseType === "course" && courseDetails) {
        const { id, name, duration, price } = courseDetails;
        const normalizedDuration = normalizeDuration(duration);
        details = {
          id,
          name,
          purchaseType: "course",
          price: Number(price || amount),
          duration: normalizedDuration,
          displayDuration: formatDuration(normalizedDuration),
        };
        metadataNotes = {
          purchaseType: "course",
          productId: id,
          productName: name,
          duration: normalizedDuration,
          userId: metadataUserId,
          originalPrice: Number(price || amount),
          currency,
          courseId: id,
        };
        if (!isValidObjectId(details.id)) {
          console.error("PaymentPage - Invalid course ID:", details.id, "Details:", details);
          setError("Invalid course ID. Please select a valid course.");
          navigate("/");
          return;
        }
      } else if (purchaseType === "subscription" || purchaseType === "one-time") {
        const { id, name, duration, amount: planAmount } = planDetails || {};
        const normalizedDuration = normalizeDuration(duration);
        details = {
          id,
          name,
          purchaseType: purchaseType === "one-time" ? "subscription" : purchaseType,
          price: Number(planAmount || amount),
          duration: normalizedDuration,
          displayDuration: formatDuration(normalizedDuration),
        };
        metadataNotes = {
          purchaseType: "subscription",
          productId: id,
          productName: name,
          duration: normalizedDuration,
          userId: metadataUserId,
          originalPrice: Number(planAmount || amount),
          currency,
          subscriptionId: id,
        };
        if (!isValidObjectId(details.id)) {
          console.error("PaymentPage - Invalid subscription ID:", details.id, "Details:", details);
          setError("Invalid subscription ID. Please select a valid plan.");
          navigate("/");
          return;
        }
      } else if (purchaseType === "cart" && planDetails?.courses) {
        const normalizedDuration = normalizeDuration(planDetails.duration);
        details = {
          id: planDetails.id || `cart_${Date.now()}`,
          name: "Course Bundle",
          purchaseType: "cart",
          price: Number(amount || planDetails.amount),
          duration: normalizedDuration,
          displayDuration: formatDuration(normalizedDuration),
          courses: planDetails.courses,
        };
        try {
          let coursesArray;
          if (typeof planDetails.courses === "string") {
            coursesArray = JSON.parse(planDetails.courses);
          } else if (Array.isArray(planDetails.courses)) {
            coursesArray = planDetails.courses;
          } else {
            throw new Error("Invalid courses format: must be a JSON string or array");
          }
          if (!coursesArray.length) {
            throw new Error("Cart is empty: no courses provided");
          }
          cart = coursesArray.map((item) => ({
            id: item.id,
            name: item.title || item.name,
            type: "course",
            price: Number(item.price || 0),
            duration: normalizedDuration,
            displayDuration: formatDuration(normalizedDuration),
          }));
          const invalidItems = cart.filter(
            (item) => !item.id || !isValidObjectId(item.id) || !item.name
          );
          if (invalidItems.length > 0) {
            console.error("PaymentPage - Invalid cart items:", invalidItems);
            throw new Error("One or more cart items have invalid IDs or names");
          }
          if (!details.id || typeof details.id !== "string") {
            console.error("PaymentPage - Missing or invalid cart ID:", details.id, "Details:", details);
            setError("Invalid cart ID. Please try again.");
            navigate("/cart");
            return;
          }
          metadataNotes = {
            purchaseType: "cart",
            courseIds: cart.map((item) => item.id).join(","),
            courseNames: cart.map((item) => item.name).join(", "),
            duration: normalizedDuration,
            userId: metadataUserId,
            originalPrice: Number(amount || planDetails.amount),
            currency,
            cartItems: cart.map((item) => ({
              id: item.id,
              name: item.name,
              price: item.price,
            })),
          };
        } catch (parseError) {
          console.error("PaymentPage - Failed to process cart courses:", planDetails.courses, parseError);
          setError("Invalid cart data. Please ensure all cart items are valid and try again.");
          navigate("/cart");
          return;
        }
      } else {
        console.error("PaymentPage - Invalid or missing metadata:", location.state);
        setError("Invalid payment data. Please select a valid item.");
        navigate("/");
        return;
      }
    } else if (savedPaymentDetails) {
      const duration = normalizeDuration(savedPaymentDetails.duration);
      let purchaseType = savedPaymentDetails.purchaseType || savedPaymentDetails.type;
      if (!["course", "subscription", "cart"].includes(purchaseType)) {
        if (localStorage.getItem("selectedCourse")) {
          purchaseType = "course";
        } else if (localStorage.getItem("planDetails")) {
          purchaseType = "cart";
        } else {
          purchaseType = "cart";
        }
        console.warn(
          "PaymentPage - Invalid saved type:",
          savedPaymentDetails.type,
          "Inferred purchaseType:",
          purchaseType
        );
      }
      if (purchaseType === "one-time") {
        purchaseType = "subscription";
      }
      details = {
        id: savedPaymentDetails.id,
        name: savedPaymentDetails.name,
        purchaseType,
        price: Number(savedPaymentDetails.price || savedPaymentDetails.amount),
        duration,
        displayDuration: formatDuration(duration),
        courses: savedPaymentDetails.courses || null,
      };
      if (purchaseType === "course") {
        metadataNotes = {
          purchaseType: "course",
          productId: details.id,
          productName: details.name,
          duration,
          userId,
          originalPrice: details.price,
          currency,
          courseId: details.id,
        };
      } else if (purchaseType === "subscription") {
        metadataNotes = {
          purchaseType: "subscription",
          productId: details.id,
          productName: details.name,
          duration,
          userId,
          originalPrice: details.price,
          currency,
          subscriptionId: details.id,
        };
      } else if (purchaseType === "cart" && details.courses) {
        try {
          let coursesArray;
          if (typeof details.courses === "string") {
            coursesArray = JSON.parse(details.courses);
          } else if (Array.isArray(details.courses)) {
            coursesArray = details.courses;
          } else {
            throw new Error("Invalid saved courses format: must be a JSON string or array");
          }
          if (!coursesArray.length) {
            throw new Error("Saved cart is empty: no courses provided");
          }
          cart = coursesArray.map((item) => ({
            id: item.id,
            name: item.title || item.name,
            type: "course",
            price: Number(item.price || 0),
            duration,
            displayDuration: formatDuration(duration),
          }));
          const invalidItems = cart.filter(
            (item) => !item.id || !isValidObjectId(item.id) || !item.name
          );
          if (invalidItems.length > 0) {
            console.error("PaymentPage - Invalid saved cart items:", invalidItems);
            throw new Error("One or more saved cart items have invalid IDs or names");
          }
          if (!details.id || typeof details.id !== "string") {
            console.error("PaymentPage - Missing or invalid saved cart ID:", details.id, "Details:", details);
            setError("Invalid cart ID. Please try again.");
            navigate("/cart");
            return;
          }
          metadataNotes = {
            purchaseType: "cart",
            courseIds: cart.map((item) => item.id).join(","),
            courseNames: cart.map((item) => item.name).join(", "),
            duration,
            userId,
            originalPrice: details.price,
            currency,
            cartItems: cart.map((item) => ({
              id: item.id,
              name: item.name,
              price: item.price,
            })),
          };
        } catch (parseError) {
          console.error("PaymentPage - Failed to process saved cart courses:", details.courses, parseError);
          setError("Invalid cart data in storage. Please add items to your cart again.");
          navigate("/cart");
          return;
        }
      }
      if (purchaseType !== "cart" && !isValidObjectId(details.id)) {
        console.error("PaymentPage - Invalid saved course/plan ID:", details.id, "Saved details:", savedPaymentDetails);
        setError("Invalid course or plan ID. Please select a valid item.");
        navigate("/");
        return;
      }
    } else {
      console.error("PaymentPage - No valid payment data found");
      setError("No course, plan, or cart items selected. Please select an item to proceed.");
      navigate("/");
      return;
    }

    if (details) {
      localStorage.setItem("selectedCourse", JSON.stringify(details));
      localStorage.setItem("planDetails", JSON.stringify(details));
      setPaymentDetails(details);
      setCartItems(cart);
      setNotes(metadataNotes);
    }

    setPreviousEmails(savedEmails);
    setPreviousPhones(savedPhones);
  }, [location.state, navigate, userId, currency]);

  useEffect(() => {
    let basePrice = 0;
    if (paymentDetails && paymentDetails.purchaseType === "cart") {
      basePrice = paymentDetails.price || 0;
    } else if (cartItems.length > 0) {
      basePrice = cartItems.reduce((sum, item) => sum + Number(item.price), 0);
    } else {
      basePrice = paymentDetails?.price || 0;
    }

    const rate = exchangeRates[currency] || 1;
    const converted = basePrice * rate;
    // For INR and JPY, ensure integer amount; for others, use two decimal places
    const formattedPrice =
      currency === "INR" || currency === "JPY" ? Math.round(converted) : Number(converted.toFixed(2));
    setConvertedPrice(formattedPrice);
  }, [currency, paymentDetails, cartItems]);

  const validateInputs = useCallback(() => {
    if (!userId) {
      setError("User authentication required. Please log in.");
      return false;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return false;
    }
    if (!phoneNumber || phoneNumber.length < 10) {
      setError("Please enter a valid phone number.");
      return false;
    }
    if (!isTermsAgreed) {
      setError("You must agree to the Terms of Service and Refund Policy.");
      return false;
    }
    if (!supportedCurrencies.includes(currency)) {
      setError("Please select a valid currency.");
      return false;
    }
    if (!paymentDetails) {
      setError("No course, plan, or cart items selected for payment.");
      return false;
    }
    if (!paymentDetails.id) {
      setError("Missing course, plan, or cart ID. Please select a valid item.");
      return false;
    }
    if (
      !paymentDetails.price ||
      isNaN(Number(paymentDetails.price)) ||
      Number(paymentDetails.price) <= 0
    ) {
      setError("Invalid price for the selected item.");
      return false;
    }
    if (
      !paymentDetails.purchaseType ||
      !["course", "subscription", "cart"].includes(paymentDetails.purchaseType)
    ) {
      setError("Invalid product type. Please select a valid course, plan, or cart.");
      return false;
    }
    if (
      paymentDetails.purchaseType === "subscription" &&
      !validDurations.includes(paymentDetails.duration)
    ) {
      setError("Invalid duration for subscription. Must be 1month, 6months, or 1year.");
      return false;
    }
    if (paymentDetails.purchaseType === "cart" && cartItems.length > 0) {
      if (cartItems.some((item) => !item.id || !isValidObjectId(item.id))) {
        setError("Invalid cart item IDs. Ensure all courses have valid IDs.");
        return false;
      }
      if (
        cartItems.some(
          (item) => !item.price || isNaN(Number(item.price)) || Number(item.price) <= 0
        )
      ) {
        setError("Invalid cart item prices. Ensure all courses have valid prices.");
        return false;
      }
      if (
        cartItems.some(
          (item) => !item.name || typeof item.name !== "string" || item.name.trim().length === 0
        )
      ) {
        setError("Invalid cart item names. Ensure all courses have valid names.");
        return false;
      }
    }
    return true;
  }, [userId, email, phoneNumber, isTermsAgreed, currency, paymentDetails, cartItems]);

  const handleEmailChange = useCallback(
    (e) => {
      const value = e.target.value;
      setEmail(value);
      setError("");
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        const updatedEmails = Array.from(new Set([value, ...previousEmails])).slice(0, 5);
        setPreviousEmails(updatedEmails);
        localStorage.setItem("previousEmails", JSON.stringify(updatedEmails));
      }
    },
    [previousEmails]
  );

  const handlePhoneChange = useCallback(
    (phone) => {
      setPhoneNumber(phone);
      setError("");
      if (phone.length >= 12) {
        const updatedPhones = Array.from(new Set([phone, ...previousPhones])).slice(0, 5);
        setPreviousPhones(updatedPhones);
        localStorage.setItem("previousPhones", JSON.stringify(updatedPhones));
      }
    },
    [previousPhones]
  );

  const handlePayment = async () => {
    if (!validateInputs()) return;

    setIsLoading(true);
    setError("");

    try {
      const accessToken = localStorage.getItem("accessToken");
      const refreshToken = localStorage.getItem("refreshToken");

      if (!accessToken || !refreshToken) {
        setError("Missing authentication tokens. Please log in again.");
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        setTimeout(
          () =>
            navigate("/login", {
              state: { from: location.pathname, error: "Session expired. Please log in again." },
            }),
          2000
        );
        return;
      }

      const headers = {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Trace-Id": crypto.randomUUID(),
      };

      // Convert amount to smallest currency unit
      const multiplier = currencyMultipliers[currency] || 100;
      const totalPrice = Math.round(convertedPrice * multiplier);
      if (isNaN(totalPrice) || totalPrice < multiplier) {
        console.error("Invalid totalPrice:", { convertedPrice, totalPrice, currency });
        setError(`Invalid amount: Must be at least ${multiplier} units of currency.`);
        setIsLoading(false);
        return;
      }

      const updatedNotes = {
        ...notes,
        email,
        phone: phoneNumber,
        purchaseType: paymentDetails.purchaseType,
        userId,
        courseId: paymentDetails.purchaseType === "course" ? paymentDetails.id : undefined,
        subscriptionId: paymentDetails.purchaseType === "subscription" ? paymentDetails.id : undefined,
        cartItems:
          paymentDetails.purchaseType === "cart"
            ? cartItems.map((item) => ({
                id: item.id,
                name: item.name,
                price: Math.round(item.price * multiplier), // Convert item prices to smallest unit
              }))
            : [],
        amount: totalPrice, // Store amount in smallest unit
        currency,
      };

      const payload = {
        amount: totalPrice,
        currency,
        purchaseType: paymentDetails.purchaseType,
        userId,
        courseId: paymentDetails.purchaseType === "course" ? paymentDetails.id : undefined,
        subscriptionId: paymentDetails.purchaseType === "subscription" ? paymentDetails.id : undefined,
        cartItems:
          paymentDetails.purchaseType === "cart"
            ? cartItems.map((item) => ({
                id: item.id,
                name: item.name,
                price: Math.round(item.price * multiplier), // Convert item prices to smallest unit
              }))
            : [],
      };

      let orderResponse;
      try {
        orderResponse = await axios.post(`${BASE_URL}/api/payment/create-order`, payload, {
          headers,
        });
      } catch (orderError) {
        console.error("Order creation error:", orderError.response?.data || orderError);
        if (orderError.response?.status === 401) {
          setError("Session expired. Please log in again.");
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          setTimeout(
            () =>
              navigate("/login", {
                state: { from: location.pathname, error: "Session expired. Please log in again." },
              }),
            2000
          );
        } else {
          setError(
            orderError.response?.data?.message ||
              "Failed to create order. Please check your network or contact support."
          );
        }
        setIsLoading(false);
        return;
      }

      const { order_id: orderId, amount, currency: orderCurrency, traceId } = orderResponse.data;

      // Validate amount
      if (amount !== totalPrice) {
        console.error(`Amount mismatch: expected ${totalPrice}, received ${amount}`, { traceId });
        setError("Invalid amount received from server. Please try again.");
        setIsLoading(false);
        return;
      }

      const formattedPhone = phoneNumber.startsWith("+")
        ? phoneNumber.replace(/\D/g, "")
        : phoneNumber.replace(/\D/g, "");

      const options = {
        key: RAZORPAY_KEY_ID,
        amount: totalPrice, // Use totalPrice in smallest unit
        currency: orderCurrency,
        name: "SkillnestX",
        description: `Payment for ${paymentDetails?.name || "Course Bundle"}`,
        image: `${window.location.origin}/assets/logos/company-logo.png`,
        order_id: orderId,
        handler: async (response) => {
         
          try {
            const verificationPayload = {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              amount: totalPrice, // Send amount in smallest unit
              currency,
              purchaseType: paymentDetails.purchaseType,
              userId,
              courseId: paymentDetails.purchaseType === "course" ? paymentDetails.id : undefined,
              subscriptionId: paymentDetails.purchaseType === "subscription" ? paymentDetails.id : undefined,
              cartItems:
                paymentDetails.purchaseType === "cart"
                  ? cartItems.map((item) => ({
                      id: item.id,
                      name: item.name,
                      price: Math.round(item.price * multiplier), // Convert item prices to smallest unit
                    }))
                  : [],
              notes: updatedNotes,
            };


            const verificationResponse = await axios.post(
              `${BASE_URL}/api/payment/verify-payment`,
              verificationPayload,
              { headers }
            );


            if (verificationResponse.data.success) {
              localStorage.removeItem("selectedCourse");
              localStorage.removeItem("planDetails");
              navigate("/success", {
                state: {
                  type: updatedNotes.purchaseType,
                  name:
                    updatedNotes.purchaseType === "cart"
                      ? updatedNotes.courseNames
                      : paymentDetails?.name || "Course Bundle",
                  duration: paymentDetails?.displayDuration || cartItems[0]?.displayDuration,
                  price: totalPrice / multiplier, // Convert back to display units
                  currency,
                  traceId,
                  cartItems: updatedNotes.purchaseType === "cart" ? cartItems : undefined,
                  paymentId: response.razorpay_payment_id,
                  transactionId: verificationResponse.data.data?.transactionId,
                  courseId:
                    updatedNotes.purchaseType === "course" ? paymentDetails.id : undefined,
                  subscriptionId:
                    updatedNotes.purchaseType === "subscription" ? paymentDetails.id : undefined,
                },
              });
            } else {
              setError("Payment verification failed. Please contact support.");
              setIsLoading(false);
            }
          } catch (verificationError) {
            console.error("Verification Error:", verificationError.response?.data || verificationError);
            setError(
              verificationError.response?.data?.message ||
                "Payment verification failed. Please contact support."
            );
            setIsLoading(false);
          }
        },
        prefill: {
          email,
          contact: formattedPhone,
          name: updatedNotes.productName || "Customer",
        },
        notes: updatedNotes,
        theme: {
          color: "#3399cc",
        },
        modal: {
          ondismiss: () => {
            setError("Payment was cancelled. Please try again.");
            setIsLoading(false);
          },
        },
        method: {
          upi: true,
          card: true,
          netbanking: true,
          wallet: true,
          emi: true,
        },
        retry: {
          enabled: true,
          max_count: 3,
        },
      };

      const loadRazorpay = () => {
        return new Promise((resolve, reject) => {
          if (window.Razorpay) {
            resolve();
            return;
          }
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.async = true;
          script.onload = () => {
            resolve();
          };
          script.onerror = () => {
            console.error("Failed to load Razorpay SDK");
            reject(new Error("Failed to load Razorpay SDK. Please check your internet connection."));
          };
          document.body.appendChild(script);
        });
      };

      try {
        await loadRazorpay();
        const razorpayInstance = new window.Razorpay(options);
        razorpayInstance.on("payment.failed", (response) => {
          console.error("Payment Failed:", JSON.stringify(response.error, null, 2));
          setError(`Payment failed: ${response.error.description || "Please try again."}`);
          setIsLoading(false);
        });
        razorpayInstance.on("payment.error", (response) => {
          console.error("Payment Error:", JSON.stringify(response.error, null, 2));
          setError(`Payment error: ${response.error.description || "Please try again."}`);
          setIsLoading(false);
        });
        razorpayInstance.open();
      } catch (sdkError) {
        console.error("Razorpay SDK Error:", sdkError);
        setError("Failed to initialize payment. Please try again.");
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Payment Error:", error);
      setError(
        error.message ||
          "Failed to initiate payment. Please check your network or contact support."
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="payment-page-container">
      <div className="payment-page">
        <button
          className="payment-close-button"
          onClick={() => navigate(-1)}
          aria-label="Close"
        >
          <img src="/assets/icons/close.svg" alt="Close" />
        </button>
        <div className="brand-container">
          <img src="/assets/logos/company-logo.png" alt="SkillnestX Logo" className="brand-logo" />
          <h1 className="brand-title">SkillnestX</h1>
        </div>

        <h3>Order Summary</h3>
        <div className="order-summary">
          {paymentDetails && Object.keys(notes).length > 0 ? (
            <>
              <div className="order-summary-container">
                <div className="order-row">
                  <span className="order-label">{getItemTypeLabel(notes.purchaseType)}:</span>
                  <span className="order-value">
                    {notes.purchaseType === "cart"
                      ? notes.courseNames
                      : notes.productName || "Unknown Item"}
                  </span>
                </div>
                <div className="order-row">
                  <span className="order-label">Duration:</span>
                  <span className="order-value">{formatDuration(notes.duration) || "N/A"}</span>
                </div>
                <div className="order-row">
                  <span className="order-label">Amount:</span>
                  <span className="order-value">
                    {currencySymbols[currency] || currency}{" "}
                    {currency === "INR" || currency === "JPY"
                      ? convertedPrice
                      : convertedPrice.toFixed(2)}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <p className="error-text">No order details found. Please select an item.</p>
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
            list="emailSuggestions"
            required
            disabled={isLoading}
            className={error && !email ? "input-error" : ""}
          />
          <datalist id="emailSuggestions">
            {previousEmails.map((email, index) => (
              <option key={index} value={email} />
            ))}
          </datalist>

          <PhoneInput
            country="in"
            value={phoneNumber}
            onChange={handlePhoneChange}
            inputClass={`phone-input ${error && !phoneNumber ? "input-error" : ""}`}
            containerClass="phone-input-container"
            inputProps={{
              required: true,
              autoComplete: "tel",
              disabled: isLoading,
            }}
          />

          <div className="currency-selector">
            <label htmlFor="currency">Currency:</label>
            <select
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              disabled={isLoading}
              className={error && !supportedCurrencies.includes(currency) ? "input-error" : ""}
            >
              {supportedCurrencies.map((curr) => (
                <option key={curr} value={curr}>
                  {curr}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="total-amount">
          <span>Total Amount:</span>
          <span className="amount-value">
            {currencySymbols[currency] || currency}{" "}
            {currency === "INR" || currency === "JPY" ? convertedPrice : convertedPrice.toFixed(2)}
          </span>
        </div>

        <div className="payment-terms-container">
          <input
            type="checkbox"
            id="terms"
            checked={isTermsAgreed}
            onChange={(e) => setIsTermsAgreed(e.target.checked)}
            disabled={isLoading}
          />
          <label htmlFor="terms">
            By clicking 'Pay now', you agree to our{" "} 
            <a href="/terms-of-service" target="_blank" rel="noopener noreferrer">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="/refund-policy" target="_blank" rel="noopener noreferrer">
              Refund Policy
            </a>
            .
          </label>
        </div>

        {error && <p className="payment-error-message">{error}</p>}

        <button
          className="pay-button"
          onClick={handlePayment}
          disabled={isLoading || !paymentDetails || !isTermsAgreed || !userId}
        >
          {isLoading ? (
            <span className="payment-loading-spinner">Processing...</span>
          ) : (
            "Pay Now"
          )}
        </button>

        <div className="secured-by">
          <span>Payment Secured by</span>
          <img src="/assets/logos/razorpay.svg" alt="Razorpay" className="razorpay-logo" />
        </div>
      </div>
    </div>
  );
};

PaymentPage.propTypes = {
  location: PropTypes.shape({
    state: PropTypes.shape({
      purchaseType: PropTypes.oneOf(["course", "subscription", "cart", "one-time"]),
      userId: PropTypes.string,
      amount: PropTypes.number,
      planDetails: PropTypes.shape({
        id: PropTypes.string,
        name: PropTypes.string,
        duration: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        amount: PropTypes.number,
        courses: PropTypes.oneOfType([PropTypes.string, PropTypes.array]),
      }),
      courseDetails: PropTypes.shape({
        id: PropTypes.string,
        name: PropTypes.string,
        duration: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        price: PropTypes.number,
      }),
    }),
  }),
};

export default PaymentPage;