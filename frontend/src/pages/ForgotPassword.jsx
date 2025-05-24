import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import CloseIcon from "/assets/icons/close.svg";
import CompanyLogo from "/assets/logos/company-logo.png";
import "../styles/ForgotPassword.css";

// Fallback logger for consistency with other files
const logger = {
  error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta),
  warn: (msg, meta) => console.warn(`[WARN] ${msg}`, meta),
};

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  // Validate BASE_URL
  useEffect(() => {
    if (!BASE_URL && process.env.NODE_ENV !== "production") {
      logger.error("VITE_BACKEND_URL is not defined in environment variables", {});
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

  // Client-side email validation
  const validateEmail = (emailValue) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailValue.trim()) {
      return "Please enter your email.";
    }
    if (!emailRegex.test(emailValue)) {
      return "Please enter a valid email address.";
    }
    if (emailValue.length > 254) {
      return "Email address is too long.";
    }
    return "";
  };

  // Handle input change, clear error when typing starts
  const handleEmailChange = (e) => {
    const trimmedEmail = e.target.value.trimStart();
    setEmail(trimmedEmail);
    if (error) {
      setError("");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccess("");
    if (isLoading) return; // Prevent multiple submissions
    setIsLoading(true);

    // Validate only on submit
    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      setIsLoading(false);
      return;
    }

    const traceId = crypto.randomUUID();
    try {
      const response = await axios.post(
        `${BASE_URL}/api/auth/forgot-password`,
        { email: email.trim() },
        {
          headers: {
            "Content-Type": "application/json",
            "X-Trace-Id": traceId,
          },
        }
      );

      if (response.data.success) {
        setSuccess("A reset link has been sent to your email.");
        setEmail("");
        handleLogout();
        setTimeout(() => {
          setSuccess("");
          navigate("/login", { state: { fromForgotPassword: true } });
        }, 4000);
      } else {
        throw new Error(response.data.message || "Failed to send reset email.");
      }
    } catch (error) {
      logger.error("Forgot password error", {
        status: error.response?.status,
        data: error.response?.data,
        traceId: error.response?.data?.traceId || traceId,
      });
      handleLogout();
      if (error.response) {
        const { status, data } = error.response;
        if (status === 400 && data.code === "EMAIL_NOT_FOUND") {
          setError("No account found with this email.");
        } else if (status === 429 || data.code === "RATE_LIMIT_EXCEEDED") {
          setError("Too many requests. Please try again later.");
        } else {
          setError(data.message || "Failed to send reset email.");
        }
      } else {
        setError(
          error.message ||
            "Unable to send reset email. Please try again later or contact support."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      navigate("/login", { state: { fromForgotPassword: true } });
    }
  };

  return (
    <div
      className="forgot-password-modal-overlay"
      role="dialog"
      aria-labelledby="forgot-password-title"
    >
      <div className="forgot-password-modal-container">
        <button
          className="close-button"
          onClick={handleClose}
          aria-label="Close forgot password modal"
          disabled={isLoading}
        >
          <img src={CloseIcon} alt="" className="close-icon" />
        </button>

        <div className="company-header">
          <img src={CompanyLogo} alt="SkillNestX Logo" className="company-logo" />
          <span className="company-name">SkillNestX</span>
        </div>

        <h2 id="forgot-password-title" className="forgot-password-modal-title">
          Forgot Password
        </h2>
        <p className="instruction-text">
          Enter the email address associated with your account to receive a
          password reset link.
        </p>

        <form
          onSubmit={handleSubmit}
          className="forgot-password-modal-form"
          noValidate
        >
          <div className="forgot-password-input-group">
            <input
              type="email"
              id="email"
              value={email}
              onChange={handleEmailChange}
              required
              className={`forgot-password-modal-input ${
                error ? "forgot-password-modal-input-error" : ""
              } ${
                email.trim() ? "forgot-password-modal-input-has-content" : ""
              }`}
              disabled={isLoading}
              aria-describedby={
                error
                  ? "forgot-password-email-error"
                  : success
                  ? "forgot-password-email-success"
                  : undefined
              }
              aria-invalid={error ? "true" : "false"}
            />
            <label
              htmlFor="email"
              className={`forgot-password-input-label ${
                error ? "forgot-password-input-label-error" : ""
              }`}
            >
              Enter Email
            </label>
            {error && (
              <p
                id="forgot-password-email-error"
                className="forgot-password-error-message"
                role="alert"
              >
                {error}
              </p>
            )}
          </div>

          {success && (
            <p
              id="forgot-password-email-success"
              className="forgot-password-success-message"
              role="status"
            >
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={`forgot-password-submit-button ${
              isLoading ? "loading" : ""
            }`}
          >
            {isLoading ? (
              <div className="forgot-password-spinner-container">
                <div className="forgot-password-spinner"></div>
                <span className="login-button-loading">Sending...</span>
              </div>
            ) : (
              "Send Link"
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;