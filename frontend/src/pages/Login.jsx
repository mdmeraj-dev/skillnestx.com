import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { Link, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import "../styles/Login.css";

// Fallback logger if not provided by the app
const logger = {
  error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta),
  warn: (msg, meta) => console.warn(`[WARN] ${msg}`, meta),
  debug: (msg, meta) => console.debug(`[DEBUG] ${msg}`, meta),
};

const Login = ({ onClose, onLoginSuccess, onAuthSuccess, setShowLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
  const modalId = location.pathname === "/login" ? "login-page" : "login-modal";

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
    document.body.classList.add("login-modal-open");
    return () => {
      document.body.classList.remove("login-modal-open");
    };
  }, []);

  // Trigger setShowLogin
  useEffect(() => {
    if (setShowLogin) {
      setShowLogin(true);
    }
    return () => {
      if (setShowLogin) {
        setShowLogin(false);
      }
    };
  }, [setShowLogin]);

  // Floating labels
  useEffect(() => {
    const emailInput = document.getElementById(`${modalId}-email`);
    const passwordInput = document.getElementById(`${modalId}-password`);
    const emailLabel = emailInput?.nextElementSibling;
    const passwordLabel = passwordInput?.nextElementSibling;

    const updateLabel = (input, label, value) => {
      if (/\S/.test(value)) {
        input.classList.add("login-input-field-has-content");
        if (label?.classList.contains("login-input-label")) {
          label.classList.add("login-input-label-active");
        }
      } else {
        input.classList.remove("login-input-field-has-content");
        if (label?.classList.contains("login-input-label")) {
          label.classList.remove("login-input-label-active");
        }
      }
    };

    updateLabel(emailInput, emailLabel, email);
    updateLabel(passwordInput, passwordLabel, password);

    const handleInput = (e) => {
      const input = e.target;
      const label = input.nextElementSibling;
      updateLabel(input, label, input.value);
    };

    emailInput?.addEventListener("input", handleInput);
    passwordInput?.addEventListener("input", handleInput);

    return () => {
      emailInput?.removeEventListener("input", handleInput);
      passwordInput?.removeEventListener("input", handleInput);
    };
  }, [email, password, modalId]);

  // Handle successful login
  const handleSuccessfulLogin = useCallback(
    (userData, redirectUrl) => {
      const traceId = crypto.randomUUID();
      if (typeof onAuthSuccess === "function") {
        onAuthSuccess(userData);
      }
      if (typeof onLoginSuccess === "function") {
        onLoginSuccess();
      }
      if (typeof onClose === "function") {
        onClose();
      }
      const targetUrl = redirectUrl
        ? new URL(redirectUrl, BASE_URL).pathname
        : location.state?.from || "/";
      navigate(targetUrl, { replace: true });
    },
    [onAuthSuccess, onLoginSuccess, onClose, navigate, location.state, BASE_URL]
  );

  // Handle Google OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const accessToken = params.get("accessToken");
    const refreshToken = params.get("refreshToken");
    const user = params.get("user");
    const errorMessage = params.get("error");

    if (location.state?.error) {
      setError(location.state.error);
      navigate(location.pathname, { replace: true, state: {} });
      return;
    }

    if (errorMessage) {
      let displayError = decodeURIComponent(errorMessage);
      // Handle JSON error responses
      try {
        const parsedError = JSON.parse(displayError);
        if (parsedError.message && parsedError.code === "PROVIDER_MISMATCH") {
          displayError = parsedError.message; // e.g., "This account is registered with email"
        } else if (parsedError.message) {
          displayError = parsedError.message; // Fallback for other JSON errors
        } else {
          displayError = "Google login failed. Please try again.";
        }
      } catch (e) {
        // Handle PROVIDER_MISMATCH case when backend sends "Google authentication failed"
        if (displayError === "Google authentication failed") {
          displayError =
            "This account is registered with email. Please use email to log in.";
        } else if (displayError.includes("Internal server error")) {
          displayError = "Authentication failed. Please try again.";
        } else {
          displayError = displayError; // Use the decoded error message as-is
        }
      }
      setError(displayError);
      navigate("/login", { replace: true });
      return;
    }

    if (accessToken && refreshToken && user) {
      const traceId = crypto.randomUUID();
      try {
        const userData = JSON.parse(decodeURIComponent(user));
        localStorage.setItem("accessToken", accessToken);
        localStorage.setItem("refreshToken", refreshToken);
        localStorage.setItem("user", JSON.stringify(userData));
        handleSuccessfulLogin(
          { user: userData, accessToken, refreshToken },
          userData.redirectUrl || location.state?.from || "/"
        );
        logger.debug("Google OAuth login successful", {
          traceId,
          email: userData.email,
        });
      } catch (error) {
        logger.error("Failed to parse Google OAuth user data", {
          error: error.message,
          traceId,
        });
        setError("Google login failed. Please try again.");
        handleLogout();
      }
      navigate("/login", { replace: true });
    }
  }, [location, navigate, BASE_URL, handleSuccessfulLogin]);

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user"); // Added to clear user data
  };

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
      inputElement.classList.add("login-input-error");
      if (labelElement?.classList.contains("login-input-label")) {
        labelElement.classList.add("login-input-label-error");
      }
      if (errorId === `${modalId}-emailError`) setEmailError(errorMessage);
      else if (errorId === `${modalId}-passwordError`)
        setPasswordError(errorMessage);
    } else {
      errorElement.textContent = "";
      errorElement.style.display = "none";
      inputElement.classList.remove("login-input-error");
      if (labelElement?.classList.contains("login-input-label")) {
        labelElement.classList.remove("login-input-label-error");
      }
      if (errorId === `${modalId}-emailError`) setEmailError("");
      else if (errorId === `${modalId}-passwordError`) setPasswordError("");
    }
  };

  const validateEmail = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) return { isValid: false, message: "Please enter your email" };
    if (!emailRegex.test(email))
      return { isValid: false, message: "Please enter a valid email address" };
    return { isValid: true, message: "" };
  };

  const validatePassword = () => {
    if (!password)
      return { isValid: false, message: "Please enter your password" };
    if (password.length < 8)
      return {
        isValid: false,
        message: "Password must be at least 8 characters",
      };
    return { isValid: true, message: "" };
  };

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    setShowErrors(true);
    setError("");

    const emailValidation = validateEmail();
    const passwordValidation = validatePassword();

    handleError(`${modalId}-emailError`, emailValidation.message);
    handleError(`${modalId}-passwordError`, passwordValidation.message);

    if (!emailValidation.isValid || !passwordValidation.isValid) return;

    setIsEmailLoading(true);

    const traceId = crypto.randomUUID();
    try {
      const response = await axios.post(
        `${BASE_URL}/api/auth/login`,
        { email, password },
        {
          headers: {
            "X-Trace-Id": traceId,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.success) {
        const { accessToken, refreshToken, user, redirectUrl } = response.data;
        localStorage.setItem("accessToken", accessToken);
        localStorage.setItem("refreshToken", refreshToken);
        localStorage.setItem("user", JSON.stringify(user));
        const userData = {
          user,
          accessToken,
          refreshToken,
          redirectUrl,
        };
        handleSuccessfulLogin(userData, redirectUrl);
      } else {
        logger.error("Login failed", { data: response.data, traceId });
        throw new Error(response.data.message || "Login failed");
      }
    } catch (error) {
      handleLogout();
      if (error.response) {
        const { status, data } = error.response;
        logger.error("Login error", {
          status,
          data,
          traceId: data?.traceId || traceId,
        });
        if (status === 404) {
          handleError(
            `${modalId}-emailError`,
            "No account found for this email"
          );
        } else if (status === 401) {
          if (data.code === "INVALID_CREDENTIALS") {
            handleError(
              `${modalId}-passwordError`,
              "Invalid email or password"
            );
          } else if (
            data.code === "INVALID_TOKEN" ||
            data.message?.includes("malformed") ||
            data.message?.includes("Invalid or malformed token")
          ) {
            setError(
              "Invalid authentication token. Please try logging in again."
            );
          } else {
            setError("Authentication failed. Please try again.");
          }
        } else if (status === 403 && data.code === "EMAIL_NOT_VERIFIED") {
          setError("Please verify your email before logging in");
        } else if (status === 400 && data.code === "PROVIDER_MISMATCH") {
          setError(
            "This email is registered with Google. Please use Google to login."
          );
        } else if (status === 429) {
          setError("Too many login attempts. Please try again later.");
        } else {
          setError(data.message || "Login failed. Please try again.");
        }
      } else {
        logger.error("Login error", { error: error.message, traceId });
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const traceId = crypto.randomUUID();
    try {
      setIsGoogleLoading(true);
      setError("");
      const state = encodeURIComponent(
        JSON.stringify({
          redirectPath: location.state?.from || location.pathname,
        })
      );
      window.location.href = `${BASE_URL}/api/auth/google?state=${state}&prompt=select_account%20consent`;
    } catch (error) {
      logger.error("Google login error", { error: error.message, traceId });
      setError("Google login failed. Please try again.");
      setIsGoogleLoading(false);
      handleLogout();
    }
  };

  const handleClose = () => {
    if (!isEmailLoading && !isGoogleLoading) {
      if (typeof onClose === "function") {
        onClose();
      }
      const from = location.state?.from || "/";
      navigate(from);
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
      navigate(path, {
        state: { from: location.state?.from || location.pathname },
      });
    }, 0);
  };

  return (
    <div
      className={
        modalId === "login-modal"
          ? "login-modal-overlay"
          : "login-page-container login-modal-overlay"
      }
    >
      <div className="login-container">
        <button
          className="login-close-button"
          onClick={handleClose}
          aria-label="Close login modal"
        >
          <img
            src="/assets/icons/close.svg"
            alt="Close"
            onError={() =>
              logger.error("Failed to load /assets/icons/close.svg", {})
            }
          />
          <span style={{ display: "none" }}>X</span>
        </button>

        <div className="login-company-header">
          <img
            src="/assets/logos/company-logo.png"
            alt="Company Logo"
            className="login-company-logo"
          />
          <h1 className="login-company-name">SkillNestX</h1>
        </div>

        <form
          id={`${modalId}-form`}
          className="login-form"
          onSubmit={handleLoginSubmit}
          noValidate
        >
          <h1 className="login-title">Welcome Back</h1>

          <div className="login-form-group">
            <input
              type="email"
              id={`${modalId}-email`}
              className={`login-input-field ${
                emailError ? "login-input-error" : ""
              }`}
              aria-label="Email address"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                handleError(`${modalId}-emailError`, "");
              }}
              disabled={isEmailLoading || isGoogleLoading}
            />
            <label
              htmlFor={`${modalId}-email`}
              className={`login-input-label ${
                emailError ? "login-input-label-error" : ""
              }`}
            >
              Email
            </label>
            <span
              id={`${modalId}-emailError`}
              className="login-error-message"
            ></span>
          </div>

          <div className="login-form-group">
            <input
              type={showPassword ? "text" : "password"}
              id={`${modalId}-password`}
              className={`login-input-field ${
                passwordError ? "login-input-error" : ""
              }`}
              name="password"
              required
              minLength="8"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                handleError(`${modalId}-passwordError`, "");
              }}
              disabled={isEmailLoading || isGoogleLoading}
            />
            <label
              htmlFor={`${modalId}-password`}
              className={`login-input-label ${
                passwordError ? "login-input-label-error" : ""
              }`}
            >
              Password
            </label>
            <span
              className="login-password-visibility"
              onClick={
                !(isEmailLoading || isGoogleLoading)
                  ? togglePasswordVisibility
                  : undefined
              }
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
            <span
              id={`${modalId}-passwordError`}
              className="login-error-message"
            ></span>
          </div>

          <div className="login-forgot-password">
            <Link
              to="/forgot-password"
              onClick={(e) => handleLinkNavigation(e, "/forgot-password")}
              aria-disabled={isEmailLoading || isGoogleLoading}
              className={
                isEmailLoading || isGoogleLoading ? "login-disabled-link" : ""
              }
            >
              Forgot Password?
            </Link>
          </div>

          {error && (
            <div className="login-global-error" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="login-button"
            disabled={isEmailLoading || isGoogleLoading}
            aria-busy={isEmailLoading}
          >
            {isEmailLoading ? (
              <div className="login-spinner-container">
                <div className="login-spinner"></div>
                <span className="login-button-loading">Logging in...</span>
              </div>
            ) : (
              "Log in"
            )}
          </button>

          <div className="login-divider" aria-hidden="true">
            <span className="login-divider-text">or</span>
          </div>

          <div className="login-social-buttons">
            <button
              type="button"
              className="login-social-button login-google-button"
              aria-label="Continue with Google"
              onClick={handleGoogleLogin}
              disabled={isEmailLoading || isGoogleLoading}
              aria-busy={isGoogleLoading}
            >
              {isGoogleLoading ? (
                <div className="login-spinner-container">
                  <div className="login-spinner"></div>
                  <span className="login-button-loading">Processing...</span>
                </div>
              ) : (
                <>
                  <img
                    src="/assets/icons/google.svg"
                    alt=""
                    className="login-social-icon"
                    aria-hidden="true"
                  />
                  <span className="login-social-button-text">
                    Continue with Google
                  </span>
                </>
              )}
            </button>
          </div>

          <div className="login-signup-link">
            <p className="login-signup-text">
              Don't have an account?{" "}
              <Link
                to="/signup"
                onClick={(e) => handleLinkNavigation(e, "/signup")}
                className={`login-signup-anchor ${
                  isEmailLoading || isGoogleLoading ? "login-disabled-link" : ""
                }`}
                aria-disabled={isEmailLoading || isGoogleLoading}
              >
                Sign up
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

Login.propTypes = {
  onClose: PropTypes.func,
  onLoginSuccess: PropTypes.func,
  onAuthSuccess: PropTypes.func,
  setShowLogin: PropTypes.func,
};

export default Login;