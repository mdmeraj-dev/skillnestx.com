import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import CloseIcon from "/assets/icons/close.svg"; // Adjust path to your close icon
import CompanyLogo from "/assets/logos/company-logo.png"; // Adjust path to your logo
import "../styles/ForgotPassword.css";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

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

    try {
      const apiUrl = import.meta.env.VITE_BACKEND_URL;
      if (!apiUrl) {
        throw new Error("API URL is not configured. Please contact support.");
      }
      const response = await fetch(`${apiUrl}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("No account found with this email.");
        } else if (response.status === 429) {
          throw new Error("Too many requests. Please try again later.");
        } else {
          throw new Error(data.message || "Failed to send reset email.");
        }
      }

      setSuccess("A reset link has been sent to your email.");
      setEmail("");
      setTimeout(() => {
        setSuccess("");
        navigate("/login", { state: { fromForgotPassword: true } });
      }, 4000);
    } catch (err) {
      setError(
        err.message ||
          "Unable to send reset email. Please try again later or contact support."
      );
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