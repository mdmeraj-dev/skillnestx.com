import { useState, useEffect, useRef, lazy, Suspense, memo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import PropTypes from "prop-types";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { useCart } from "../hooks/useCart";
import "../styles/Navbar.css";
import "../styles/Search.css";

// Fallback logger if not provided by the app
const logger = {
  error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta),
  info: (msg, meta) => console.info(`[INFO] ${msg}`, meta),
  warn: (msg, meta) => console.warn(`[WARN] ${msg}`, meta),
};

// Lazy-loaded components for better performance
const Login = lazy(() => import("../pages/Login"));
const SignUp = lazy(() => import("../pages/Signup"));
const UserProfile = lazy(() => import("../components/profile/UserProfile"));

const BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

// Configure Axios with base URL
const api = axios.create({
  baseURL: BASE_URL,
});

// Axios interceptor for token refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      originalRequest.url !== "/api/auth/refresh-token" &&
      originalRequest.url !== "/api/auth/logout"
    ) {
      originalRequest._retry = true;
      const traceId = crypto.randomUUID();
      try {
        const accessToken = localStorage.getItem("accessToken");
        const refreshToken = localStorage.getItem("refreshToken");
        if (!accessToken || !refreshToken) {
          logger.warn("No tokens for refresh in interceptor", { traceId });
          throw new Error("Missing tokens");
        }
        let decodedAccess;
        try {
          decodedAccess = jwtDecode(accessToken);
          if (decodedAccess.exp * 1000 < Date.now()) {
            logger.warn("Access token expired", { traceId, userId: decodedAccess.userId });
          }
        } catch (e) {
          logger.error("Invalid access token format", { traceId, error: e.message });
          throw new Error("Invalid access token");
        }
        logger.debug("Attempting token refresh in interceptor", {
          traceId,
          accessToken: accessToken.substring(0, 10) + "...",
          refreshToken: refreshToken.substring(0, 10) + "...",
        });
        const refreshResponse = await api.post(
          "/api/auth/refresh-token",
          { refreshToken },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "x-refresh-token": refreshToken,
              "X-Trace-Id": traceId,
              "Content-Type": "application/json",
            },
          }
        );
        const refreshData = refreshResponse.data;
        if (refreshResponse.status === 200 && refreshData.success) {
          localStorage.setItem("accessToken", refreshData.accessToken);
          localStorage.setItem("refreshToken", refreshData.refreshToken);
          logger.debug("Interceptor refreshed tokens", { traceId });
          originalRequest.headers["Authorization"] = `Bearer ${refreshData.accessToken}`;
          return api(originalRequest);
        }
        logger.warn("Interceptor token refresh failed", {
          traceId,
          status: refreshResponse.status,
          data: refreshData,
        });
        throw new Error("Refresh failed");
      } catch (refreshError) {
        logger.error("Interceptor refresh error", {
          error: refreshError.message,
          traceId,
          response: refreshError.response?.data,
        });
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("profilePicture");
        window.dispatchEvent(
          new CustomEvent("navigate", {
            detail: {
              path: "/login",
              state: { error: "Session expired. Please log in again." },
              replace: true,
            },
          })
        );
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

const Navbar = memo(({ 
  user, 
  onLogout = () => {}, 
  onSearch, 
  onAuthSuccess = () => {}, 
  showLogin = false, 
  setShowLogin = () => {},
  setShowSignup = () => {}
}) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [modalType, setModalType] = useState(null); // "login", "signup", or null
  const [searchQuery, setSearchQuery] = useState("");
  const [isExploreOpen, setExploreOpen] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });
  const [searchError, setSearchError] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false); // State for logout spinning effect

  const exploreRef = useRef(null);
  const popupRef = useRef(null);
  const { cart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  // Validate BASE_URL
  useEffect(() => {
    if (!BASE_URL && process.env.NODE_ENV !== "production") {
      const traceId = crypto.randomUUID();
      logger.error("VITE_BACKEND_URL is not defined in environment variables", { traceId });
      throw new Error("Backend URL configuration missing");
    }
  }, []);

  // Use user prop to determine authentication status
  const isAuthenticated = !!user;

  // Sync modalType with showLogin and close when authenticated
  useEffect(() => {
    if (showLogin && !modalType) {
      setModalType("login");
    }
    if (isAuthenticated) {
      setModalType(null);
      setShowLogin(false);
      setShowSignup(false);
    }
  }, [showLogin, isAuthenticated, setShowLogin, setShowSignup]);

  // Prevent body scrolling when sidebar or modal is open
  useEffect(() => {
    if (isSidebarOpen || modalType) {
      document.body.classList.add("login-modal-open");
    } else {
      document.body.classList.remove("login-modal-open");
    }
    return () => {
      document.body.classList.remove("login-modal-open");
    };
  }, [isSidebarOpen, modalType]);

  // Close sidebar and search bar when the route changes
  useEffect(() => {
    setSidebarOpen(false);
    if (location.pathname === "/search-results") {
      setSearchVisible(false);
    }
  }, [location.pathname]);

  // Handle clicks outside the sidebar and search bar
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        isSidebarOpen &&
        !event.target.closest(".nav-sidebar") &&
        !event.target.closest(".menu-icon")
      ) {
        setSidebarOpen(false);
      }
      if (
        searchVisible &&
        !event.target.closest(".search-container") &&
        !event.target.closest(".search-btn")
      ) {
        setSearchVisible(false);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [isSidebarOpen, searchVisible]);

  // Close sidebar on large screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.addEventListener("resize", handleResize);
  }, []);

  // Close search bar when sidebar is opened
  useEffect(() => {
    if (isSidebarOpen) {
      setSearchVisible(false);
    }
  }, [isSidebarOpen]);

  // Handle Explore popup positioning and visibility
  useEffect(() => {
    if (showPopup && exploreRef.current && popupRef.current) {
      const exploreElement = exploreRef.current;
      const popupElement = popupRef.current;

      const rect = exploreElement.getBoundingClientRect();
      const navbarHeight = document.querySelector(".nav-main").offsetHeight;
      const viewportWidth = window.innerWidth;

      popupElement.style.visibility = "hidden";
      popupElement.style.display = "block";

      requestAnimationFrame(() => {
        const popupWidth = popupElement.offsetWidth;
        const exploreCenterX = rect.left + rect.width / 2;

        const left = Math.max(
          10,
          Math.min(exploreCenterX - popupWidth / 2, viewportWidth - popupWidth - 10)
        );

        setPopupPosition({ top: navbarHeight, left });
        popupElement.style.visibility = "visible";
      });
    }
  }, [showPopup]);

  // Token refresh function
  const refreshToken = async () => {
    const traceId = crypto.randomUUID();
    const accessToken = localStorage.getItem("accessToken");
    const refreshToken = localStorage.getItem("refreshToken");

    if (!accessToken || !refreshToken) {
      logger.warn("Missing tokens for refresh", { traceId });
      return null;
    }

    try {
      logger.debug("Attempting token refresh", {
        traceId,
        accessToken: accessToken.substring(0, 10) + "...",
        refreshToken: refreshToken.substring(0, 10) + "...",
      });
      const response = await api.post(
        "/api/auth/refresh-token",
        { refreshToken },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "x-refresh-token": refreshToken,
            "X-Trace-Id": traceId,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.success) {
        localStorage.setItem("accessToken", response.data.accessToken);
        localStorage.setItem("refreshToken", response.data.refreshToken);
        logger.debug("Token refresh successful", { traceId });
        return response.data;
      }
      logger.warn("Token refresh failed", {
        traceId,
        status: response.status,
        data: response.data,
      });
      return null;
    } catch (error) {
      logger.error("Token refresh error", {
        error: error.message,
        traceId,
        response: error.response?.data,
      });
      return null;
    }
  };

  // Perform the search
  const performSearch = async (query) => {
    if (query.trim() === "") return;

    const traceId = crypto.randomUUID();
    setSearchError(null);

    try {
      const response = await axios.get(`${BASE_URL}/api/courses/search`, {
        params: { title: query?.trim() || "" },
        timeout: 10000,
        headers: {
          "Content-Type": "application/json",
          "X-Trace-Id": traceId,
        },
      });

      if (response.data?.courses) {
        onSearch(response.data.courses || []);
        navigate("/search-results");
      } else {
        onSearch([]);
        navigate("/search-results");
      }
    } catch (error) {
      logger.error("Search error", { message: error.message, traceId });
      let errorMessage = "Failed to perform search. Please try again.";
      if (error.response) {
        const { status, data } = error.response;
        switch (status) {
          case 400:
            errorMessage = data.message || "Invalid search query.";
            break;
          case 429:
            errorMessage = "Too many search attempts. Please try again later.";
            break;
          case 503:
            errorMessage = "Service unavailable. Please try again later.";
            break;
          default:
            errorMessage = data.message || errorMessage;
        }
      } else if (error.code === "ECONNABORTED") {
        errorMessage = "Search request timed out. Please try again.";
      }
      setSearchError(errorMessage);
      onSearch([]);
      navigate("/search-results");
    } finally {
      setSearchQuery("");
    }
  };

  const handleSearchInputChange = (event) => {
    setSearchQuery(event.target.value);
    setSearchError(null);
  };

  const handleSearchSubmit = async (event) => {
    event.preventDefault();
    await performSearch(searchQuery);
  };

  const handleCartClick = () => navigate("/cart");

  const handleSignUpClick = () => {
    setModalType("signup");
    setShowLogin(false);
    setShowSignup(true);
    setSidebarOpen(false);
  };

  const handleLoginClick = () => {
    setModalType("login");
    setShowLogin(true);
    setShowSignup(false);
    setSidebarOpen(false);
  };

  const closeModals = () => {
    setModalType(null);
    setShowLogin(false);
    setShowSignup(false);
  };

  const handleLoginSuccess = () => {
    closeModals();
  };

  const handleLogout = async () => {
    setIsLoggingOut(true); // Start spinning effect
    const traceId = crypto.randomUUID();
    let accessToken = localStorage.getItem("accessToken");
    let refreshToken = localStorage.getItem("refreshToken");

    if (!accessToken || !refreshToken) {
      logger.info("No tokens found, proceeding with client-side logout", { traceId });
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("profilePicture");
      onLogout();
      navigate("/");
      setIsLoggingOut(false);
      return;
    }

    try {
      // Validate access token
      let decoded;
      try {
        decoded = jwtDecode(accessToken);
        if (decoded.exp * 1000 < Date.now()) {
          logger.warn("Access token expired, attempting refresh", { traceId, userId: decoded.userId });
          const refreshData = await refreshToken();
          if (refreshData) {
            accessToken = refreshData.accessToken;
            refreshToken = refreshData.refreshToken;
          } else {
            throw new Error("Token refresh failed");
          }
        }
      } catch (e) {
        logger.error("Invalid access token format, attempting refresh", { traceId, error: e.message });
        const refreshData = await refreshToken();
        if (refreshData) {
          accessToken = refreshData.accessToken;
          refreshToken = refreshData.refreshToken;
        } else {
          throw new Error("Token refresh failed");
        }
      }

      logger.debug("Sending logout request", {
        traceId,
        accessToken: accessToken.substring(0, 10) + "...",
        refreshToken: refreshToken.substring(0, 10) + "...",
      });
      await api.post(
        "/api/auth/logout",
        { refreshToken },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "X-Trace-Id": traceId,
          },
        }
      );
      logger.info("Logout request successful", { traceId });
    } catch (error) {
      logger.warn("Logout request failed, proceeding with client-side logout", {
        traceId,
        error: error.message,
        response: error.response?.data,
      });
    } finally {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("profilePicture");
      onLogout();
      navigate("/");
      setIsLoggingOut(false); // Stop spinning effect
    }
  };

  return (
    <>
      <nav className="nav-main" role="navigation" aria-label="Main navigation">
        <div className="nav-left">
          <button
            className="menu-icon"
            aria-label="Toggle menu"
            onClick={() => setSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                height="32px"
                viewBox="0 -960 960 960"
                width="32px"
                fill="#333"
              >
                <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                height="28px"
                viewBox="0 -960 960 960"
                width="28px"
                fill="#333"
              >
                <path d="M120-240v-60h720v60H120Zm0-210v-60h720v60H120Zm0-210v-60h720v60H120Z" />
              </svg>
            )}
          </button>
          <div className="company-info">
            <img
              src="/assets/logos/company-logo.png"
              alt="Company-logo"
              onError={() => logger.error("Failed to load /assets/logos/company-logo.png", { traceId: crypto.randomUUID() })}
            />
            <div className="company-name">SkillNestX</div>
          </div>
        </div>

        <div className="nav-middle">
          <button
            className="search-btn"
            aria-label="Toggle search"
            onClick={() => setSearchVisible(!searchVisible)}
          >
            {searchVisible ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 960 960"
                fill="#333"
              >
                <path d="M256 760l-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 960 960"
                fill="#333"
              >
                <path d="M784 840L532 588q-30 24-69 38t-83 14q-109 0-184.5-75.5T120 380q0-109 75.5-184.5T380 120q109 0 184.5 75.5T640 380q0 44-14 83t-38 69l252 252-56 56ZM380 560q75 0 127.5-52.5T560 380q0-75-52.5-127.5T380 200q-75 0-127.5 52.5T200 380q0 75 52.5 127.5T380 560Z" />
              </svg>
            )}
          </button>
        </div>

        <div className="nav-right">
          <ul className="nav-links">
            <li>
              <Link
                to="/"
                className="nav-link home-link"
                onClick={() => setSidebarOpen(false)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  height="24px"
                  viewBox="0 -960 960 960"
                  width="24px"
                  fill="currentColor"
                >
                  <path d="M240-200h120v-240h240v240h120v-360L480-740 240-560v360Zm-80 80v-480l320-240 320 240v480H520v-240h-80v240H160Zm320-350Z" />
                </svg>
                <span>Home</span>
              </Link>
            </li>

            <li
              onMouseEnter={() => setShowPopup(true)}
              onMouseLeave={() => setShowPopup(false)}
            >
              <div ref={exploreRef} className="explore-container">
                <div className="explore-link">
                  <span>Explore</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    height="24px"
                    viewBox="0 -960 960 960"
                    width="24px"
                    fill="currentColor"
                  >
                    <path d="M480-344 240-584l56-56 184 184 184-184 56 56-240 240Z" />
                  </svg>
                </div>

                {showPopup && (
                  <div
                    ref={popupRef}
                    className="explore-popup"
                    style={{
                      top: `${popupPosition.top}px`,
                      left: `${popupPosition.left}px`,
                    }}
                  >
                    <ul className="explore-categories">
                      {[
                        "Frontend",
                        "Backend",
                        "Machine Learning",
                        "Artificial Intelligence",
                        "System Design",
                        "Database",
                      ].map((category) => (
                        <li key={category}>
                          <Link
                            to={`/courses?category=${category}`}
                            onClick={() => setShowPopup(false)}
                          >
                            {category}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </li>

            <li>
              <Link
                to="/courses"
                className="nav-link"
                onClick={() => setSidebarOpen(false)}
              >
                Courses
              </Link>
            </li>
            <li>
              <Link
                to="/pricing"
                className="nav-link"
                onClick={() => setSidebarOpen(false)}
              >
                Pricing
              </Link>
            </li>
            <li>
              <Link
                to="/support"
                className="nav-link"
                onClick={() => setSidebarOpen(false)}
              >
                Support
              </Link>
            </li>
          </ul>

          <div className="cart-icon" onClick={handleCartClick} aria-label="Cart">
            {cart.length > 0 && <span className="cart-count">{cart.length}</span>}
            <img
              src="/assets/icons/cart.svg"
              alt="Cart"
              onError={() => logger.error("Failed to load /assets/icons/cart.svg", { traceId: crypto.randomUUID() })}
            />
          </div>

          {isAuthenticated ? (
            <div className="user-profile">
              <Suspense fallback={<div className="profile-icon-placeholder" />}>
                <UserProfile user={user} onLogout={handleLogout} />
              </Suspense>
            </div>
          ) : (
            <div className="user-auth">
              <button className="auth-btn login-btn" onClick={handleLoginClick}>
                Log in
              </button>
              <button className="auth-btn signup-btn" onClick={handleSignUpClick}>
                Sign up
              </button>
            </div>
          )}
        </div>
      </nav>

      {searchVisible && (
        <div className="search-container active">
          <form className="search-bar" onSubmit={handleSearchSubmit}>
            <input
              type="text"
              className="search-input"
              placeholder="Search..."
              aria-label="Search input"
              value={searchQuery}
              onChange={handleSearchInputChange}
              onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit(e)}
            />
            <button type="submit" className="search-icon" aria-label="Search">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 960 960"
                fill="#333"
              >
                <path d="M784 840L532 588q-30 24-69 38t-83 14q-109 0-184.5-75.5T120 380q0-109 75.5-184.5T380 120q109 0 184.5 75.5T640 380q0 44-14 83t-38 69l252 252-56 56ZM380 560q75 0 127.5-52.5T560 380q0-75-52.5-127.5T380 200q-75 0-127.5 52.5T200 380q0 75 52.5 127.5T380 560Z" />
              </svg>
            </button>
          </form>
          {searchError && (
            <div className="search-error-message" role="alert">
              {searchError}
            </div>
          )}
        </div>
      )}

      <aside
        className={`nav-sidebar ${isSidebarOpen ? "active" : ""}`}
        aria-label="Sidebar navigation"
      >
        <div className="sidebar-header">
          <button
            className="close-icon"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="32px"
              viewBox="0 -960 960 960"
              width="32px"
              fill="#333"
            >
              <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
            </svg>
          </button>
          <div className="company-info">
            <img
              src="/assets/logos/company-logo.png"
              alt="Company-logo"
              onError={() => logger.error("Failed to load /assets/logos/company-logo.png", { traceId: crypto.randomUUID() })}
            />
            <div className="company-name">SkillNestX</div>
          </div>
        
        </div>

        <div className="sidebar-body">
          <ul className="sidebar-nav-link">
            <li className="sidebar-explore-container">
              <div
                className="sidebar-explore-button"
                onClick={() => setExploreOpen(!isExploreOpen)}
              >
                <span>Explore</span>
                <img
                  src="/assets/icons/arrow-down.svg"
                  alt="Arrow"
                  className={`arrow-icon ${isExploreOpen ? "rotate" : ""}`}
                  onError={() => logger.error("Failed to load /assets/icons/arrow-down.svg", { traceId: crypto.randomUUID() })}
                />
              </div>
              {isExploreOpen && (
                <ul className="sidebar-explore-category">
                  {[
                    "Frontend",
                    "Backend",
                    "Machine Learning",
                    "Artificial Intelligence",
                    "System Design",
                    "Database",
                  ].map((category) => (
                    <li key={category}>
                      <Link
                        to={`/courses?category=${category}`}
                        onClick={() => setSidebarOpen(false)}
                      >
                        {category}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>

            <li>
              <Link to="/courses" onClick={() => setSidebarOpen(false)}>
                Courses
                <img
                  src="/assets/icons/arrow-right.svg"
                  alt="Arrow"
                  onError={() => logger.error("Failed to load /assets/icons/arrow-right.svg", { traceId: crypto.randomUUID() })}
                />
              </Link>
            </li>

            <li>
              <Link to="/pricing" onClick={() => setSidebarOpen(false)}>
                Pricing
                <img
                  src="/assets/icons/arrow-right.svg"
                  alt="Arrow"
                  onError={() => logger.error("Failed to load /assets/icons/arrow-right.svg", { traceId: crypto.randomUUID() })}
                />
              </Link>
            </li>

            <li>
              <Link to="/about" onClick={() => setSidebarOpen(false)}>
                About
                <img
                  src="/assets/icons/arrow-right.svg"
                  alt="Arrow"
                  onError={() => logger.error("Failed to load /assets/icons/arrow-right.svg", { traceId: crypto.randomUUID() })}
                />
              </Link>
            </li>

            <li>
              <Link to="/support" onClick={() => setSidebarOpen(false)}>
                Support
                <img
                  src="/assets/icons/arrow-right.svg"
                  alt="Arrow"
                  onError={() => logger.error("Failed to load /assets/icons/arrow-right.svg", { traceId: crypto.randomUUID() })}
                />
              </Link>
            </li>
          </ul>
        </div>

        <div className="sidebar-footer">
          {isAuthenticated ? (
            <button
              className={`btn logout-btn ${isLoggingOut ? "logging-out" : ""}`}
              onClick={handleLogout}
              disabled={isLoggingOut}
              aria-label="Log out"
            >
              {isLoggingOut ? (
                <div className="logout-spinner-container">
                  <div className="logout-spinner"></div>
                  <span>Logging out...</span>
                </div>
              ) : (
                <>
                  <img
                    src="/assets/icons/logout-white.svg"
                    alt="Logout"
                    className="logout-icon"
                    onError={() => logger.error("Failed to load /assets/icons/logout-white.svg", { traceId: crypto.randomUUID() })}
                  />
                  <span>Log out</span>
                </>
              )}
            </button>
          ) : (
            <div className="user-auth">
              <button className="btn login-btn" onClick={handleLoginClick}>
                Log in
              </button>
              <button className="btn signup-btn" onClick={handleSignUpClick}>
                Sign up
              </button>
            </div>
          )}
        </div>
      </aside>

      {modalType === "login" && (
        <div className="login-modal-wrapper" key="login">
          <Suspense fallback={null}>
            <Login
              onClose={closeModals}
              onLoginSuccess={handleLoginSuccess}
              onAuthSuccess={onAuthSuccess}
              setShowLogin={setShowLogin}
            />
          </Suspense>
        </div>
      )}
      {modalType === "signup" && (
        <div className="signup-modal-wrapper" key="signup">
          <Suspense fallback={null}>
            <SignUp
              onClose={closeModals}
              onSignUpSuccess={handleLoginSuccess}
              onAuthSuccess={onAuthSuccess}
              setShowSignup={setShowSignup}
            />
          </Suspense>
        </div>
      )}
    </>
  );
});

Navbar.propTypes = {
  user: PropTypes.shape({
    _id: PropTypes.string,
    name: PropTypes.string,
    email: PropTypes.string,
    role: PropTypes.string,
    isVerified: PropTypes.bool,
  }),
  onLogout: PropTypes.func,
  onSearch: PropTypes.func.isRequired,
  onAuthSuccess: PropTypes.func,
  showLogin: PropTypes.bool,
  setShowLogin: PropTypes.func,
  setShowSignup: PropTypes.func,
};

export default Navbar;