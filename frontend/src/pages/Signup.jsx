import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Link, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import "../styles/Signup.css";

// Fallback logger
const logger = {
  error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta),
  warn: (msg, meta) => console.warn(`[WARN] ${msg}`, meta),
};

const Signup = ({ onClose, onSignupSuccess }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  // Validate BASE_URL
  useEffect(() => {
    if (!BASE_URL && process.env.NODE_ENV !== "production") {
      logger.error("VITE_BACKEND_URL is not defined", {});
      throw new Error("Backend URL configuration missing");
    }
  }, []);

  // Handle Google OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const accessToken = params.get("accessToken");
    const refreshToken = params.get("refreshToken");
    const errorMessage = params.get("error");
    const success = params.get("success");

    if (errorMessage) {
      setError(decodeURIComponent(errorMessage));
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      navigate("/signup", { replace: true });
      return;
    }

    if (accessToken && refreshToken && success === "true") {
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
      if (typeof onSignupSuccess === "function") {
        onSignupSuccess();
      }
      if (typeof onClose === "function") {
        onClose();
      }
      const targetUrl = location.state?.from || "/dashboard";
      navigate(targetUrl, { replace: true });
    }
  }, [location, navigate, onClose, onSignupSuccess]);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    document.body.classList.add("login-modal-open");
    return () => {
      document.body.classList.remove("login-modal-open");
    };
  }, []);

  // Floating labels logic
  useEffect(() => {
    const nameInput = document.getElementById("name");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const nameLabel = nameInput?.nextElementSibling;
    const emailLabel = emailInput?.nextElementSibling;
    const passwordLabel = passwordInput?.nextElementSibling;

    const updateLabel = (input, label, value) => {
      if (/\S/.test(value)) {
        input.classList.add("signup-input-field-has-content");
        if (label?.classList.contains("signup-input-label")) {
          label.classList.add("signup-input-label-active");
        }
      } else {
        input.classList.remove("signup-input-field-has-content");
        if (label?.classList.contains("signup-input-label")) {
          label.classList.remove("signup-input-label-active");
        }
      }
    };

    updateLabel(nameInput, nameLabel, name);
    updateLabel(emailInput, emailLabel, email);
    updateLabel(passwordInput, passwordLabel, password);

    const handleInput = (e) => {
      const input = e.target;
      const label = input.nextElementSibling;
      updateLabel(input, label, input.value);
    };

    nameInput?.addEventListener("input", handleInput);
    emailInput?.addEventListener("input", handleInput);
    passwordInput?.addEventListener("input", handleInput);

    return () => {
      nameInput?.removeEventListener("input", handleInput);
      emailInput?.removeEventListener("input", handleInput);
      passwordInput?.removeEventListener("input", handleInput);
    };
  }, [name, email, password]);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleError = (errorId, errorMessage) => {
    const errorElement = document.getElementById(errorId);
    const inputElement = document.getElementById(errorId.replace("Error", ""));
    const labelElement = inputElement?.nextElementSibling;

    if (!errorElement || !inputElement) return;

    if (errorMessage) {
      errorElement.textContent = errorMessage;
      errorElement.style.display = "block";
      inputElement.classList.add("signup-input-error");
      if (labelElement && labelElement.classList.contains("signup-input-label")) {
        labelElement.classList.add("signup-input-label-error");
      }
      if (errorId === "nameError") {
        setNameError(errorMessage);
      } else if (errorId === "emailError") {
        setEmailError(errorMessage);
      } else if (errorId === "passwordError") {
        setPasswordError(errorMessage);
      }
    } else {
      errorElement.textContent = "";
      errorElement.style.display = "none";
      inputElement.classList.remove("signup-input-error");
      if (labelElement && labelElement.classList.contains("signup-input-label")) {
        labelElement.classList.remove("signup-input-label-error");
      }
      if (errorId === "nameError") {
        setNameError("");
      } else if (errorId === "emailError") {
        setEmailError("");
      } else if (errorId === "passwordError") {
        setPasswordError("");
      }
    }
  };

  const validateName = () => {
    const nameRegex = /^[a-zA-Z\s]+$/;
    if (!name.trim()) return { isValid: false, message: "Please enter your name" };
    if (!nameRegex.test(name)) return { isValid: false, message: "Name can only contain letters and spaces" };
    return { isValid: true, message: "" };
  };

  const validateEmail = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) return { isValid: false, message: "Please enter your email" };
    if (!emailRegex.test(email)) return { isValid: false, message: "Please enter a valid email address" };
    return { isValid: true, message: "" };
  };

  const validatePassword = () => {
    if (!password.trim()) return { isValid: false, message: "Please enter your password" };
    if (password.length < 8) return { isValid: false, message: "Password must be at least 8 characters" };
    return { isValid: true, message: "" };
  };

  const calculateStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.match(/([a-z])/)) strength++;
    if (password.match(/([A-Z])/)) strength++;
    if (password.match(/([0-9])/)) strength++;
    if (password.match(/([^a-zA-Z0-9])/)) strength++;
    return strength;
  };

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    setShowErrors(true);
    setError("");

    const nameValidation = validateName();
    const emailValidation = validateEmail();
    const passwordValidation = validatePassword();

    handleError("nameError", nameValidation.message);
    handleError("emailError", emailValidation.message);
    handleError("passwordError", passwordValidation.message);

    if (!nameValidation.isValid || !emailValidation.isValid || !passwordValidation.isValid) {
      return;
    }

    setIsEmailLoading(true);
    const traceId = window.crypto.randomUUID?.() || `fallback-${Date.now().toString(36)}`;

    try {
      const response = await axios.post(
        `${BASE_URL}/api/auth/signup`,
        {
          name: name.trim(),
          email: email.trim(),
          password: password.trim(),
        },
        {
          headers: {
            "X-Trace-Id": traceId,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.success) {
        if (typeof onClose === "function") {
          onClose();
        }
        if (typeof onSignupSuccess === "function") {
          onSignupSuccess();
        }
        navigate("/verify-email", {
          state: { email: email.trim() },
          replace: true,
        });
      } else {
        throw new Error(response.data.message || "Signup failed");
      }
    } catch (error) {
      const backendTraceId = error.response?.data?.traceId || traceId;
      if (error.response) {
        const { status, data } = error.response;
        logger.error("Signup error", {
          status,
          data,
          traceId: backendTraceId,
        });
        if (status === 400 && data.code === "EMAIL_EXISTS") {
          handleError("emailError", "Email already registered");
        } else if (status === 400 && data.code === "EMAIL_CONFLICT") {
          handleError("emailError", "Email already registered");
        } else if (status === 429) {
          setError("Too many signup attempts. Please try again later.");
        } else {
          setError(data.message || "Something went wrong. Please try again.");
        }
      } else {
        logger.error("Signup error", { error: error.message, traceId: backendTraceId });
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setError("");
    try {
      const state = encodeURIComponent(
        JSON.stringify({ redirectPath: location.state?.from || "/dashboard" })
      );
      const nonce = window.crypto.randomUUID?.() || `nonce-${Date.now().toString(36)}`;
      const googleAuthUrl = new URL(`${BASE_URL}/api/auth/google`);
      googleAuthUrl.searchParams.set("state", state);
      googleAuthUrl.searchParams.set("prompt", "select_account consent");
      googleAuthUrl.searchParams.set("access_type", "offline");
      googleAuthUrl.searchParams.set("nonce", nonce);

      window.location.href = googleAuthUrl.toString();
    } catch (error) {
      logger.error("Google Signup error", { error: error.message });
      setError("Failed to initiate Google signup. Please try again.");
      setIsGoogleLoading(false);
    }
  };

  const handleClose = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!isEmailLoading && !isGoogleLoading && typeof onClose === "function") {
      onClose();
      navigate("/");
    }
  };

  const handleLinkNavigation = (e, path) => {
    e.preventDefault();
    if (isEmailLoading || isGoogleLoading) {
      return;
    }
    if (typeof onClose === "function") {
      onClose();
    }
    setTimeout(() => {
      navigate(path, { state: { from: location.pathname + location.search } });
    }, 0);
  };

  return (
    <div className="signup-modal-overlay">
      <div className="signup-container">
        <button
          className="signup-close-button"
          onClick={handleClose}
          aria-label="Close"
        >
          <img src="/assets/icons/close.svg" alt="Close" />
        </button>

        <div className="signup-company-header">
          <img
            src="/assets/logos/company-logo.png"
            alt="Company Logo"
            className="signup-company-logo"
          />
          <h1 className="signup-company-name">SkillNestX</h1>
        </div>

        <form
          id="signupForm"
          className="signup-form"
          onSubmit={handleFormSubmit}
          noValidate
        >
          <h1 className="signup-title">Create an Account</h1>

          <div className="signup-form-group">
            <input
              type="text"
              id="name"
              className={`signup-input-field ${nameError ? "signup-input-error" : ""}`}
              aria-label="Name"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                handleError("nameError", "");
              }}
              disabled={isEmailLoading || isGoogleLoading}
            />
            <label
              htmlFor="name"
              className={`signup-input-label ${nameError ? "signup-input-label-error" : ""}`}
            >
              Name
            </label>
            <span id="nameError" className="signup-error-message"></span>
          </div>

          <div className="signup-form-group">
            <input
              type="email"
              id="email"
              className={`signup-input-field ${emailError ? "signup-input-error" : ""}`}
              aria-label="Email address"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                handleError("emailError", "");
                setError("");
              }}
              disabled={isEmailLoading || isGoogleLoading}
            />
            <label
              htmlFor="email"
              className={`signup-input-label ${emailError ? "signup-input-label-error" : ""}`}
            >
              Email
            </label>
            <span id="emailError" className="signup-error-message"></span>
          </div>

          <div className="signup-form-group">
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              className={`signup-input-field ${passwordError ? "signup-input-error" : ""}`}
              required
              minLength="8"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                handleError("passwordError", "");
              }}
              disabled={isEmailLoading || isGoogleLoading}
            />
            <label
              htmlFor="password"
              className={`signup-input-label ${passwordError ? "signup-input-label-error" : ""}`}
            >
              Password
            </label>
            <span
              className="signup-password-visibility"
              onClick={!(isEmailLoading || isGoogleLoading) ? togglePasswordVisibility : undefined}
              role="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              tabIndex={!(isEmailLoading || isGoogleLoading) ? 0 : -1}
              onKeyDown={(e) => {
                if (!(isEmailLoading || isGoogleLoading) && e.key === "Enter") {
                  togglePasswordVisibility();
                }
              }}
            >
              {showPassword ? (
                <img src="/assets/icons/open-eye.svg" alt="Hide Password" />
              ) : (
                <img src="/assets/icons/close-eye.svg" alt="Show Password" />
              )}
            </span>
            <span id="passwordError" className="signup-error-message"></span>
          </div>

          {password && (showErrors ? validatePassword().isValid : true) && (
            <div className="signup-strength-indicator">
              <div className="signup-strength-segments">
                {[1, 2, 3, 4, 5].map((level) => (
                  <div
                    key={level}
                    className={`signup-strength-segment ${
                      calculateStrength(password) >= level ? "active" : ""
                    }`}
                    style={{
                      backgroundColor:
                        calculateStrength(password) >= level
                          ? getSegmentColor(calculateStrength(password))
                          : "#e0e0e0",
                    }}
                  ></div>
                ))}
              </div>
              <span
                className="signup-strength-label"
                style={{ color: getSegmentColor(calculateStrength(password)) }}
              >
                {getStrengthLabel(calculateStrength(password))}
              </span>
            </div>
          )}

          {error && (
            <div className="signup-global-error" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="signup-button"
            disabled={isEmailLoading || isGoogleLoading}
            aria-busy={isEmailLoading}
          >
            {isEmailLoading ? (
              <div className="signup-spinner-container">
                <div className="signup-spinner"></div>
                <span className="signup-button-loading">Signing up...</span>
              </div>
            ) : (
              "Sign up"
            )}
          </button>

          <div className="signup-divider" aria-hidden="true">
            <span className="signup-divider-text">or</span>
          </div>

          <div className="signup-social-buttons">
            <button
              type="button"
              className="signup-social-button signup-google-button"
              aria-label="Continue with Google"
              onClick={handleGoogleLogin}
              disabled={isEmailLoading || isGoogleLoading}
              aria-busy={isGoogleLoading}
            >
              {isGoogleLoading ? (
                <div className="signup-spinner-container">
                  <div className="signup-spinner"></div>
                  <span className="signup-button-loading">Processing...</span>
                </div>
              ) : (
                <>
                  <img
                    src="/assets/icons/google.svg"
                    alt=""
                    className="signup-social-icon"
                    aria-hidden="true"
                  />
                  <span className="signup-social-button-text">
                    Continue with Google
                  </span>
                </>
              )}
            </button>
          </div>

          <div className="signup-login-link">
            <p className="signup-login-text">
              Already have an account?{" "}
              <Link
                to="/login"
                onClick={(e) => handleLinkNavigation(e, "/login")}
                className={`signup-login-anchor ${
                  isEmailLoading || isGoogleLoading ? "signup-disabled-link" : ""
                }`}
                aria-disabled={isEmailLoading || isGoogleLoading}
              >
                Log in
              </Link>
            </p>
          </div>

          <div className="signup-terms-privacy">
            <Link
              to="/terms-of-service"
              onClick={(e) => handleLinkNavigation(e, "/terms-of-service")}
              className={`signup-terms-link ${
                isEmailLoading || isGoogleLoading ? "signup-disabled-link" : ""
              }`}
              aria-disabled={isEmailLoading || isGoogleLoading}
            >
              Terms of Service
            </Link>
            <span className="signup-terms-divider">|</span>
            <Link
              to="/privacy-policy"
              onClick={(e) => handleLinkNavigation(e, "/privacy-policy")}
              className={`signup-privacy-link ${
                isEmailLoading || isGoogleLoading ? "signup-disabled-link" : ""
              }`}
              aria-disabled={isEmailLoading || isGoogleLoading}
            >
              Privacy Policy
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

const getSegmentColor = (strength) => {
  switch (strength) {
    case 1:
      return "#ff0000";
    case 2:
      return "#ffaf00";
    case 3:
      return "#ffaf00";
    case 4:
      return "#54b435";
    case 5:
      return "#54b435";
    default:
      return "#e0e0e0";
  }
};

const getStrengthLabel = (strength) => {
  switch (strength) {
    case 1:
      return "Weak";
    case 2:
      return "Fair";
    case 3:
      return "Good";
    case 4:
      return "Strong";
    case 5:
      return "Very Strong";
    default:
      return "";
  }
};

Signup.propTypes = {
  onClose: PropTypes.func,
  onSignupSuccess: PropTypes.func,
};

export default Signup;