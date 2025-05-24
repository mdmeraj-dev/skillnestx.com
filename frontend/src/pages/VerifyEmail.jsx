import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import "../styles/VerifyEmail.css";
import SuccessIcon from "/assets/icons/success.svg";
import ErrorIcon from "/assets/icons/error.svg";

// Fallback logger for consistency
const logger = {
  error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta),
  warn: (msg, meta) => console.warn(`[WARN] ${msg}`, meta),
  debug: (msg, meta) => console.debug(`[DEBUG] ${msg}`, meta),
};

const VerifyEmail = ({ onAuthSuccess = () => {} }) => {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendCount, setResendCount] = useState(0);
  const navigate = useNavigate();
  const { state } = useLocation();
  const email = state?.email || null;
  const inputRefs = useRef([]);
  const BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
  const MAX_RESEND_ATTEMPTS = 3;

  // Validate BASE_URL
  useEffect(() => {
    if (!BASE_URL && process.env.NODE_ENV !== "production") {
      logger.error(
        "VITE_BACKEND_URL is not defined in environment variables",
        {}
      );
      throw new Error("Backend URL configuration missing");
    }
  }, []);

  // Prevent background scrolling
  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => {
      document.body.classList.remove("modal-open");
    };
  }, []);

  // Redirect to signup if no email is provided
  useEffect(() => {
    if (!email) {
      setMessage("No email provided. Please sign up first.");
      setMessageType("error");
      setTimeout(() => navigate("/signup"), 2000);
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setMessage("Invalid email format. Please sign up again.");
        setMessageType("error");
        setTimeout(() => navigate("/signup"), 2000);
      }
    }
  }, [email, navigate]);

  // Mask email for display
  const maskEmail = (email) => {
    const [local, domain] = email.split("@");
    if (local.length <= 3) {
      return `${local[0] + "*".repeat(local.length - 1)}@${domain}`;
    }
    const visibleStart = local.slice(0, 2);
    const visibleEnd = local.length > 8 ? local.slice(-1) : "";
    const maskedPart =
      local.length > 8 ? "*****" : "*".repeat(local.length - 3);
    return `${visibleStart}${maskedPart}${visibleEnd}@${domain}`;
  };
  const maskedEmail = email ? maskEmail(email) : "";

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Handle resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [resendCooldown]);

  // Handle OTP input changes
  const handleOtpChange = (index, value) => {
    const newOtp = [...otp];
    value = value.replace(/\D/g, "").trim();
    if (value.length > 1) {
      const pastedDigits = value.slice(0, 6).split("");
      for (let i = 0; i < 6 && i < pastedDigits.length; i++) {
        newOtp[i] = pastedDigits[i];
      }
      setOtp(newOtp);
      inputRefs.current[Math.min(pastedDigits.length - 1, 5)]?.focus();
    } else {
      newOtp[index] = value.slice(0, 1);
      setOtp(newOtp);
      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus();
      } else if (!value && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }
    setMessage("");
    setMessageType("");
  };

  // Handle paste event
  const handlePaste = (e, index) => {
    e.preventDefault();
    const pastedData = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .trim()
      .slice(0, 6);
    if (pastedData) {
      const newOtp = [...otp];
      for (let i = 0; i < 6 && i < pastedData.length; i++) {
        newOtp[i] = pastedData[i];
      }
      setOtp(newOtp);
      inputRefs.current[Math.min(pastedData.length - 1, 5)]?.focus();
    }
  };

  // Map backend error codes to user-friendly messages
  const getErrorMessage = (data, defaultMessage) => {
    const errorMessages = {
      INVALID_INPUT: "Email and OTP are required.",
      INVALID_EMAIL: "Invalid email format. Please sign up again.",
      INVALID_OTP_FORMAT: "OTP must be a 6-digit number.",
      INVALID_OTP: "Invalid OTP. Please try again.",
      EXPIRED_OTP: data.canRetry
        ? "OTP has expired. Please request a new one."
        : "OTP has expired. Please sign up again.",
      EMAIL_EXISTS: "This email is already verified. Please log in.",
      NOT_FOUND: "Signup request not found. Please sign up again.",
      EMAIL_ERROR: "Failed to send OTP email. Please try again.",
      SERVER_ERROR: "Server error. Please try again later.",
      RATE_LIMIT_EXCEEDED: "Too many requests. Please try again later.",
      MISSING_PASSWORD: "Password data missing. Please sign up again.",
      INVALID_PASSWORD_HASH: "Invalid signup data. Please sign up again.",
      INVALID_TOKEN: "Invalid token data. Please sign up again.",
    };
    return errorMessages[data.code] || data.message || defaultMessage;
  };

  // Validate user response from backend
  const validateUserResponse = (data, traceId) => {
    if (!data.user) {
      logger.warn("Verify OTP response missing user object", { traceId, data });
      throw new Error("Invalid server response. Please try again.");
    }
    const requiredFields = ["_id", "email"];
    const missingFields = requiredFields.filter((field) => !data.user[field]);
    if (missingFields.length > 0) {
      logger.warn("Verify OTP response missing required user fields", {
        traceId,
        missingFields,
        data,
      });
      throw new Error("Invalid user data from server. Please try again.");
    }
    // Default optional fields
    data.user.name = data.user.name || "User";
    data.user.role =
      data.user.role && ["user", "admin"].includes(data.user.role)
        ? data.user.role
        : "user";
    data.user.isVerified =
      data.user.isVerified !== undefined ? data.user.isVerified : true;
    // Ensure tokens are present
    if (!data.accessToken || !data.refreshToken) {
      logger.warn("Verify OTP response missing tokens", { traceId, data });
      throw new Error("Invalid token data from server. Please try again.");
    }
    return data;
  };

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
  };

  // Verify OTP with backend
  const handleVerify = async (e) => {
    e.preventDefault();
    if (loading) return;

    const fullOtp = otp.join("").trim();
    const traceId = crypto.randomUUID();
    setMessage("");
    setMessageType("");

    if (!email) {
      setMessage("Email is missing. Please sign up again.");
      setMessageType("error");
      setOtp(["", "", "", "", "", ""]);
      handleLogout();
      return;
    }

    if (fullOtp.length !== 6 || !/^\d{6}$/.test(fullOtp)) {
      setMessage("Please enter a valid 6-digit OTP.");
      setMessageType("error");
      setOtp(["", "", "", "", "", ""]);
      return;
    }

    setLoading(true);
    try {
      const requestBody = { email: email.toLowerCase(), otp: fullOtp };
      logger.debug("Verifying OTP:", { email, otp: fullOtp, traceId });

      const response = await axios.post(
        `${BASE_URL}/api/auth/verify-email`,
        requestBody,
        {
          headers: {
            "Content-Type": "application/json",
            "X-Trace-Id": traceId,
          },
        }
      );

      const data = response.data;
      logger.debug("Verify OTP response:", { data, traceId });

      if (!data.success) {
        const errorMessage = getErrorMessage(
          data,
          "Verification failed. Please try again."
        );
        throw new Error(errorMessage);
      }

      // Validate response data
      const validatedData = validateUserResponse(data, traceId);

      if (validatedData.emailStatus && !validatedData.emailStatus.success) {
        setMessage(
          `${validatedData.message}. Note: ${validatedData.emailStatus.message}. Check your spam folder or contact support.`
        );
      } else {
        setMessage(validatedData.message || "Email verified successfully!");
      }
      setMessageType("success");

      // Store tokens
      localStorage.setItem("accessToken", validatedData.accessToken);
      localStorage.setItem("refreshToken", validatedData.refreshToken);

      // Call onAuthSuccess with full validatedData
      try {
        logger.debug("Calling onAuthSuccess with data:", {
          validatedData,
          traceId,
        });
        onAuthSuccess({
          user: validatedData.user,
          accessToken: validatedData.accessToken,
          refreshToken: validatedData.refreshToken,
          redirectUrl: validatedData.redirectUrl,
        });
      } catch (authError) {
        logger.error("Error in onAuthSuccess callback:", {
          message: authError.message,
          traceId,
        });
        setMessage(
          "Verification succeeded, but an error occurred. Please log in."
        );
        setMessageType("error");
        handleLogout();
        setTimeout(() => navigate("/login"), 2000);
        return;
      }

      // Navigate to redirect URL or fallback
      const redirectUrl = validatedData.redirectUrl || "/";
      setTimeout(() => {
        navigate(redirectUrl, { state: { fromVerifyEmail: true } });
      }, 1500);
    } catch (err) {
      logger.error("VerifyEmail error:", { message: err.message, traceId });
      setMessage(err.message);
      setMessageType("error");
      setOtp(["", "", "", "", "", ""]);
      handleLogout();
      if (
        err.message.includes("sign up again") ||
        err.message.includes("log in")
      ) {
        setTimeout(
          () => navigate(err.message.includes("log in") ? "/login" : "/signup"),
          2000
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResend = async () => {
    if (
      resendLoading ||
      resendCooldown > 0 ||
      resendCount >= MAX_RESEND_ATTEMPTS
    )
      return;

    if (!email) {
      setMessage("Email is missing. Please sign up again.");
      setMessageType("error");
      setOtp(["", "", "", "", "", ""]);
      handleLogout();
      setTimeout(() => navigate("/signup"), 2000);
      return;
    }

    const traceId = crypto.randomUUID();
    setResendLoading(true);
    setMessage("");
    setMessageType("");

    try {
      const requestBody = { email: email.toLowerCase() };
      logger.debug("Resending OTP:", { email, traceId });

      const response = await axios.post(
        `${BASE_URL}/api/auth/resend-otp`,
        requestBody,
        {
          headers: {
            "Content-Type": "application/json",
            "X-Trace-Id": traceId,
          },
        }
      );

      const data = response.data;
      logger.debug("Resend OTP response:", { data, traceId });

      if (!data.success) {
        const errorMessage = getErrorMessage(
          data,
          "Failed to resend OTP. Please try again."
        );
        throw new Error(errorMessage);
      }

      setMessage(data.message || "A new OTP has been sent to your email.");
      setMessageType("success");
      setResendCount((prev) => prev + 1);
      setResendCooldown(30);
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (err) {
      logger.error("Resend OTP error:", { message: err.message, traceId });
      setMessage(err.message);
      setMessageType("error");
      setOtp(["", "", "", "", "", ""]);
      handleLogout();
      if (err.message.includes("sign up again")) {
        setTimeout(() => navigate("/signup"), 2000);
      }
    } finally {
      setResendLoading(false);
    }
  };

  // Close modal
  const handleClose = () => {
    if (!loading && !resendLoading) {
      setOtp(["", "", "", "", "", ""]);
      navigate("/signup");
    }
  };

  return (
    <div
      className="verify-email-modal-overlay"
      role="dialog"
      aria-labelledby="verify-email-title"
    >
      <div className="verify-email-modal-container">
        <button
          className="close-button"
          onClick={handleClose}
          aria-label="Close verify email modal"
          disabled={loading || resendLoading}
        >
          <span className="material-icons close-icon">close</span>
        </button>

        <div className="verify-email-company-header">
          <img
            src="/assets/logos/company-logo.png"
            alt="SkillNestX Logo"
            className="verify-email-company-logo"
          />
          <span className="verify-email-company-name">SkillNestX</span>
        </div>

        <h2 id="verify-email-title" className="verify-email-modal-title">
          Verify Your Email
        </h2>
        <div className="verify-email-instructions">
          <p className="verify-email-instruction-text">
            Enter the 6-digit code sent to your email address <span className="highlight-email">{maskedEmail}</span>
          </p>
        </div>

        <form
          onSubmit={handleVerify}
          className="verify-email-otp-form"
          noValidate
        >
          <div className="verify-email-otp-input-group">
            {otp.map((digit, i) => (
              <input
                key={i}
                type="text"
                maxLength="6"
                value={digit}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onPaste={(e) => handlePaste(e, i)}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !digit && i > 0) {
                    inputRefs.current[i - 1]?.focus();
                  }
                }}
                id={`otp-${i}`}
                ref={(el) => (inputRefs.current[i] = el)}
                className={`verify-email-otp-input ${digit ? "filled" : ""}`}
                disabled={loading || resendLoading}
                autoComplete="off"
                aria-describedby={
                  message
                    ? messageType === "success"
                      ? "verify-email-success"
                      : "verify-email-error"
                    : undefined
                }
                aria-invalid={messageType === "error" ? "true" : "false"}
              />
            ))}
          </div>

          {message && (
            <p
              id={
                messageType === "success"
                  ? "verify-email-success"
                  : "verify-email-error"
              }
              className={
                messageType === "success"
                  ? "verify-email-success-message"
                  : "verify-email-error-message"
              }
              role={messageType === "success" ? "status" : "alert"}
            >
              <img
                src={messageType === "success" ? SuccessIcon : ErrorIcon}
                alt={messageType === "success" ? "Success" : "Error"}
                className="message-icon"
              />
              {message}
            </p>
          )}

          <button
            type="submit"
            className={`verify-email-submit-button ${loading ? "loading" : ""}`}
            disabled={loading || otp.join("").length !== 6}
          >
            {loading ? (
              <div className="verify-email-spinner-container">
                <div className="verify-email-spinner"></div>
                <span className="verify-email-button-loading">
                  Verifying...
                </span>
              </div>
            ) : (
              "Continue"
            )}
          </button>
        </form>

        <div className="verify-email-resend-section">
          <p>Didn't receive the code?</p>
          <button
            onClick={handleResend}
            disabled={
              resendLoading ||
              resendCooldown > 0 ||
              !email ||
              resendCount >= MAX_RESEND_ATTEMPTS
            }
            className="verify-email-resend-button"
          >
            {resendLoading
              ? "Resending..."
              : resendCooldown > 0
              ? `Resend in ${resendCooldown}s`
              : resendCount >= MAX_RESEND_ATTEMPTS
              ? "Max resend attempts reached"
              : "Resend OTP"}
          </button>
        </div>

        <div className="verify-email-support-note">
          <p>
           Check your spam folder if you didn’t get it.
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;