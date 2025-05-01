import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import CloseIcon from "/assets/icons/close.svg";
import CompanyLogo from "/assets/logos/company-logo.png";
import "../styles/ResetPassword.css";

const apiUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

const ResetPassword = () => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newPasswordError, setNewPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [globalError, setGlobalError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const queryParams = new URLSearchParams(location.search);
  const token = queryParams.get("token");

  // Prevent background scrolling
  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => {
      document.body.classList.remove("modal-open");
    };
  }, []);

  // Floating labels
  useEffect(() => {
    const newPasswordInput = document.getElementById("newPassword");
    const confirmPasswordInput = document.getElementById("confirmPassword");
    const newPasswordLabel = newPasswordInput?.nextElementSibling;
    const confirmPasswordLabel = confirmPasswordInput?.nextElementSibling;

    const updateLabel = (input, label, value) => {
      if (/\S/.test(value)) {
        input.classList.add("reset-password-modal-input-has-content");
        if (label?.classList.contains("reset-password-input-label")) {
          label.classList.add("reset-password-input-label-active");
        }
      } else {
        input.classList.remove("reset-password-modal-input-has-content");
        if (label?.classList.contains("reset-password-input-label")) {
          label.classList.remove("reset-password-input-label-active");
        }
      }
    };

    updateLabel(newPasswordInput, newPasswordLabel, newPassword);
    updateLabel(confirmPasswordInput, confirmPasswordLabel, confirmPassword);

    const handleInput = (e) => {
      const input = e.target;
      const label = input.nextElementSibling;
      updateLabel(input, label, input.value);
    };

    newPasswordInput?.addEventListener("input", handleInput);
    confirmPasswordInput?.addEventListener("input", handleInput);

    return () => {
      newPasswordInput?.removeEventListener("input", handleInput);
      confirmPasswordInput?.removeEventListener("input", handleInput);
    };
  }, [newPassword, confirmPassword]);

  // Token validation on mount
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setGlobalError("Invalid or missing reset link. Please request a new one.");
        return;
      }
      try {
        setIsLoading(true);
        const response = await fetch(`${apiUrl}/api/auth/validate-reset-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (!response.ok) {
          throw new Error("Invalid or expired reset link.");
        }
      } catch (err) {
        setGlobalError(err.message || "Invalid or expired reset link.");
      } finally {
        setIsLoading(false);
      }
    };

    validateToken();
  }, [token]);

  const validatePasswords = () => {
    let newPasswordErr = "";
    let confirmPasswordErr = "";
    let globalErr = "";

    if (!newPassword.trim()) {
      newPasswordErr = "Please enter new password.";
    } else if (newPassword.length < 8) {
      newPasswordErr = "Password must be at least 8 characters long.";
    }

    if (!confirmPassword.trim()) {
      confirmPasswordErr = "Please enter confirm new password.";
    }

    if (newPassword.trim() && confirmPassword.trim() && newPassword !== confirmPassword) {
      globalErr = "Passwords do not match.";
    }

    return { newPasswordErr, confirmPasswordErr, globalErr };
  };

  const handleNewPasswordChange = (e) => {
    const trimmedPassword = e.target.value.trimStart();
    setNewPassword(trimmedPassword);
    if (newPasswordError || globalError) {
      setNewPasswordError("");
      setGlobalError("");
    }
  };

  const handleConfirmPasswordChange = (e) => {
    const trimmedPassword = e.target.value.trimStart();
    setConfirmPassword(trimmedPassword);
    if (confirmPasswordError || globalError) {
      setConfirmPasswordError("");
      setGlobalError("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setNewPasswordError("");
    setConfirmPasswordError("");
    setGlobalError("");
    setSuccess("");
    setShowErrors(true);

    if (isLoading || !token) return;
    setIsLoading(true);

    const { newPasswordErr, confirmPasswordErr, globalErr } = validatePasswords();
    if (newPasswordErr || confirmPasswordErr || globalErr) {
      setNewPasswordError(newPasswordErr);
      setConfirmPasswordError(confirmPasswordErr);
      setGlobalError(globalErr);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          newPassword: newPassword.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 400 || response.status === 401) {
          throw new Error("Invalid or expired reset link.");
        } else if (response.status === 429) {
          throw new Error("Too many attempts. Please try again later.");
        } else {
          throw new Error(data.message || "Failed to reset password.");
        }
      }

      if (data.emailStatus && !data.emailStatus.success) {
        setGlobalError("Password reset, but confirmation email failed to send.");
      } else {
        setSuccess("Password reset successfully. Redirecting to login...");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => {
          navigate("/login", {
            state: { fromResetPassword: true },
            replace: true,
          });
        }, 4000);
      }
    } catch (err) {
      setGlobalError(
        err.message.includes("Failed to fetch")
          ? "Network error. Please check your connection."
          : err.message || "Something went wrong."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      navigate("/login", {
        state: { fromResetPassword: true },
        replace: true,
      });
    }
  };

  return (
    <div
      className="reset-password-modal-overlay"
      role="dialog"
      aria-labelledby="reset-password-title"
    >
      <div className="reset-password-modal-container">
        <button
          className="close-button"
          onClick={handleClose}
          aria-label="Close reset password modal"
          disabled={isLoading}
        >
          <img src={CloseIcon} alt="" className="close-icon" />
        </button>

        <div className="company-header">
          <img
            src={CompanyLogo}
            alt="SkillNestX Logo"
            className="company-logo"
          />
          <span className="company-name">SkillNestX</span>
        </div>

        <h2 id="reset-password-title" className="reset-password-modal-title">
          Reset Password
        </h2>
        <p className="instruction-text">
          Enter your new password below.
        </p>

        <form
          onSubmit={handleSubmit}
          className="reset-password-modal-form"
          noValidate
        >
          <div className="reset-password-input-group">
            <input
              type="text"
              id="newPassword"
              value={newPassword}
              onChange={handleNewPasswordChange}
              required
              className={`reset-password-modal-input ${
                showErrors && newPasswordError ? "reset-password-modal-input-error" : ""
              } ${
                newPassword.trim() ? "reset-password-modal-input-has-content" : ""
              }`}
              disabled={isLoading || !token || globalError.includes("Invalid")}
              aria-describedby={
                showErrors && newPasswordError
                  ? "new-password-error"
                  : success
                  ? "reset-password-success"
                  : undefined
              }
              aria-invalid={showErrors && newPasswordError ? "true" : "false"}
            />
            <label
              htmlFor="newPassword"
              className={`reset-password-input-label ${
                showErrors && newPasswordError ? "reset-password-input-label-error" : ""
              }`}
            >
              New Password
            </label>
            {showErrors && newPasswordError && (
              <p
                id="new-password-error"
                className="reset-password-error-message"
                role="alert"
              >
                {newPasswordError}
              </p>
            )}
          </div>

          <div className="reset-password-input-group">
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={handleConfirmPasswordChange}
              required
              className={`reset-password-modal-input ${
                showErrors && confirmPasswordError ? "reset-password-modal-input-error" : ""
              } ${
                confirmPassword.trim() ? "reset-password-modal-input-has-content" : ""
              }`}
              disabled={isLoading || !token || globalError.includes("Invalid")}
              aria-describedby={
                showErrors && confirmPasswordError
                  ? "confirm-password-error"
                  : success
                  ? "reset-password-success"
                  : undefined
              }
              aria-invalid={showErrors && confirmPasswordError ? "true" : "false"}
            />
            <label
              htmlFor="confirmPassword"
              className={`reset-password-input-label ${
                showErrors && confirmPasswordError ? "reset-password-input-label-error" : ""
              }`}
            >
              Confirm New Password
            </label>
            {showErrors && confirmPasswordError && (
              <p
                id="confirm-password-error"
                className="reset-password-error-message"
                role="alert"
              >
                {confirmPasswordError}
              </p>
            )}
          </div>

          {globalError && (
            <div
              id="reset-password-global-error"
              className="reset-password-global-error"
              role="alert"
            >
              {globalError}
            </div>
          )}
          {success && (
            <p
              id="reset-password-success"
              className="reset-password-success-message"
              role="status"
            >
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading || !token || globalError.includes("Invalid")}
            className={`reset-password-submit-button ${
              isLoading ? "loading" : ""
            }`}
          >
            {isLoading ? (
              <div className="reset-password-spinner-container">
                <div className="reset-password-spinner"></div>
                <span className="reset-password-button-loading">Submitting...</span>
              </div>
            ) : (
              "Reset Password"
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;